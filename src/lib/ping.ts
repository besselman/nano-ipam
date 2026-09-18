import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { parseCidr, longToIp, ipToLong, isValidIpv4, normalizeMac, isValidMac } from './cidr.js';

export interface PingResult {
  ip: string;
  alive: boolean;
  roundTripMs: number | null;
  mac: string | null;
}

/**
 * Pings a single IPv4 host using system native ping utility.
 */
export function pingHost(ip: string, timeoutMs: number = 1000): Promise<{ alive: boolean; roundTripMs: number | null }> {
  return new Promise((resolve) => {
    if (!isValidIpv4(ip)) {
      return resolve({ alive: false, roundTripMs: null });
    }

    const isWindows = os.platform() === 'win32';
    const command = 'ping';
    const args = isWindows
      ? ['-n', '1', '-w', String(timeoutMs), ip]
      : ['-c', '1', '-W', String(Math.max(1, Math.ceil(timeoutMs / 1000))), ip];

    const startTime = Date.now();
    execFile(command, args, { timeout: timeoutMs + 1000 }, (error, stdout) => {
      const elapsed = Date.now() - startTime;
      if (error) {
        return resolve({ alive: false, roundTripMs: null });
      }

      // Parse round trip time if possible
      let roundTripMs: number | null = null;
      if (isWindows) {
        const match = stdout.match(/Average\s*=\s*(\d+)ms|time[=<](\d+)ms/i);
        if (match) {
          roundTripMs = Number(match[1] || match[2]);
        }
      } else {
        const match = stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i);
        if (match) {
          roundTripMs = Math.round(Number(match[1]));
        }
      }

      if (roundTripMs === null) {
        roundTripMs = Math.min(elapsed, timeoutMs);
      }

      resolve({ alive: true, roundTripMs });
    });
  });
}

/**
 * Attempt to lookup the MAC address of an IP from the local ARP cache.
 */
export async function getMacFromArp(ip: string): Promise<string | null> {
  if (!isValidIpv4(ip)) return null;

  // 1. On Linux, check /proc/net/arp directly (very fast, zero process spawn)
  try {
    if (fs.existsSync('/proc/net/arp')) {
      const content = fs.readFileSync('/proc/net/arp', 'utf-8');
      const lines = content.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 4 && parts[0] === ip) {
          const rawMac = parts[3];
          if (isValidMac(rawMac) && rawMac !== '00:00:00:00:00:00') {
            return normalizeMac(rawMac);
          }
        }
      }
    }
  } catch {
    // Fall through to CLI lookup
  }

  // 2. Fallback using system arp command
  return new Promise((resolve) => {
    const isWindows = os.platform() === 'win32';
    const command = 'arp';
    const args = ['-a', ip];

    execFile(command, args, { timeout: 1500 }, (error, stdout) => {
      if (error || !stdout) {
        return resolve(null);
      }

      const macMatch = stdout.match(/([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})/);
      if (macMatch && isValidMac(macMatch[1]) && macMatch[1] !== '00:00:00:00:00:00') {
        return resolve(normalizeMac(macMatch[1]));
      }

      resolve(null);
    });
  });
}

/**
 * Pings a host and looks up its MAC address.
 */
export async function inspectHost(ip: string, timeoutMs: number = 1000): Promise<PingResult> {
  const ping = await pingHost(ip, timeoutMs);
  let mac: string | null = null;
  if (ping.alive) {
    mac = await getMacFromArp(ip);
  }
  return {
    ip,
    alive: ping.alive,
    roundTripMs: ping.roundTripMs,
    mac,
  };
}

/**
 * Concurrently sweeps a list of IP addresses or a CIDR subnet.
 */
export async function sweepSubnet(
  cidrOrIps: string | string[],
  options: {
    concurrency?: number;
    timeoutMs?: number;
    onResult?: (result: PingResult) => void;
  } = {}
): Promise<PingResult[]> {
  const concurrency = Math.max(1, Math.min(50, options.concurrency || 20));
  const timeoutMs = options.timeoutMs || 800;

  let ipsToScan: string[] = [];
  if (typeof cidrOrIps === 'string') {
    const info = parseCidr(cidrOrIps);
    if (info.usableHosts > 1024) {
      throw new Error(`Subnet has ${info.usableHosts} usable hosts. Sweeps are limited to /22 (1024 hosts) or smaller to prevent excessive load.`);
    }
    const firstLong = ipToLong(info.firstUsableIp);
    const lastLong = ipToLong(info.lastUsableIp);
    for (let current = firstLong; current <= lastLong; current++) {
      ipsToScan.push(longToIp(current));
    }
  } else {
    ipsToScan = cidrOrIps.filter(isValidIpv4);
  }

  const results: PingResult[] = [];
  let index = 0;

  async function worker() {
    while (index < ipsToScan.length) {
      const currentIp = ipsToScan[index++];
      try {
        const result = await inspectHost(currentIp, timeoutMs);
        results.push(result);
        if (options.onResult) {
          options.onResult(result);
        }
      } catch {
        results.push({ ip: currentIp, alive: false, roundTripMs: null, mac: null });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ipsToScan.length) }, () => worker());
  await Promise.all(workers);

  results.sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));
  return results;
}