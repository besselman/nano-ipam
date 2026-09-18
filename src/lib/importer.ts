import db, { SubnetRecord, AllocationRecord } from '../db/database.js';
import { parseCidr, isValidIpv4, isValidMac, normalizeMac, isIpInSubnet } from './cidr.js';

export interface CsvAllocationRow {
  ip: string;
  hostname?: string | null;
  mac?: string | null;
  device_type?: string;
  status?: 'active' | 'reserved' | 'dhcp' | 'deprecated';
  owner?: string | null;
  description?: string | null;
  subnet_cidr?: string;
}

export interface ImportSummary {
  subnetsCreated: number;
  subnetsUpdated: number;
  allocationsCreated: number;
  allocationsUpdated: number;
  errors: string[];
}

/**
 * Parses CSV text into normalized row objects
 */
export function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [];

  // Parse header line
  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Imports CSV records into a subnet or auto-routes them by IP
 */
export function importCsvAllocations(
  csvText: string,
  targetSubnetId?: number | null
): ImportSummary {
  const rows = parseCsv(csvText);
  const summary: ImportSummary = {
    subnetsCreated: 0,
    subnetsUpdated: 0,
    allocationsCreated: 0,
    allocationsUpdated: 0,
    errors: [],
  };

  const allSubnets = db.getAllSubnets();
  let defaultSubnet: SubnetRecord | undefined;
  if (targetSubnetId) {
    defaultSubnet = db.getSubnetById(targetSubnetId);
  }

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNum = index + 2;

    const ip = row.ip || row.ip_address || row.ipaddress || row.address;
    if (!ip || !isValidIpv4(ip)) {
      summary.errors.push(`Row ${rowNum}: Invalid or missing IPv4 address "${ip}"`);
      continue;
    }

    // Determine target subnet
    let subnet = defaultSubnet;
    const cidrField = row.subnet || row.subnet_cidr || row.cidr;
    if (cidrField) {
      subnet = allSubnets.find(s => s.cidr === cidrField);
    }

    if (!subnet) {
      // Try to find matching subnet by IP
      subnet = allSubnets.find(s => isIpInSubnet(ip, s.cidr));
    }

    if (!subnet) {
      summary.errors.push(`Row ${rowNum}: IP ${ip} does not match any existing subnet`);
      continue;
    }

    // Parse MAC
    let mac: string | null = null;
    const rawMac = row.mac || row.mac_address || row.macaddress || row.hwaddr;
    if (rawMac && isValidMac(rawMac)) {
      mac = normalizeMac(rawMac);
    }

    // Parse Status
    let status: 'active' | 'reserved' | 'dhcp' | 'deprecated' = 'active';
    const rawStatus = (row.status || '').toLowerCase();
    if (['active', 'reserved', 'dhcp', 'deprecated'].includes(rawStatus)) {
      status = rawStatus as any;
    }

    const hostname = row.hostname || row.host || row.name || null;
    const deviceType = row.device_type || row.devicetype || row.type || 'other';
    const owner = row.owner || row.user || null;
    const description = row.description || row.desc || row.notes || null;

    // Check existing allocation
    const existing = db.getAllocationByIp(subnet.id, ip);
    if (existing) {
      db.updateAllocation(existing.id, {
        hostname: hostname ?? existing.hostname,
        mac: mac ?? existing.mac,
        device_type: deviceType ?? existing.device_type,
        status: status ?? existing.status,
        owner: owner ?? existing.owner,
        description: description ?? existing.description,
      });
      summary.allocationsUpdated++;
    } else {
      try {
        db.createAllocation({
          subnet_id: subnet.id,
          ip,
          hostname,
          mac,
          device_type: deviceType,
          status,
          owner,
          description,
        });
        summary.allocationsCreated++;
      } catch (err: any) {
        summary.errors.push(`Row ${rowNum} (${ip}): ${err.message}`);
      }
    }
  }

  return summary;
}

/**
 * Imports full JSON backup
 */
export function importJsonBackup(
  jsonData: any,
  options: { mode?: 'merge' | 'replace' } = {}
): ImportSummary {
  const summary: ImportSummary = {
    subnetsCreated: 0,
    subnetsUpdated: 0,
    allocationsCreated: 0,
    allocationsUpdated: 0,
    errors: [],
  };

  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Invalid JSON payload');
  }

  const subnetsList: any[] = Array.isArray(jsonData.subnets) ? jsonData.subnets : [];
  if (subnetsList.length === 0) {
    throw new Error('No subnets found in import payload');
  }

  if (options.mode === 'replace') {
    const existing = db.getAllSubnets();
    for (const sub of existing) {
      db.deleteSubnet(sub.id);
    }
  }

  for (const subData of subnetsList) {
    if (!subData.cidr || !subData.name) {
      summary.errors.push(`Subnet skipped: missing CIDR or name`);
      continue;
    }

    let parsedCidr;
    try {
      parsedCidr = parseCidr(subData.cidr);
    } catch (err: any) {
      summary.errors.push(`Subnet ${subData.cidr} error: ${err.message}`);
      continue;
    }

    let subnet = db.getSubnetByCidr(parsedCidr.cidr);
    if (subnet) {
      db.updateSubnet(subnet.id, {
        name: subData.name,
        vlan: subData.vlan !== undefined ? subData.vlan : (subData.vlanId !== undefined ? subData.vlanId : undefined),
        gateway: subData.gateway,
        dns: subData.dns,
        description: subData.description,
        site: subData.site,
      });
      summary.subnetsUpdated++;
    } else {
      try {
        subnet = db.createSubnet({
          name: subData.name,
          cidr: parsedCidr.cidr,
          vlan: subData.vlan !== undefined ? subData.vlan : (subData.vlanId !== undefined ? subData.vlanId : undefined),
          gateway: subData.gateway,
          dns: subData.dns,
          description: subData.description,
          site: subData.site,
        });
        summary.subnetsCreated++;
      } catch (err: any) {
        summary.errors.push(`Failed to create subnet ${subData.cidr}: ${err.message}`);
        continue;
      }
    }

    const allocations = Array.isArray(subData.allocations) ? subData.allocations : [];
    for (const alloc of allocations) {
      const ip = alloc.ip || alloc.ipAddress;
      if (!ip || !isValidIpv4(ip)) {
        summary.errors.push(`Invalid IP skipped: ${ip}`);
        continue;
      }

      const existingAlloc = db.getAllocationByIp(subnet.id, ip);
      let mac = alloc.mac || alloc.macAddress || null;
      if (mac && isValidMac(mac)) {
        mac = normalizeMac(mac);
      } else {
        mac = null;
      }

      if (existingAlloc) {
        db.updateAllocation(existingAlloc.id, {
          hostname: alloc.hostname ?? existingAlloc.hostname,
          mac: mac ?? existingAlloc.mac,
          device_type: alloc.device_type ?? alloc.deviceType ?? existingAlloc.device_type,
          status: alloc.status ?? existingAlloc.status,
          owner: alloc.owner ?? existingAlloc.owner,
          description: alloc.description ?? existingAlloc.description,
        });
        summary.allocationsUpdated++;
      } else {
        try {
          db.createAllocation({
            subnet_id: subnet.id,
            ip,
            hostname: alloc.hostname || null,
            mac,
            device_type: alloc.device_type || alloc.deviceType || 'other',
            status: alloc.status || 'active',
            owner: alloc.owner || null,
            description: alloc.description || null,
          });
          summary.allocationsCreated++;
        } catch (err: any) {
          summary.errors.push(`Failed to allocate ${ip}: ${err.message}`);
        }
      }
    }
  }

  return summary;
}