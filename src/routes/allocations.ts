import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { isIpInSubnet, isValidIpv4, isValidMac, normalizeMac, findNextAvailableIp, parseCidr } from '../lib/cidr.js';

const router = Router();

// GET all allocations (optionally filtered by subnetId / subnet_id)
router.get('/', (req: Request, res: Response) => {
  try {
    const rawSubnetId = req.query.subnet_id || req.query.subnetId;
    if (rawSubnetId) {
      const subnetId = Number(rawSubnetId);
      const allocations = db.getAllocationsBySubnet(subnetId);
      return res.json(allocations);
    }

    // Return all allocations across all subnets
    const subnets = db.getAllSubnets();
    const all = subnets.flatMap(s => db.getAllocationsBySubnet(s.id));
    res.json(all);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET next-available IP for a subnet via query param
router.get('/next-available', (req: Request, res: Response) => {
  try {
    const rawSubnetId = req.query.subnet_id || req.query.subnetId;
    if (!rawSubnetId) {
      return res.status(400).json({ error: 'subnetId or subnet_id query parameter is required' });
    }

    const subnetId = Number(rawSubnetId);
    const subnet = db.getSubnetById(subnetId);
    if (!subnet) {
      return res.status(404).json({ error: 'Subnet not found' });
    }

    const allocations = db.getAllocationsBySubnet(subnetId);
    const allocatedIps = allocations.map(a => a.ip);
    const nextAvailableIp = findNextAvailableIp(subnet.cidr, allocatedIps, subnet.gateway || undefined);

    res.json({
      subnetId,
      cidr: subnet.cidr,
      nextAvailableIp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST allocate an IP address
router.post('/', (req: Request, res: Response) => {
  try {
    const subnet_id = req.body.subnet_id !== undefined ? req.body.subnet_id : req.body.subnetId;
    let ip = req.body.ip !== undefined ? req.body.ip : req.body.ipAddress;
    const hostname = req.body.hostname;
    const mac = req.body.mac !== undefined ? req.body.mac : req.body.macAddress;
    const device_type = req.body.device_type !== undefined ? req.body.device_type : req.body.deviceType;
    const status = req.body.status;
    const owner = req.body.owner;
    const description = req.body.description !== undefined ? req.body.description : req.body.desc;

    if (!subnet_id) {
      return res.status(400).json({ error: 'subnet_id or subnetId is required' });
    }

    const subnet = db.getSubnetById(Number(subnet_id));
    if (!subnet) {
      return res.status(404).json({ error: 'Subnet not found' });
    }

    // If IP is omitted or set to 'auto', allocate the next available IP
    if (!ip || String(ip).trim().toLowerCase() === 'auto') {
      const existingAllocations = db.getAllocationsBySubnet(subnet.id);
      const allocatedIps = existingAllocations.map(a => a.ip);
      const nextIp = findNextAvailableIp(subnet.cidr, allocatedIps, subnet.gateway || undefined);

      if (!nextIp) {
        return res.status(400).json({ error: 'No available IP addresses left in this subnet' });
      }
      ip = nextIp;
    } else {
      ip = String(ip).trim();
      if (!isValidIpv4(ip)) {
        return res.status(400).json({ error: `Invalid IPv4 address format: ${ip}` });
      }
      if (!isIpInSubnet(ip, subnet.cidr)) {
        return res.status(400).json({ error: `IP ${ip} does not belong to subnet ${subnet.cidr}` });
      }
    }

    // Check if IP is already allocated
    const existing = db.getAllocationByIp(subnet.id, ip);
    if (existing) {
      return res.status(409).json({
        error: `IP ${ip} is already allocated in this subnet`,
        existingAllocation: existing
      });
    }

    // Validate MAC if provided
    let normalizedMac = null;
    if (mac && String(mac).trim()) {
      if (!isValidMac(String(mac))) {
        return res.status(400).json({ error: `Invalid MAC address format: ${mac}` });
      }
      normalizedMac = normalizeMac(String(mac));
    }

    const created = db.createAllocation({
      subnet_id: subnet.id,
      ip,
      hostname: hostname ? String(hostname).trim() : null,
      mac: normalizedMac,
      device_type: device_type ? String(device_type).trim() : 'other',
      status: ['active', 'reserved', 'dhcp', 'deprecated'].includes(status) ? status : 'active',
      owner: owner ? String(owner).trim() : null,
      description: description ? String(description).trim() : null,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single allocation
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const allocation = db.getAllocationById(id);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }
    res.json(allocation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update allocation
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const hostname = req.body.hostname;
    const mac = req.body.mac !== undefined ? req.body.mac : req.body.macAddress;
    const device_type = req.body.device_type !== undefined ? req.body.device_type : req.body.deviceType;
    const status = req.body.status;
    const owner = req.body.owner;
    const description = req.body.description !== undefined ? req.body.description : req.body.desc;

    let normalizedMac: string | null | undefined = undefined;
    if (mac !== undefined) {
      if (mac && String(mac).trim()) {
        if (!isValidMac(String(mac))) {
          return res.status(400).json({ error: `Invalid MAC address format: ${mac}` });
        }
        normalizedMac = normalizeMac(String(mac));
      } else {
        normalizedMac = null;
      }
    }

    const updated = db.updateAllocation(id, {
      hostname: hostname !== undefined ? (hostname ? String(hostname).trim() : null) : undefined,
      mac: normalizedMac,
      device_type: device_type !== undefined ? String(device_type).trim() : undefined,
      status: status && ['active', 'reserved', 'dhcp', 'deprecated'].includes(status) ? status : undefined,
      owner: owner !== undefined ? (owner ? String(owner).trim() : null) : undefined,
      description: description !== undefined ? (description ? String(description).trim() : null) : undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE release an IP allocation
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const success = db.deleteAllocation(id);
    if (!success) {
      return res.status(404).json({ error: 'Allocation not found' });
    }
    res.json({ message: 'IP released successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;