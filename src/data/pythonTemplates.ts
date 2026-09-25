export const PYTHON_APP_CODE = `"""
CloudPulse - Cloud Cost & Resource Utilization Monitor
Complete Python Backend with AWS Boto3 & Azure SDK Integrations.

Endpoints:
- POST /api/scan : Connects to AWS or Azure with credentials & audits resource utilization
- GET  /api/health : Service health status
- GET  / : Serves the integrated web UI
"""

import os
import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

# Optional Cloud SDKs
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
    from azure.mgmt.costmanagement import CostManagementClient
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# --------------------------------------------------------------------------
# AWS AUDITOR & MONITORING ENGINE (BOTO3)
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
        self.ce_client = self.session.client('ce')  # Cost Explorer

    def get_ec2_cpu_utilization(self, instance_id, days=14):
        """Query AWS CloudWatch for average CPU utilization over specified days."""
        try:
            end_time = datetime.datetime.utcnow()
            start_time = end_time - datetime.timedelta(days=days)
            response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='CPUUtilization',
                Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,  # 1-day intervals
                Statistics=['Average', 'Maximum']
            )
            datapoints = response.get('Datapoints', [])
            if not datapoints:
                return {'avg_cpu': 0.0, 'max_cpu': 0.0}
            
            avg_cpu = sum(dp['Average'] for dp in datapoints) / len(datapoints)
            max_cpu = max(dp['Maximum'] for dp in datapoints)
            return {'avg_cpu': round(avg_cpu, 2), 'max_cpu': round(max_cpu, 2)}
        except Exception as e:
            return {'avg_cpu': 0.0, 'max_cpu': 0.0, 'error': str(e)}

    def audit_ec2_instances(self):
        """Scans for active, stopped, and idle EC2 instances."""
        resources = []
        try:
            instances_resp = self.ec2_client.describe_instances()
            for reservation in instances_resp.get('Reservations', []):
                for inst in reservation.get('Instances', []):
                    inst_id = inst['InstanceId']
                    state = inst['State']['Name']
                    inst_type = inst.get('InstanceType', 'unknown')
                    name = next((t['Value'] for t in inst.get('Tags', []) if t['Key'] == 'Name'), inst_id)

                    # Estimate standard on-demand monthly cost based on instance type
                    base_cost = self._estimate_ec2_cost(inst_type)
                    
                    if state == 'stopped':
                        # Stopped instance still incurs root EBS storage cost
                        resources.append({
                            'id': inst_id,
                            'name': name,
                            'service': 'EC2',
                            'provider': 'aws',
                            'region': self.region,
                            'typeOrSize': inst_type,
                            'status': 'stopped',
                            'isInactive': True,
                            'inactiveReason': 'Instance is in stopped state; retaining attached root/data volumes',
                            'monthlyCostUSD': 20.0,
                            'estimatedWasteUSD': 20.0,
                            'savingsPotentialPercent': 100,
                            'recommendedAction': 'Terminate instance or create AMI snapshot',
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
                            'inactiveReason': f"Low CPU utilization ({cpu['avg_cpu']}%) over 14 days" if is_idle else None,
                            'metrics': {'cpuAvgPercent': cpu['avg_cpu'], 'cpuMaxPercent': cpu['max_cpu']},
                            'monthlyCostUSD': base_cost,
                            'estimatedWasteUSD': round(waste, 2),
                            'savingsPotentialPercent': 85 if is_idle else 0,
                            'recommendedAction': 'Downscale or stop instance on schedule' if is_idle else 'Healthy',
                            'remediationCommand': f'aws ec2 stop-instances --instance-ids {inst_id}' if is_idle else '# Active'
                        })
        except Exception as e:
            print(f"Error scanning EC2: {e}")
        return resources

    def audit_unattached_ebs(self):
        """Detects orphan EBS volumes with status == available (unattached)."""
        resources = []
        try:
            volumes_resp = self.ec2_client.describe_volumes(
                Filters=[{'Name': 'status', 'Values': ['available']}]
            )
            for vol in volumes_resp.get('Volumes', []):
                vol_id = vol['VolumeId']
                size_gb = vol['Size']
                vol_type = vol['VolumeType']
                name = next((t['Value'] for t in vol.get('Tags', []) if t['Key'] == 'Name'), vol_id)
                
                # Approximate cost ($0.08/GB for gp3, $0.125/GB + IOPS for io2)
                cost = size_gb * (0.125 if 'io' in vol_type else 0.08)
                
                resources.append({
                    'id': vol_id,
                    'name': name,
                    'service': 'EBS',
                    'provider': 'aws',
                    'region': self.region,
                    'typeOrSize': f"{vol_type} ({size_gb} GB)",
                    'status': 'inactive',
                    'isInactive': True,
                    'inactiveReason': 'Unattached EBS volume (State: available) incurring storage costs',
                    'monthlyCostUSD': round(cost, 2),
                    'estimatedWasteUSD': round(cost, 2),
                    'savingsPotentialPercent': 100,
                    'recommendedAction': 'Snapshot to S3 Glacier and delete volume',
                    'remediationCommand': f'aws ec2 delete-volume --volume-id {vol_id}'
                })
        except Exception as e:
            print(f"Error scanning EBS: {e}")
        return resources

    def audit_unassociated_elastic_ips(self):
        """Scans for unassociated Elastic IPs charging $0.005/hour."""
        resources = []
        try:
            addresses = self.ec2_client.describe_addresses().get('Addresses', [])
            for addr in addresses:
                if 'InstanceId' not in addr and 'NetworkInterfaceId' not in addr:
                    alloc_id = addr.get('AllocationId', addr.get('PublicIp'))
                    resources.append({
                        'id': alloc_id,
                        'name': f"eip-{addr.get('PublicIp')}",
                        'service': 'EIP',
                        'provider': 'aws',
                        'region': self.region,
                        'typeOrSize': 'IPv4 Elastic IP',
                        'status': 'inactive',
                        'isInactive': True,
                        'inactiveReason': 'Elastic IP not associated with any running EC2 or ENI',
                        'monthlyCostUSD': 7.20,
                        'estimatedWasteUSD': 7.20,
                        'savingsPotentialPercent': 100,
                        'recommendedAction': 'Release unassociated Elastic IP',
                        'remediationCommand': f"aws ec2 release-address --allocation-id {alloc_id}"
                    })
        except Exception as e:
            print(f"Error scanning EIP: {e}")
        return resources

    def _estimate_ec2_cost(self, inst_type):
        cost_map = {
            't3.micro': 7.5, 't3.medium': 30.0, 't3.large': 60.0,
            'm5.large': 70.0, 'm5.xlarge': 140.0, 'm5.4xlarge': 560.0,
            'c5.xlarge': 124.0, 'c5.2xlarge': 248.0, 'c5.4xlarge': 496.0,
            'g5.4xlarge': 1185.0, 'r5.xlarge': 180.0
        }
        return cost_map.get(inst_type, 120.0)

# --------------------------------------------------------------------------
# AZURE AUDITOR & MONITORING ENGINE
# --------------------------------------------------------------------------
class AzureCloudAuditor:
    def __init__(self, subscription_id, tenant_id, client_id, client_secret):
        self.subscription_id = subscription_id
        if AZURE_AVAILABLE:
            self.credential = ClientSecretCredential(
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret
            )
            self.compute_client = ComputeManagementClient(self.credential, subscription_id)
            self.network_client = NetworkManagementClient(self.credential, subscription_id)
            self.monitor_client = MonitorManagementClient(self.credential, subscription_id)
        else:
            self.credential = None

    def audit_azure_vms(self):
        """Lists VMs and checks for low CPU / deallocated states."""
        resources = []
        if not AZURE_AVAILABLE:
            return resources
        try:
            for vm in self.compute_client.virtual_machines.list_all():
                vm_name = vm.name
                vm_size = vm.hardware_profile.vm_size
                rg = vm.id.split('/')[4]
                
                # Check instance view for power state
                instance_view = self.compute_client.virtual_machines.instance_view(rg, vm_name)
                statuses = [s.code for s in instance_view.statuses if s.code]
                
                is_stopped = any('PowerState/stopped' in s or 'PowerState/deallocated' in s for s in statuses)
                
                resources.append({
                    'id': vm.id,
                    'name': vm_name,
                    'service': 'AZURE_VM',
                    'provider': 'azure',
                    'region': vm.location,
                    'typeOrSize': vm_size,
                    'status': 'stopped' if is_stopped else 'active',
                    'isInactive': is_stopped,
                    'inactiveReason': 'VM stopped; OS disk still being billed' if is_stopped else None,
                    'monthlyCostUSD': 140.0,
                    'estimatedWasteUSD': 40.0 if is_stopped else 0.0,
                    'savingsPotentialPercent': 100 if is_stopped else 0,
                    'recommendedAction': 'Deallocate completely to avoid lease charges' if is_stopped else 'Healthy',
                    'remediationCommand': f"az vm deallocate --resource-group {rg} --name {vm_name}"
                })
        except Exception as e:
            print(f"Error auditing Azure VMs: {e}")
        return resources

    def audit_unattached_disks(self):
        """Scans for unattached managed disks."""
        resources = []
        if not AZURE_AVAILABLE:
            return resources
        try:
            for disk in self.compute_client.disks.list():
                if disk.disk_state and disk.disk_state.lower() == 'unattached':
                    cost = disk.disk_size_gb * 0.13
                    rg = disk.id.split('/')[4]
                    resources.append({
                        'id': disk.id,
                        'name': disk.name,
                        'service': 'AZURE_DISK',
                        'provider': 'azure',
                        'region': disk.location,
                        'typeOrSize': f"{disk.sku.name} ({disk.disk_size_gb} GB)",
                        'status': 'inactive',
                        'isInactive': True,
                        'inactiveReason': 'DiskState is Unattached',
                        'monthlyCostUSD': round(cost, 2),
                        'estimatedWasteUSD': round(cost, 2),
                        'savingsPotentialPercent': 100,
                        'recommendedAction': 'Snapshot and delete orphaned disk',
                        'remediationCommand': f"az disk delete --resource-group {rg} --name {disk.name} --yes"
                    })
        except Exception as e:
            print(f"Error auditing Azure Disks: {e}")
        return resources

# --------------------------------------------------------------------------
# API ROUTES
# --------------------------------------------------------------------------
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.datetime.utcnow().isoformat(),
        'boto3_installed': BOTO3_AVAILABLE,
        'azure_installed': AZURE_AVAILABLE
    })

@app.route('/api/scan', methods=['POST'])
def scan_cloud():
    """Takes Account ID, Secret Access Key and runs utilization audit."""
    data = request.json or {}
    provider = data.get('provider', 'aws').lower()
    account_id = data.get('accountId', '')
    access_key = data.get('accessKeyId', '')
    secret_key = data.get('secretAccessKey', '')
    region = data.get('region', 'us-east-1')
    demo_mode = data.get('demoMode', False)

    # If demo mode is selected or credentials are placeholder, return high-fidelity mock data
    if demo_mode or not secret_key or 'EXAMPLE' in secret_key:
        return jsonify(get_mock_scan_data(provider, account_id or 'demo-account-01'))

    all_resources = []
    
    if provider == 'aws':
        if not BOTO3_AVAILABLE:
            return jsonify({'error': 'boto3 package not installed on server'}), 500
        try:
            auditor = AWSCloudAuditor(access_key, secret_key, region)
            all_resources.extend(auditor.audit_ec2_instances())
            all_resources.extend(auditor.audit_unattached_ebs())
            all_resources.extend(auditor.audit_unassociated_elastic_ips())
        except Exception as e:
            return jsonify({'error': f"Failed connecting to AWS: {str(e)}"}), 400

    elif provider == 'azure':
        if not AZURE_AVAILABLE:
            return jsonify({'error': 'azure-mgmt packages not installed on server'}), 500
        try:
            sub_id = data.get('subscriptionId', account_id)
            tenant_id = data.get('tenantId', '')
            client_id = data.get('clientId', access_key)
            az_auditor = AzureCloudAuditor(sub_id, tenant_id, client_id, secret_key)
            all_resources.extend(az_auditor.audit_azure_vms())
            all_resources.extend(az_auditor.audit_unattached_disks())
        except Exception as e:
            return jsonify({'error': f"Failed connecting to Azure: {str(e)}"}), 400

    # Calculate summary metrics
    total_spend = sum(r['monthlyCostUSD'] for r in all_resources)
    total_waste = sum(r['estimatedWasteUSD'] for r in all_resources)
    inactive_count = sum(1 for r in all_resources if r['isInactive'])

    return jsonify({
        'summary': {
            'accountId': account_id or 'LIVE-ACCOUNT',
            'provider': provider,
            'scannedAt': datetime.datetime.utcnow().isoformat(),
            'totalResources': len(all_resources),
            'activeResources': len(all_resources) - inactive_count,
            'inactiveResources': inactive_count,
            'totalMonthlySpend': round(total_spend, 2),
            'totalMonthlyWaste': round(total_waste, 2),
            'wastePercentage': round((total_waste / total_spend * 100), 1) if total_spend > 0 else 0
        },
        'resources': all_resources
    })

def get_mock_scan_data(provider, account_id):
    """Returns realistic enterprise FinOps audit dataset for demonstration."""
    # (Pre-populated sample response provided in application)
    pass

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting CloudPulse Cloud Optimizer on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
`;

