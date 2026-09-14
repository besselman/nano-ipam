/**
 * IPv4 and CIDR calculation utility functions
 */

export interface SubnetInfo {
  cidr: string;
  networkAddress: string;
  prefix: number;
  netmask: string;
  wildcard: string;
  broadcastAddress: string;
  firstUsableIp: string;
  lastUsableIp: string;
  totalHosts: number;
  usableHosts: number;
}

/**
 * Validates whether a string is a valid IPv4 address
 */
export function isValidIpv4(ip: string): boolean {
  if (typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255 && (part === '0' || !part.startsWith('0'));
  });
}

/**
 * Validates MAC address format (e.g., 00:1A:2B:3C:4D:5E or 00-1A-2B-3C-4D-5E)
 */
export function isValidMac(mac: string): boolean {
  if (!mac || typeof mac !== 'string') return false;
  const cleaned = mac.trim();
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(cleaned);
}

/**
 * Standardize MAC address to lowercase with colons
 */
export function normalizeMac(mac: string): string {
  return mac.trim().toLowerCase().replace(/-/g, ':');
}

/**
 * Convert IPv4 dotted string to unsigned 32-bit integer
 */
export function ipToLong(ip: string): number {
  if (!isValidIpv4(ip)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return ip
    .trim()
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
}

/**
 * Convert unsigned 32-bit integer to IPv4 dotted string
 */
export function longToIp(long: number): string {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255,
  ].join('.');
}

/**
 * Parse CIDR string (e.g., "192.168.1.0/24") and compute subnet boundaries
 */
export function parseCidr(cidr: string): SubnetInfo {
  if (typeof cidr !== 'string') {
    throw new Error('CIDR must be a string');
  }
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid CIDR format '${cidr}'. Expected format: x.x.x.x/y`);
  }

  const [ipPart, prefixPart] = parts;
  if (!isValidIpv4(ipPart)) {
    throw new Error(`Invalid IP in CIDR: ${ipPart}`);
  }

  const prefix = Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix /${prefixPart}. Prefix must be between 0 and 32`);
  }

  // Calculate bitmasks
  const maskLong = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const wildcardLong = (~maskLong) >>> 0;

  const rawIpLong = ipToLong(ipPart);
  const networkLong = (rawIpLong & maskLong) >>> 0;
  const broadcastLong = (networkLong | wildcardLong) >>> 0;

  const totalHosts = Math.pow(2, 32 - prefix);
  let usableHosts = 0;
  let firstUsableLong = networkLong;
  let lastUsableLong = broadcastLong;

  if (prefix <= 30) {
    usableHosts = totalHosts - 2;
    firstUsableLong = networkLong + 1;
    lastUsableLong = broadcastLong - 1;
  } else if (prefix === 31) {
    // RFC 3021 point-to-point links: 2 usable hosts, no network/broadcast
    usableHosts = 2;
    firstUsableLong = networkLong;
    lastUsableLong = broadcastLong;
  } else if (prefix === 32) {
    // Single host route
    usableHosts = 1;
    firstUsableLong = networkLong;
    lastUsableLong = networkLong;
  }

  const networkAddress = longToIp(networkLong);
  const normalizedCidr = `${networkAddress}/${prefix}`;

  return {
    cidr: normalizedCidr,
    networkAddress,
    prefix,
    netmask: longToIp(maskLong),
    wildcard: longToIp(wildcardLong),
    broadcastAddress: longToIp(broadcastLong),
    firstUsableIp: longToIp(firstUsableLong),
    lastUsableIp: longToIp(lastUsableLong),
    totalHosts,
    usableHosts,
  };
}

/**
 * Checks whether an IP belongs to a given CIDR subnet
 */
export function isIpInSubnet(ip: string, subnetCidr: string): boolean {
  if (!isValidIpv4(ip)) return false;
  const info = parseCidr(subnetCidr);
  const ipLong = ipToLong(ip);
  const networkLong = ipToLong(info.networkAddress);
  const broadcastLong = ipToLong(info.broadcastAddress);
  return ipLong >= networkLong && ipLong <= broadcastLong;
}

/**
 * Checks whether an IP is in the usable range of a subnet
 */
export function isIpUsableInSubnet(ip: string, subnetCidr: string): boolean {
  if (!isValidIpv4(ip)) return false;
  const info = parseCidr(subnetCidr);
  const ipLong = ipToLong(ip);
  const firstLong = ipToLong(info.firstUsableIp);
  const lastLong = ipToLong(info.lastUsableIp);
  return ipLong >= firstLong && ipLong <= lastLong;
}

/**
 * Checks whether two CIDR subnets overlap
 */
export function subnetsOverlap(cidr1: string, cidr2: string): boolean {
  const sub1 = parseCidr(cidr1);
  const sub2 = parseCidr(cidr2);

  const start1 = ipToLong(sub1.networkAddress);
  const end1 = ipToLong(sub1.broadcastAddress);
  const start2 = ipToLong(sub2.networkAddress);
  const end2 = ipToLong(sub2.broadcastAddress);

  return Math.max(start1, start2) <= Math.min(end1, end2);
}

/**
 * Finds the next available usable IP address in a subnet
 */
export function findNextAvailableIp(
  subnetCidr: string,
  allocatedIps: string[],
  gatewayIp?: string
): string | null {
  const info = parseCidr(subnetCidr);
  const allocatedSet = new Set(allocatedIps.map(ip => ip.trim()));
  if (gatewayIp && isValidIpv4(gatewayIp)) {
    allocatedSet.add(gatewayIp.trim());
  }

  const firstLong = ipToLong(info.firstUsableIp);
  const lastLong = ipToLong(info.lastUsableIp);

  for (let current = firstLong; current <= lastLong; current++) {
    const candidateIp = longToIp(current);
    if (!allocatedSet.has(candidateIp)) {
      return candidateIp;
    }
  }

  return null; // Subnet is completely full
}
