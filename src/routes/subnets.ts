import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { parseCidr, subnetsOverlap, findNextAvailableIp, isValidIpv4 } from '../lib/cidr.js';

const router = Router();

// GET all subnets with calculated statistics
router.get('/', (req: Request, res: Response) => {
  try {
    const rawSubnets = db.getAllSubnets();
    const subnetsWithStats = rawSubnets.map(sub => {
      let cidrInfo;
      try {
        cidrInfo = parseCidr(sub.cidr);
      } catch {
        cidrInfo = null;
      }

      const allocations = db.getAllocationsBySubnet(sub.id);
      const allocatedCount = allocations.length;
      const usableHosts = cidrInfo ? cidrInfo.usableHosts : 0;
      const percentUsed = usableHosts > 0 ? Math.min(100, Math.round((allocatedCount / usableHosts) * 100)) : 0;

      return {
        ...sub,
        cidrInfo,
        stats: {
          allocatedCount,
          usableHosts,
          availableCount: Math.max(0, usableHosts - allocatedCount),
          percentUsed,
        }
      };
    });

    res.json(subnetsWithStats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single subnet detail
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const subnet = db.getSubnetById(id);
    if (!subnet) {
      return res.status(404).json({ error: 'Subnet not found' });
    }

    const cidrInfo = parseCidr(subnet.cidr);
    const allocations = db.getAllocationsBySubnet(id);
    const allocatedIps = allocations.map(a => a.ip);
    const nextAvailableIp = findNextAvailableIp(subnet.cidr, allocatedIps, subnet.gateway || undefined);

    const allocatedCount = allocations.length;
    const usableHosts = cidrInfo.usableHosts;
    const percentUsed = usableHosts > 0 ? Math.min(100, Math.round((allocatedCount / usableHosts) * 100)) : 0;

    res.json({
      ...subnet,
      cidrInfo,
      allocations,
      nextAvailableIp,
      stats: {
        allocatedCount,
        usableHosts,
        availableCount: Math.max(0, usableHosts - allocatedCount),
        percentUsed,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET next available IP for subnet
router.get('/:id/next-available', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const subnet = db.getSubnetById(id);
    if (!subnet) {
      return res.status(404).json({ error: 'Subnet not found' });
    }

    const allocations = db.getAllocationsBySubnet(id);
    const allocatedIps = allocations.map(a => a.ip);
    const nextAvailableIp = findNextAvailableIp(subnet.cidr, allocatedIps, subnet.gateway || undefined);

    res.json({
      subnetId: id,
      cidr: subnet.cidr,
      nextAvailableIp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new subnet
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, cidr, vlan, gateway, dns, description, site, allowOverlap, autoReserveGateway } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Subnet name is required' });
    }
    if (!cidr || typeof cidr !== 'string') {
      return res.status(400).json({ error: 'CIDR is required (e.g. 192.168.1.0/24)' });
    }

    // Validate CIDR
    let parsed;
    try {
      parsed = parseCidr(cidr);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    // Validate gateway if provided
    if (gateway && !isValidIpv4(gateway)) {
      return res.status(400).json({ error: `Invalid gateway IP address: ${gateway}` });
    }

    // Check for overlapping existing subnets
    const existing = db.getAllSubnets();
    for (const sub of existing) {
      if (sub.cidr === parsed.cidr) {
        return res.status(409).json({
          error: `A subnet with CIDR ${parsed.cidr} already exists: "${sub.name}"`,
          conflictingSubnet: sub
        });
      }

      if (!allowOverlap && subnetsOverlap(parsed.cidr, sub.cidr)) {
        return res.status(409).json({
          error: `CIDR ${parsed.cidr} overlaps with existing subnet "${sub.name}" (${sub.cidr})`,
          conflictingSubnet: sub,
          canOverride: true
        });
      }
    }

    const created = db.createSubnet({
      name: name.trim(),
      cidr: parsed.cidr,
      vlan: vlan ? Number(vlan) : null,
      gateway: gateway ? gateway.trim() : null,
      dns: dns ? dns.trim() : null,
      description: description ? description.trim() : null,
      site: site ? site.trim() : null,
    });

    // Auto-reserve gateway IP if requested and valid
    if (gateway && autoReserveGateway) {
      try {
        db.createAllocation({
          subnet_id: created.id,
          ip: gateway.trim(),
          hostname: 'default-gateway',
          device_type: 'gateway',
          status: 'reserved',
          description: 'Subnet Default Gateway'
        });
      } catch {
        // Ignore if allocation fails
      }
    }

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update subnet
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, vlan, gateway, dns, description, site } = req.body;

    if (gateway && !isValidIpv4(gateway)) {
      return res.status(400).json({ error: `Invalid gateway IP address: ${gateway}` });
    }

    const updated = db.updateSubnet(id, {
      name: name !== undefined ? String(name).trim() : undefined,
      vlan: vlan !== undefined ? (vlan ? Number(vlan) : null) : undefined,
      gateway: gateway !== undefined ? (gateway ? String(gateway).trim() : null) : undefined,
      dns: dns !== undefined ? (dns ? String(dns).trim() : null) : undefined,
      description: description !== undefined ? (description ? String(description).trim() : null) : undefined,
      site: site !== undefined ? (site ? String(site).trim() : null) : undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Subnet not found' });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE subnet
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const success = db.deleteSubnet(id);
    if (!success) {
      return res.status(404).json({ error: 'Subnet not found' });
    }
    res.json({ message: 'Subnet deleted successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
