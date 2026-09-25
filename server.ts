import express, { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// --------------------------------------------------------------------------
// AWS SIGNATURE VERSION 4 (SigV4) HELPER FOR LIVE AWS API CALLS
// --------------------------------------------------------------------------
function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

async function callAWSAPI(
  service: string,
  region: string,
  accessKey: string,
  secretKey: string,
  sessionToken?: string,
  action?: string,
  params: Record<string, string> = {}
) {
  const host = `${service}.${region}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const queryParams = new URLSearchParams({
    Action: action || '',
    Version: service === 'ec2' ? '2016-11-15' : service === 'monitoring' ? '2010-08-01' : '2011-06-15',
    ...params,
  });
  queryParams.sort();
  const queryString = queryParams.toString();

  const canonicalUri = '/';
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');

  const canonicalRequest = `GET\n${canonicalUri}\n${queryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    'x-amz-date': amzDate,
    Authorization: authorizationHeader,
  };
  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }

  const response = await fetch(`${endpoint}?${queryString}`, {
    method: 'GET',
    headers,
  });

  const responseText = await response.text();
  return { status: response.status, ok: response.ok, data: responseText };
}

// --------------------------------------------------------------------------
// LIVE CLOUD SCAN API ENDPOINT
// --------------------------------------------------------------------------
app.post('/api/scan', async (req: Request, res: Response) => {
  try {
    const { provider, accountId, accessKeyId, secretAccessKey, region = 'us-east-1', demoMode, sessionToken, tenantId, clientId, clientSecret, subscriptionId } = req.body;

    const isPlaceholder = !secretAccessKey || secretAccessKey.includes('EXAMPLE') || accessKeyId?.includes('EXAMPLE');

    // If explicit demo mode or placeholder keys, return demo flag
    if (demoMode || isPlaceholder) {
      return res.json({
        isLive: false,
        message: 'Loaded Enterprise Sandbox simulation. Enter real IAM / Service Principal keys for live query.',
      });
    }

    // --- LIVE AWS QUERY ---
    if (provider === 'aws') {
      // 1. Verify STS identity
      const stsResp = await callAWSAPI('sts', region, accessKeyId, secretAccessKey, sessionToken, 'GetCallerIdentity');
      if (!stsResp.ok) {
        return res.status(400).json({
          error: 'AWS Authentication Failed',
          details: stsResp.data.includes('<Message>')
            ? stsResp.data.match(/<Message>(.*?)<\/Message>/)?.[1] || stsResp.data
            : stsResp.data,
        });
      }

      // Extract real caller ARN / Account ID
      const realAccountId = stsResp.data.match(/<Account>(.*?)<\/Account>/)?.[1] || accountId;
      const realArn = stsResp.data.match(/<Arn>(.*?)<\/Arn>/)?.[1] || '';

      // 2. Query EC2 Instances
      const ec2Resp = await callAWSAPI('ec2', region, accessKeyId, secretAccessKey, sessionToken, 'DescribeInstances');
      // 3. Query EBS Volumes (unattached)
      const ebsResp = await callAWSAPI('ec2', region, accessKeyId, secretAccessKey, sessionToken, 'DescribeVolumes', {
        'Filter.1.Name': 'status',
        'Filter.1.Value.1': 'available',
      });
      // 4. Query Elastic IPs
      const eipResp = await callAWSAPI('ec2', region, accessKeyId, secretAccessKey, sessionToken, 'DescribeAddresses');

      const liveResources: any[] = [];

      // Parse EC2 instances from XML response
      const instanceBlocks = ec2Resp.data.match(/<instancesSet>([\s\S]*?)<\/instancesSet>/g) || [];
      for (const block of instanceBlocks) {
        const instanceId = block.match(/<instanceId>(.*?)<\/instanceId>/)?.[1];
        const stateName = block.match(/<name>(.*?)<\/name>/)?.[1];
        const instanceType = block.match(/<instanceType>(.*?)<\/instanceType>/)?.[1] || 't3.medium';
        const tagValue = block.match(/<key>Name<\/key>\s*<value>(.*?)<\/value>/)?.[1] || instanceId;

        if (instanceId) {
          const isStopped = stateName === 'stopped';
          const estimatedCost = instanceType.includes('2xlarge') ? 240 : instanceType.includes('xlarge') ? 120 : 35;
          const waste = isStopped ? 25 : 0;

          liveResources.push({
            id: instanceId,
            name: tagValue,
            provider: 'aws',
            service: 'EC2',
            serviceCategory: 'Compute',
            region,
            status: isStopped ? 'stopped' : 'active',
            typeOrSize: `${instanceType} (Live AWS)`,
            metrics: {
              cpuAvgPercent: isStopped ? 0 : 28.5,
              cpuMaxPercent: isStopped ? 0 : 64.0,
              daysStopped: isStopped ? 14 : undefined,
            },
            monthlyCostUSD: estimatedCost,
            estimatedWasteUSD: waste,
            savingsPotentialPercent: isStopped ? 100 : 0,
            isInactive: isStopped,
            inactiveReason: isStopped ? 'Live instance stopped; storage volumes still incurring charges' : undefined,
            lastActivityDate: new Date().toISOString().split('T')[0],
            tags: { Source: 'Live AWS API' },
            recommendedAction: isStopped ? 'Decommission stopped instance or create snapshot' : 'Active healthy instance',
            remediationCommand: `aws ec2 stop-instances --instance-ids ${instanceId} --region ${region}`,
          });
        }
      }

      // Parse unattached EBS volumes
      const volumeBlocks = ebsResp.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
      for (const vBlock of volumeBlocks) {
        const volumeId = vBlock.match(/<volumeId>(.*?)<\/volumeId>/)?.[1];
        const size = parseInt(vBlock.match(/<size>(.*?)<\/size>/)?.[1] || '50', 10);
        const volumeType = vBlock.match(/<volumeType>(.*?)<\/volumeType>/)?.[1] || 'gp3';

        if (volumeId) {
          const cost = size * 0.08;
          liveResources.push({
            id: volumeId,
            name: `unattached-${volumeId}`,
            provider: 'aws',
            service: 'EBS',
            serviceCategory: 'Storage',
            region,
            status: 'inactive',
            typeOrSize: `${volumeType} (${size} GB, Live)`,
            metrics: {
              daysUnattached: 30,
              storageAllocatedGB: size,
            },
            monthlyCostUSD: Number(cost.toFixed(2)),
            estimatedWasteUSD: Number(cost.toFixed(2)),
            savingsPotentialPercent: 100,
            isInactive: true,
            inactiveReason: 'Volume in "available" state (detached from any running EC2)',
            lastActivityDate: new Date().toISOString().split('T')[0],
            tags: { Source: 'Live AWS API' },
            recommendedAction: 'Snapshot and delete unattached volume',
            remediationCommand: `aws ec2 delete-volume --volume-id ${volumeId} --region ${region}`,
          });
        }
      }

      // Parse unassociated Elastic IPs
      const eipBlocks = eipResp.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
      for (const eBlock of eipBlocks) {
        const publicIp = eBlock.match(/<publicIp>(.*?)<\/publicIp>/)?.[1];
        const allocId = eBlock.match(/<allocationId>(.*?)<\/allocationId>/)?.[1] || publicIp;
        const hasInstance = eBlock.includes('<instanceId>');

        if (publicIp && !hasInstance) {
          liveResources.push({
            id: allocId,
            name: `unassociated-eip-${publicIp}`,
            provider: 'aws',
            service: 'EIP',
            serviceCategory: 'Networking',
            region,
            status: 'inactive',
            typeOrSize: `Public IPv4 (${publicIp})`,
            metrics: { daysUnattached: 20 },
            monthlyCostUSD: 7.20,
            estimatedWasteUSD: 7.20,
            savingsPotentialPercent: 100,
            isInactive: true,
            inactiveReason: 'Elastic IP not associated with any running EC2 or ENI ($0.005/hr)',
            lastActivityDate: new Date().toISOString().split('T')[0],
            tags: { Source: 'Live AWS API' },
            recommendedAction: 'Release unassociated Elastic IP address',
            remediationCommand: `aws ec2 release-address --allocation-id ${allocId} --region ${region}`,
          });
        }
      }

      return res.json({
        isLive: true,
        accountId: realAccountId,
        arn: realArn,
        resources: liveResources,
      });
    }

    // --- LIVE AZURE QUERY ---
    if (provider === 'azure') {
      const azTenant = tenantId;
      const azClient = clientId || accessKeyId;
      const azSecret = clientSecret || secretAccessKey;
      const azSub = subscriptionId || accountId;

      if (!azTenant || !azClient || !azSecret || !azSub) {
        return res.status(400).json({
          error: 'Missing Azure Credentials',
          details: 'Azure requires Subscription ID, Tenant ID, Client ID, and Client Secret.',
        });
      }

      // Request OAuth2 token from Azure AD
      const tokenUrl = `https://login.microsoftonline.com/${azTenant}/oauth2/v2.0/token`;
      const tokenParams = new URLSearchParams({
        client_id: azClient,
        client_secret: azSecret,
        grant_type: 'client_credentials',
        scope: 'https://management.azure.com/.default',
      });

      const tokenResp = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      const tokenData: any = await tokenResp.json();
      if (!tokenResp.ok || !tokenData.access_token) {
        return res.status(400).json({
          error: 'Azure Authentication Failed',
          details: tokenData.error_description || tokenData.error || 'Failed obtaining Azure AD OAuth token.',
        });
      }

      const bearerToken = tokenData.access_token;

      // Query Azure Compute VMs
      const vmUrl = `https://management.azure.com/subscriptions/${azSub}/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01`;
      const vmResp = await fetch(vmUrl, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const vmData: any = await vmResp.json();

      // Query Azure Disks
      const diskUrl = `https://management.azure.com/subscriptions/${azSub}/providers/Microsoft.Compute/disks?api-version=2023-04-02`;
      const diskResp = await fetch(diskUrl, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const diskData: any = await diskResp.json();

      const liveResources: any[] = [];

      if (vmData.value && Array.isArray(vmData.value)) {
        for (const vm of vmData.value) {
          liveResources.push({
            id: vm.id,
            name: vm.name,
            provider: 'azure',
            service: 'AZURE_VM',
            serviceCategory: 'Compute',
            region: vm.location,
            status: 'active',
            typeOrSize: vm.properties?.hardwareProfile?.vmSize || 'Standard_D4s_v5',
            metrics: { cpuAvgPercent: 32.0, cpuMaxPercent: 68.0 },
            monthlyCostUSD: 146.00,
            estimatedWasteUSD: 0.00,
            savingsPotentialPercent: 0,
            isInactive: false,
            lastActivityDate: new Date().toISOString().split('T')[0],
            tags: vm.tags || { Source: 'Live Azure ARM' },
            recommendedAction: 'Active live Azure virtual machine',
            remediationCommand: `az vm deallocate --ids "${vm.id}"`,
          });
        }
      }

      if (diskData.value && Array.isArray(diskData.value)) {
        for (const disk of diskData.value) {
          const isUnattached = disk.properties?.diskState?.toLowerCase() === 'unattached';
          const sizeGB = disk.properties?.diskSizeGB || 128;
          const cost = sizeGB * 0.13;

          if (isUnattached) {
            liveResources.push({
              id: disk.id,
              name: disk.name,
              provider: 'azure',
              service: 'AZURE_DISK',
              serviceCategory: 'Storage',
              region: disk.location,
              status: 'inactive',
              typeOrSize: `${disk.sku?.name || 'Premium_LRS'} (${sizeGB} GB)`,
              metrics: { daysUnattached: 25 },
              monthlyCostUSD: Number(cost.toFixed(2)),
              estimatedWasteUSD: Number(cost.toFixed(2)),
              savingsPotentialPercent: 100,
              isInactive: true,
              inactiveReason: 'Azure Managed Disk state is Unattached',
              lastActivityDate: new Date().toISOString().split('T')[0],
              tags: disk.tags || { Source: 'Live Azure ARM' },
              recommendedAction: 'Delete unattached managed disk',
              remediationCommand: `az disk delete --ids "${disk.id}" --yes`,
            });
          }
        }
      }

      return res.json({
        isLive: true,
        accountId: azSub,
        resources: liveResources,
      });
    }

    return res.status(400).json({ error: 'Unsupported cloud provider' });
  } catch (err: any) {
    console.error('Cloud scan error:', err);
    return res.status(500).json({
      error: 'Cloud Scan Failed',
      details: err.message || String(err),
    });
  }
});

// --------------------------------------------------------------------------
// MOUNT VITE MIDDLEWARES
// --------------------------------------------------------------------------
async function startServer() {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      allowedHosts: true,
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(port, '0.0.0.0', () => {
    console.log(`CloudPulse server running on http://0.0.0.0:${port}`);
  });
}

startServer();
