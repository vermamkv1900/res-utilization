"""
CloudPulse FinOps - Cloud Cost & Resource Optimizer Backend
Python + Flask + Boto3 (AWS) + Azure Management SDKs
"""

import os
import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

# Optional Cloud SDK imports
try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

try:
    from azure.identity import ClientSecretCredential
    from azure.mgmt.compute import ComputeManagementClient
    from azure.mgmt.network import NetworkManagementClient
    from azure.mgmt.sql import SqlManagementClient
    from azure.mgmt.monitor import MonitorManagementClient
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False

load_dotenv()

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# --------------------------------------------------------------------------
# AWS CLOUD SCANNER
# --------------------------------------------------------------------------
class AWSCloudAuditor:
    def __init__(self, access_key, secret_key, region='us-east-1', session_token=None):
        self.region = region
        self.session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=session_token if session_token else None,
            region_name=region
        )
        self.ec2_client = self.session.client('ec2')
        self.cloudwatch = self.session.client('cloudwatch')
        self.rds_client = self.session.client('rds')

    def get_ec2_cpu_utilization(self, instance_id, days=14):
        try:
            end_time = datetime.datetime.utcnow()
            start_time = end_time - datetime.timedelta(days=days)
            response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='CPUUtilization',
                Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,
                Statistics=['Average', 'Maximum']
            )
            datapoints = response.get('Datapoints', [])
            if not datapoints:
                return {'avg_cpu': 0.0, 'max_cpu': 0.0}
            avg_cpu = sum(dp['Average'] for dp in datapoints) / len(datapoints)
            max_cpu = max(dp['Maximum'] for dp in datapoints)
            return {'avg_cpu': round(avg_cpu, 2), 'max_cpu': round(max_cpu, 2)}
        except Exception:
            return {'avg_cpu': 0.0, 'max_cpu': 0.0}

    def audit_all(self):
        resources = []
        # Audit EC2 Instances
        try:
            resp = self.ec2_client.describe_instances()
            for r in resp.get('Reservations', []):
                for inst in r.get('Instances', []):
                    inst_id = inst['InstanceId']
                    state = inst['State']['Name']
                    inst_type = inst.get('InstanceType', 'c5.large')
                    name = next((t['Value'] for t in inst.get('Tags', []) if t['Key'] == 'Name'), inst_id)
                    base_cost = 140.0
                    if state == 'stopped':
                        resources.append({
                            'id': inst_id,
                            'name': name,
                            'service': 'EC2',
                            'provider': 'aws',
                            'region': self.region,
                            'typeOrSize': inst_type,
                            'status': 'stopped',
                            'isInactive': True,
                            'inactiveReason': 'Instance stopped but incurring EBS volume retention charges',
                            'monthlyCostUSD': 20.0,
                            'estimatedWasteUSD': 20.0,
                            'remediationCommand': f'aws ec2 terminate-instances --instance-ids {inst_id}'
                        })
                    elif state == 'running':
                        cpu = self.get_ec2_cpu_utilization(inst_id)
                        is_idle = cpu['avg_cpu'] < 5.0
                        waste = base_cost * 0.85 if is_idle else 0.0
                        resources.append({
                            'id': inst_id,
                            'name': name,
                            'service': 'EC2',
                            'provider': 'aws',
                            'region': self.region,
                            'typeOrSize': inst_type,
                            'status': 'idle' if is_idle else 'active',
                            'isInactive': is_idle,
                            'inactiveReason': f"Low CPU utilization ({cpu['avg_cpu']}%)" if is_idle else None,
                            'metrics': {'cpuAvgPercent': cpu['avg_cpu'], 'cpuMaxPercent': cpu['max_cpu']},
                            'monthlyCostUSD': base_cost,
                            'estimatedWasteUSD': round(waste, 2),
                            'remediationCommand': f'aws ec2 stop-instances --instance-ids {inst_id}' if is_idle else '# Active'
                        })
        except Exception as e:
            print(f"EC2 audit notice: {e}")

        # Audit Unattached EBS Volumes
        try:
            v_resp = self.ec2_client.describe_volumes(Filters=[{'Name': 'status', 'Values': ['available']}])
            for vol in v_resp.get('Volumes', []):
                vol_id = vol['VolumeId']
                size = vol['Size']
                cost = size * 0.08
                resources.append({
                    'id': vol_id,
                    'name': f"unattached-ebs-{vol_id[:8]}",
                    'service': 'EBS',
                    'provider': 'aws',
                    'region': self.region,
                    'typeOrSize': f"gp3 ({size} GB)",
                    'status': 'inactive',
                    'isInactive': True,
                    'inactiveReason': 'Unattached EBS Volume in available state',
                    'monthlyCostUSD': round(cost, 2),
                    'estimatedWasteUSD': round(cost, 2),
                    'remediationCommand': f'aws ec2 delete-volume --volume-id {vol_id}'
                })
        except Exception as e:
            print(f"EBS audit notice: {e}")

        return resources

# --------------------------------------------------------------------------
# AZURE CLOUD SCANNER
# --------------------------------------------------------------------------
class AzureCloudAuditor:
    def __init__(self, subscription_id, tenant_id, client_id, client_secret):
        self.subscription_id = subscription_id
        if AZURE_AVAILABLE:
            self.cred = ClientSecretCredential(tenant_id, client_id, client_secret)
            self.compute = ComputeManagementClient(self.cred, subscription_id)
        else:
            self.compute = None

    def audit_all(self):
        resources = []
        if not self.compute:
            return resources
        try:
            for vm in self.compute.virtual_machines.list_all():
                resources.append({
                    'id': vm.id,
                    'name': vm.name,
                    'service': 'AZURE_VM',
                    'provider': 'azure',
                    'region': vm.location,
                    'typeOrSize': vm.hardware_profile.vm_size,
                    'status': 'active',
                    'isInactive': False,
                    'monthlyCostUSD': 146.0,
                    'estimatedWasteUSD': 0.0,
                    'remediationCommand': '# Active VM'
                })
        except Exception as e:
            print(f"Azure VM scan notice: {e}")
        return resources

