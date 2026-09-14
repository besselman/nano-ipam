import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { parseCidr } from '../lib/cidr.js';

const router = Router();

// GET global system statistics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const rawStats = db.getStats();
    const subnets = db.getAllSubnets();

    let totalUsableHosts = 0;
    for (const s of subnets) {
      try {
        const info = parseCidr(s.cidr);
        totalUsableHosts += info.usableHosts;
      } catch {
        // Skip invalid
      }
    }

    const availableIps = Math.max(0, totalUsableHosts - rawStats.totalAllocated);
    const overallUtilization = totalUsableHosts > 0 
      ? Math.round((rawStats.totalAllocated / totalUsableHosts) * 100) 
      : 0;

    res.json({
      ...rawStats,
      totalUsableHosts,
      availableIps,
      overallUtilization,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET global search
router.get('/search', (req: Request, res: Response) => {
  try {
    const query = req.query.q ? String(req.query.q).trim() : '';
    if (!query) {
      return res.json({ subnets: [], allocations: [] });
    }
    const results = db.search(query);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET audit log
router.get('/audit', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = db.getAuditLogs(limit);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET full export JSON (for backup or migration)
router.get('/export', (req: Request, res: Response) => {
  try {
    const subnets = db.getAllSubnets();
    const data = subnets.map(s => {
      const allocations = db.getAllocationsBySubnet(s.id);
      return {
        ...s,
        allocations
      };
    });

    res.setHeader('Content-Disposition', 'attachment; filename=nano-ipam-export.json');
    res.setHeader('Content-Type', 'application/json');
    res.json({
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      subnets: data
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
