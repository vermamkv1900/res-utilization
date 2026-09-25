# CloudPulse - Cloud Cost & Resource Optimizer

A complete Python and HTML solution for scanning cloud infrastructure (AWS and Microsoft Azure) to identify active vs inactive resources, track monthly usage trends, calculate wasted spend, and apply cost-reduction optimizations.

## Architecture
- **Backend**: Python 3.9+ with Flask, Boto3 (AWS SDK), and Azure Management SDKs
- **Frontend**: Standalone HTML5 + Tailwind CSS + Tabular figures (no complex build tool required for Python standalone deployment)
- **Monitoring APIs Integrated**:
  - **AWS CloudWatch**: CPUUtilization, NetworkIn, NetworkOut metrics
  - **AWS EC2 & EBS**: Instance state, unattached EBS volume detection, unassociated Elastic IPs
  - **AWS RDS**: Database connection count and Multi-AZ replica utilization
  - **AWS Cost Explorer (CE)**: Monthly usage trends and spend breakdown
  - **Azure Monitor**: Percentage CPU, Network In Total
  - **Azure Compute**: Virtual Machine power states, unattached Managed Disks
  - **Azure Cost Management**: Monthly billing query

## Quick Start
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python app.py
   ```

3. Open your browser:
   `http://localhost:5000`

## Production AWS IAM Policy (Least Privilege)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DescribeAddresses",
        "ec2:DescribeLoadBalancers",
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
```