# --------------------------------------------------------------------------
# ROUTES
# --------------------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'healthy',
        'boto3': BOTO3_AVAILABLE,
        'azure_sdk': AZURE_AVAILABLE
    })

@app.route('/api/scan', methods=['POST'])
def scan():
    payload = request.json or {}
    provider = payload.get('provider', 'aws').lower()
    acc_id = payload.get('accountId', '')
    access_key = payload.get('accessKeyId', '')
    secret_key = payload.get('secretAccessKey', '')
    region = payload.get('region', 'us-east-1')

    # If demo credentials or requested demo, return comprehensive audit
    if payload.get('demoMode') or not secret_key or 'EXAMPLE' in secret_key:
        return jsonify(generate_demo_audit(provider, acc_id or 'Demo-9482'))

    resources = []
    if provider == 'aws' and BOTO3_AVAILABLE:
        auditor = AWSCloudAuditor(access_key, secret_key, region)
        resources = auditor.audit_all()
    elif provider == 'azure' and AZURE_AVAILABLE:
        auditor = AzureCloudAuditor(acc_id, payload.get('tenantId'), access_key, secret_key)
        resources = auditor.audit_all()

    total_cost = sum(r['monthlyCostUSD'] for r in resources)
    total_waste = sum(r['estimatedWasteUSD'] for r in resources)

    return jsonify({
        'summary': {
            'accountId': acc_id,
            'provider': provider,
            'scannedAt': datetime.datetime.utcnow().isoformat(),
            'totalResources': len(resources),
            'activeResources': sum(1 for r in resources if not r['isInactive']),
            'inactiveResources': sum(1 for r in resources if r['isInactive']),
            'totalMonthlySpend': round(total_cost, 2),
            'totalMonthlyWaste': round(total_waste, 2),
            'wastePercentage': round((total_waste / total_cost * 100), 1) if total_cost > 0 else 0
        },
        'resources': resources
    })

def generate_demo_audit(provider, account_id):
    if provider == 'aws':
        resources = [
            {
                'id': 'i-09ab7261c47a98bc1', 'name': 'dev-analytics-processor-worker',
                'service': 'EC2', 'provider': 'aws', 'region': 'us-east-1',
                'typeOrSize': 'c5.2xlarge (8 vCPU, 16 GiB)', 'status': 'idle',
                'metrics': {'cpuAvgPercent': 1.4, 'cpuMaxPercent': 4.8},
                'monthlyCostUSD': 248.20, 'estimatedWasteUSD': 220.00,
                'isInactive': True, 'inactiveReason': 'CPU average < 2.0% for 30 consecutive days',
                'remediationCommand': 'aws ec2 stop-instances --instance-ids i-09ab7261c47a98bc1'
            },
            {
                'id': 'vol-0f38b4d8d1e25e378', 'name': 'orphaned-batch-data-disk-01',
                'service': 'EBS', 'provider': 'aws', 'region': 'us-east-1',
                'typeOrSize': 'gp3 (1,200 GB)', 'status': 'inactive',
                'monthlyCostUSD': 116.00, 'estimatedWasteUSD': 116.00,
                'isInactive': True, 'inactiveReason': 'Unattached volume in available state for 62 days',
                'remediationCommand': 'aws ec2 delete-volume --volume-id vol-0f38b4d8d1e25e378'
            },
            {
                'id': 'i-0782390fec9012351', 'name': 'prod-core-api-primary-01',
                'service': 'EC2', 'provider': 'aws', 'region': 'us-east-1',
                'typeOrSize': 'm6i.2xlarge (8 vCPU, 32 GiB)', 'status': 'active',
                'metrics': {'cpuAvgPercent': 68.4, 'cpuMaxPercent': 91.2},
                'monthlyCostUSD': 279.40, 'estimatedWasteUSD': 0.00,
                'isInactive': False,
                'remediationCommand': '# Active production instance'
            }
        ]
    else:
        resources = [
            {
                'id': '/subscriptions/sub-01/resourceGroups/rg-dev/virtualMachines/vm-databricks-worker-03',
                'name': 'vm-databricks-worker-03', 'service': 'AZURE_VM', 'provider': 'azure', 'region': 'eastus',
                'typeOrSize': 'Standard_D8s_v5', 'status': 'idle',
                'metrics': {'cpuAvgPercent': 2.1}, 'monthlyCostUSD': 292.00, 'estimatedWasteUSD': 260.00,
                'isInactive': True, 'inactiveReason': 'CPU average < 3% for past month',
                'remediationCommand': 'az vm deallocate --resource-group rg-dev --name vm-databricks-worker-03'
            }
        ]

    total_cost = sum(r['monthlyCostUSD'] for r in resources)
    total_waste = sum(r['estimatedWasteUSD'] for r in resources)

    return {
        'summary': {
            'accountId': account_id,
            'provider': provider,
            'scannedAt': datetime.datetime.utcnow().isoformat(),
            'totalResources': len(resources),
            'activeResources': sum(1 for r in resources if not r['isInactive']),
            'inactiveResources': sum(1 for r in resources if r['isInactive']),
            'totalMonthlySpend': round(total_cost, 2),
            'totalMonthlyWaste': round(total_waste, 2),
            'wastePercentage': round((total_waste / total_cost * 100), 1) if total_cost > 0 else 0
        },
        'resources': resources
    }

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
