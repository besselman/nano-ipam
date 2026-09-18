import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { inspectHost, sweepSubnet } from '../lib/ping.js';
import { importCsvAllocations, importJsonBackup } from '../lib/importer.js';
import { isValidIpv4, parseCidr } from '../lib/cidr.js';

const router = Router();

// GET /api/network/ping/:ip - Ping single host & resolve MAC
router.get('/ping/:ip', async (req: Request, res: Response) => {
  try {
    const ip = String(req.params.ip);
    if (!isValidIpv4(ip)) {
      return res.status(400).json({ error: `Invalid IPv4 address: ${ip}` });
    }

    const timeout = Number(req.query.timeout) || 1000;
    const result = await inspectHost(ip, timeout);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/network/sweep/:subnetId - Sweep subnet or its allocations
router.post('/sweep/:subnetId', async (req: Request, res: Response) => {
  try {
    const subnetId = Number(req.params.subnetId);
    const subnet = db.getSubnetById(subnetId);
    if (!subnet) {
      return res.status(404).json({ error: 'Subnet not found' });
    }

    const mode = req.body.mode || (typeof req.query.mode === 'string' ? req.query.mode : 'all');
    const concurrency = Number(req.body.concurrency || req.query.concurrency) || 25;
    const timeoutMs = Number(req.body.timeoutMs || req.query.timeoutMs) || 800;

    let target: string | string[];
    const existingAllocations = db.getAllocationsBySubnet(subnetId);
    const allocatedIps = new Set(existingAllocations.map(a => a.ip));

    if (mode === 'allocated') {
      target = Array.from(allocatedIps);
      if (target.length === 0) {
        return res.json({
          subnetId,
          cidr: subnet.cidr,
          scannedCount: 0,
          aliveCount: 0,
          results: [],
          unallocatedAlive: []
        });
      }
    } else {
      target = subnet.cidr;
    }

    const results = await sweepSubnet(target, { concurrency, timeoutMs });
    
    // Identify responsive hosts that are NOT currently in the allocation table
    const unallocatedAlive = results.filter(r => r.alive && !allocatedIps.has(r.ip));
    const aliveCount = results.filter(r => r.alive).length;

    res.json({
      subnetId,
      cidr: subnet.cidr,
      scannedCount: results.length,
      aliveCount,
      results,
      unallocatedAlive,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/network/import - Import JSON backup or CSV spreadsheet
router.post('/import', (req: Request, res: Response) => {
  try {
    const { format, data, csv, subnet_id, subnetId, mode } = req.body;
    const targetSubnetId = subnet_id || subnetId || null;

    if (format === 'csv' || csv) {
      const csvText = String(csv || data || '');
      if (!csvText.trim()) {
        return res.status(400).json({ error: 'No CSV content provided' });
      }
      const summary = importCsvAllocations(csvText, targetSubnetId ? Number(targetSubnetId) : null);
      return res.json({
        success: true,
        type: 'csv',
        summary,
      });
    }

    // Default to JSON import
    const jsonPayload = data || req.body;
    const summary = importJsonBackup(jsonPayload, { mode: mode === 'replace' ? 'replace' : 'merge' });
    res.json({
      success: true,
      type: 'json',
      summary,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;