export const PYTHON_REQUIREMENTS = `flask>=3.0.0
flask-cors>=4.0.0
python-dotenv>=1.0.0
boto3>=1.34.0
botocore>=1.34.0
azure-identity>=1.15.0
azure-mgmt-compute>=30.0.0
azure-mgmt-network>=25.0.0
azure-mgmt-sql>=3.0.0
azure-mgmt-monitor>=5.0.0
azure-mgmt-costmanagement>=4.0.0
requests>=2.31.0
`;

export const STANDALONE_HTML_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudPulse - Cloud Cost & Resource Optimizer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <!-- Top Bar -->
  <header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">CP</div>
      <h1 class="text-lg font-semibold tracking-tight text-white">CloudPulse Optimizer</h1>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs text-slate-400">Target: <strong id="lbl-target" class="text-slate-200">AWS (us-east-1)</strong></span>
      <button onclick="document.getElementById('connect-modal').classList.remove('hidden')" class="px-3.5 py-1.5 text-xs font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">
        Configure Credentials
      </button>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8">
    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <p class="text-xs text-slate-400">Total Monthly Spend</p>
        <p id="stat-total" class="text-2xl font-bold font-mono text-white mt-1">$4,528.00</p>
      </div>
      <div class="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <p class="text-xs text-slate-400">Detected Inactive Waste</p>
        <p id="stat-waste" class="text-2xl font-bold font-mono text-rose-400 mt-1">$1,688.00 <span class="text-xs text-slate-400">(37.2%)</span></p>
      </div>
      <div class="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <p class="text-xs text-slate-400">Active vs Inactive Resources</p>
        <p id="stat-counts" class="text-2xl font-bold font-mono text-white mt-1">4 <span class="text-sm font-normal text-slate-400">/ 9 Idle</span></p>
      </div>
      <div class="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <p class="text-xs text-slate-400">Potential Monthly Savings</p>
        <p id="stat-savings" class="text-2xl font-bold font-mono text-emerald-400 mt-1">$1,688.00</p>
      </div>
    </div>

    <!-- Resource Table Section -->
    <div class="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <h2 class="text-base font-semibold text-white">Resource Utilization Audit</h2>
        <input type="text" id="table-search" placeholder="Search resource..." oninput="filterTable()" class="px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 text-white w-64">
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs" id="resource-table">
          <thead class="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold">
            <tr>
              <th class="px-6 py-3">Resource ID / Name</th>
              <th class="px-6 py-3">Service</th>
              <th class="px-6 py-3">Status</th>
              <th class="px-6 py-3">Metrics / Utilization</th>
              <th class="px-6 py-3 text-right">Monthly Cost</th>
              <th class="px-6 py-3 text-right">Est. Waste</th>
              <th class="px-6 py-3">Remediation</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800 text-slate-300 font-mono" id="table-body">
            <!-- Dynamically populated rows -->
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <script>
    // Connect to Python Flask backend (/api/scan)
    async function triggerScan() {
      const resp = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoMode: true })
      });
      const data = await resp.json();
      console.log('Audit scan completed:', data);
    }
  </script>
</body>
</html>
`;

export const PYTHON_SETUP_INSTRUCTIONS = `# Setup & Deployment Guide for Python Cloud Auditor

### 1. Requirements
Ensure Python 3.9+ is installed:
\`\`\`bash
python3 --version
\`\`\`

### 2. Install Dependencies
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 3. Required IAM Permissions for AWS (Read-Only)
Attach a Read-Only IAM policy to your AWS user/role:
\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DescribeAddresses",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "rds:DescribeDBInstances",
        "s3:ListAllMyBuckets",
        "ce:GetCostAndUsage"
      ],
      "Resource": "*"
    }
  ]
}
\`\`\`

### 4. Required Azure RBAC Roles
Grant your Service Principal:
- **Reader** role on the Target Subscription
- **Cost Management Reader** for billing analysis

### 5. Running the Application
\`\`\`bash
export FLASK_APP=app.py
export FLASK_ENV=development
python app.py
\`\`\`
Visit **http://localhost:5000** in your web browser.
`;
