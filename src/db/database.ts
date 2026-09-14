import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export interface SubnetRecord {
  id: number;
  name: string;
  cidr: string;
  vlan: number | null;
  gateway: string | null;
  dns: string | null;
  description: string | null;
  site: string | null;
  created_at: string;
  updated_at: string;
}

export interface AllocationRecord {
  id: number;
  subnet_id: number;
  ip: string;
  hostname: string | null;
  mac: string | null;
  device_type: string;
  status: 'active' | 'reserved' | 'dhcp' | 'deprecated';
  owner: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditRecord {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

class DatabaseManager {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.DATA_PATH || path.join(process.cwd(), 'data', 'ipam.db');
    
    // Ensure parent directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS subnets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cidr TEXT NOT NULL UNIQUE,
        vlan INTEGER,
        gateway TEXT,
        dns TEXT,
        description TEXT,
        site TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ip_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subnet_id INTEGER NOT NULL REFERENCES subnets(id) ON DELETE CASCADE,
        ip TEXT NOT NULL,
        hostname TEXT,
        mac TEXT,
        device_type TEXT DEFAULT 'other',
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'reserved', 'dhcp', 'deprecated')),
        owner TEXT,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(subnet_id, ip)
      );

      CREATE INDEX IF NOT EXISTS idx_allocations_subnet ON ip_allocations(subnet_id);
      CREATE INDEX IF NOT EXISTS idx_allocations_ip ON ip_allocations(ip);
      CREATE INDEX IF NOT EXISTS idx_allocations_hostname ON ip_allocations(hostname);
      CREATE INDEX IF NOT EXISTS idx_allocations_mac ON ip_allocations(mac);

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  // --- Subnets ---

  getAllSubnets(): SubnetRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM subnets ORDER BY id ASC
    `);
    return stmt.all() as unknown as SubnetRecord[];
  }

  getSubnetById(id: number): SubnetRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM subnets WHERE id = ?
    `);
    return stmt.get(id) as unknown as SubnetRecord | undefined;
  }

  getSubnetByCidr(cidr: string): SubnetRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM subnets WHERE cidr = ?
    `);
    return stmt.get(cidr) as unknown as SubnetRecord | undefined;
  }

  createSubnet(data: {
    name: string;
    cidr: string;
    vlan?: number | null;
    gateway?: string | null;
    dns?: string | null;
    description?: string | null;
    site?: string | null;
  }): SubnetRecord {
    const stmt = this.db.prepare(`
      INSERT INTO subnets (name, cidr, vlan, gateway, dns, description, site)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.name,
      data.cidr,
      data.vlan ?? null,
      data.gateway ?? null,
      data.dns ?? null,
      data.description ?? null,
      data.site ?? null
    );

    const newId = Number(result.lastInsertRowid);
    this.logAudit('CREATE', 'subnet', newId, `Created subnet ${data.name} (${data.cidr})`);
    return this.getSubnetById(newId)!;
  }

  updateSubnet(id: number, data: {
    name?: string;
    vlan?: number | null;
    gateway?: string | null;
    dns?: string | null;
    description?: string | null;
    site?: string | null;
  }): SubnetRecord | undefined {
    const current = this.getSubnetById(id);
    if (!current) return undefined;

    const stmt = this.db.prepare(`
      UPDATE subnets
      SET name = COALESCE(?, name),
          vlan = ?,
          gateway = ?,
          dns = ?,
          description = ?,
          site = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      data.name ?? current.name,
      data.vlan !== undefined ? data.vlan : current.vlan,
      data.gateway !== undefined ? data.gateway : current.gateway,
      data.dns !== undefined ? data.dns : current.dns,
      data.description !== undefined ? data.description : current.description,
      data.site !== undefined ? data.site : current.site,
      id
    );

    this.logAudit('UPDATE', 'subnet', id, `Updated subnet ${current.cidr}`);
    return this.getSubnetById(id);
  }

  deleteSubnet(id: number): boolean {
    const current = this.getSubnetById(id);
    if (!current) return false;

    const stmt = this.db.prepare(`DELETE FROM subnets WHERE id = ?`);
    stmt.run(id);
    this.logAudit('DELETE', 'subnet', id, `Deleted subnet ${current.name} (${current.cidr})`);
    return true;
  }

  // --- Allocations ---

  getAllocationsBySubnet(subnetId: number): AllocationRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ip_allocations
      WHERE subnet_id = ?
      ORDER BY id ASC
    `);
    return stmt.all(subnetId) as unknown as AllocationRecord[];
  }

  getAllocationById(id: number): AllocationRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM ip_allocations WHERE id = ?
    `);
    return stmt.get(id) as unknown as AllocationRecord | undefined;
  }

  getAllocationByIp(subnetId: number, ip: string): AllocationRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM ip_allocations WHERE subnet_id = ? AND ip = ?
    `);
    return stmt.get(subnetId, ip) as unknown as AllocationRecord | undefined;
  }

  createAllocation(data: {
    subnet_id: number;
    ip: string;
    hostname?: string | null;
    mac?: string | null;
    device_type?: string;
    status?: 'active' | 'reserved' | 'dhcp' | 'deprecated';
    owner?: string | null;
    description?: string | null;
  }): AllocationRecord {
    const stmt = this.db.prepare(`
      INSERT INTO ip_allocations (subnet_id, ip, hostname, mac, device_type, status, owner, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.subnet_id,
      data.ip,
      data.hostname ?? null,
      data.mac ?? null,
      data.device_type ?? 'other',
      data.status ?? 'active',
      data.owner ?? null,
      data.description ?? null
    );

    const newId = Number(result.lastInsertRowid);
    this.logAudit('ALLOCATE', 'ip', newId, `Allocated ${data.ip} (${data.hostname || 'no-host'})`);
    return this.getAllocationById(newId)!;
  }

  updateAllocation(id: number, data: {
    hostname?: string | null;
    mac?: string | null;
    device_type?: string;
    status?: 'active' | 'reserved' | 'dhcp' | 'deprecated';
    owner?: string | null;
    description?: string | null;
  }): AllocationRecord | undefined {
    const current = this.getAllocationById(id);
    if (!current) return undefined;

    const stmt = this.db.prepare(`
      UPDATE ip_allocations
      SET hostname = ?,
          mac = ?,
          device_type = COALESCE(?, device_type),
          status = COALESCE(?, status),
          owner = ?,
          description = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      data.hostname !== undefined ? data.hostname : current.hostname,
      data.mac !== undefined ? data.mac : current.mac,
      data.device_type ?? current.device_type,
      data.status ?? current.status,
      data.owner !== undefined ? data.owner : current.owner,
      data.description !== undefined ? data.description : current.description,
      id
    );

    this.logAudit('UPDATE', 'ip', id, `Updated allocation for ${current.ip}`);
    return this.getAllocationById(id);
  }

  deleteAllocation(id: number): boolean {
    const current = this.getAllocationById(id);
    if (!current) return false;

    const stmt = this.db.prepare(`DELETE FROM ip_allocations WHERE id = ?`);
    stmt.run(id);
    this.logAudit('RELEASE', 'ip', id, `Released IP ${current.ip}`);
    return true;
  }

  // --- Search & Stats ---

  search(query: string): { subnets: SubnetRecord[]; allocations: (AllocationRecord & { subnet_name: string; subnet_cidr: string })[] } {
    const cleanQuery = `%${query.trim()}%`;
    const subnetStmt = this.db.prepare(`
      SELECT * FROM subnets
      WHERE name LIKE ? OR cidr LIKE ? OR description LIKE ? OR site LIKE ?
      LIMIT 20
    `);
    const subnets = subnetStmt.all(cleanQuery, cleanQuery, cleanQuery, cleanQuery) as unknown as SubnetRecord[];

    const allocStmt = this.db.prepare(`
      SELECT a.*, s.name as subnet_name, s.cidr as subnet_cidr
      FROM ip_allocations a
      JOIN subnets s ON a.subnet_id = s.id
      WHERE a.ip LIKE ? OR a.hostname LIKE ? OR a.mac LIKE ? OR a.owner LIKE ? OR a.description LIKE ?
      LIMIT 50
    `);
    const allocations = allocStmt.all(cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery) as unknown as (AllocationRecord & { subnet_name: string; subnet_cidr: string })[];

    return { subnets, allocations };
  }

  getStats(): {
    totalSubnets: number;
    totalAllocated: number;
    totalReserved: number;
    totalDhcp: number;
  } {
    const subnetRow = this.db.prepare(`SELECT COUNT(*) as count FROM subnets`).get() as { count: number };
    const allocRow = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved,
        SUM(CASE WHEN status = 'dhcp' THEN 1 ELSE 0 END) as dhcp
      FROM ip_allocations
    `).get() as { total: number; reserved: number; dhcp: number };

    return {
      totalSubnets: Number(subnetRow.count || 0),
      totalAllocated: Number(allocRow.total || 0),
      totalReserved: Number(allocRow.reserved || 0),
      totalDhcp: Number(allocRow.dhcp || 0),
    };
  }

  getAuditLogs(limit: number = 30): AuditRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_log ORDER BY id DESC LIMIT ?
    `);
    return stmt.all(limit) as unknown as AuditRecord[];
  }

  private logAudit(action: string, entityType: string, entityId: number | null, details: string) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_log (action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(action, entityType, entityId, details);
    } catch {
      // Non-fatal if audit log fails
    }
  }
}

// Export singleton instance
export const db = new DatabaseManager();
export default db;
