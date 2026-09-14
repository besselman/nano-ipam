import assert from 'node:assert';
import { parseCidr, subnetsOverlap, findNextAvailableIp, isValidIpv4, isValidMac, normalizeMac } from '../src/lib/cidr.js';
import db from '../src/db/database.js';

console.log('🧪 Starting nano-ipam verification test suite...\n');

// 1. CIDR Calculations
console.log('Test 1: CIDR Math & Subnet Parsing');
const sub24 = parseCidr('192.168.1.0/24');
assert.strictEqual(sub24.networkAddress, '192.168.1.0');
assert.strictEqual(sub24.netmask, '255.255.255.0');
assert.strictEqual(sub24.broadcastAddress, '192.168.1.255');
assert.strictEqual(sub24.firstUsableIp, '192.168.1.1');
assert.strictEqual(sub24.lastUsableIp, '192.168.1.254');
assert.strictEqual(sub24.usableHosts, 254);
assert.strictEqual(sub24.totalHosts, 256);
console.log('  ✔ /24 boundary values correct');

const sub16 = parseCidr('10.10.0.0/16');
assert.strictEqual(sub16.usableHosts, 65534);
assert.strictEqual(sub16.netmask, '255.255.0.0');
console.log('  ✔ /16 calculation correct');

const sub30 = parseCidr('10.0.0.0/30');
assert.strictEqual(sub30.usableHosts, 2);
assert.strictEqual(sub30.firstUsableIp, '10.0.0.1');
assert.strictEqual(sub30.lastUsableIp, '10.0.0.2');
console.log('  ✔ /30 point-to-point calculation correct');

// 2. Overlap Detection
console.log('\nTest 2: Subnet Overlap Detection');
assert.strictEqual(subnetsOverlap('192.168.1.0/24', '192.168.1.128/25'), true);
assert.strictEqual(subnetsOverlap('10.0.0.0/16', '10.0.50.0/24'), true);
assert.strictEqual(subnetsOverlap('192.168.1.0/24', '192.168.2.0/24'), false);
assert.strictEqual(subnetsOverlap('10.10.0.0/24', '10.20.0.0/24'), false);
console.log('  ✔ Overlaps detected accurately');

// 3. Next Available IP Calculation
console.log('\nTest 3: Next Available IP Allocation');
const next1 = findNextAvailableIp('192.168.1.0/24', [], '192.168.1.1');
assert.strictEqual(next1, '192.168.1.2'); // Gateway is reserved, first free is .2

const next2 = findNextAvailableIp('192.168.1.0/24', ['192.168.1.2', '192.168.1.3'], '192.168.1.1');
assert.strictEqual(next2, '192.168.1.4');

// Subnet with hole
const nextHole = findNextAvailableIp('192.168.1.0/24', ['192.168.1.1', '192.168.1.3'], undefined);
assert.strictEqual(nextHole, '192.168.1.2');
console.log('  ✔ Next-available IP calculated correctly');

// 4. Input Validations
console.log('\nTest 4: IP & MAC Validations');
assert.strictEqual(isValidIpv4('192.168.1.1'), true);
assert.strictEqual(isValidIpv4('256.0.0.1'), false);
assert.strictEqual(isValidIpv4('192.168.1'), false);
assert.strictEqual(isValidMac('00:1A:2B:3C:4D:5E'), true);
assert.strictEqual(isValidMac('00-1a-2b-3c-4d-5e'), true);
assert.strictEqual(isValidMac('invalid-mac'), false);
assert.strictEqual(normalizeMac('00-1A-2B-3C-4D-5E'), '00:1a:2b:3c:4d:5e');
console.log('  ✔ Validations passed');

// 5. Database CRUD
console.log('\nTest 5: SQLite Database Operations');
const testSubnet = db.createSubnet({
  name: 'Test Proxmox LXC Subnet',
  cidr: '172.16.100.0/24',
  vlan: 100,
  gateway: '172.16.100.1',
  site: 'Proxmox Lab',
  description: 'Test subnet for verification'
});
assert.ok(testSubnet.id);
assert.strictEqual(testSubnet.cidr, '172.16.100.0/24');
console.log(`  ✔ Subnet created with ID ${testSubnet.id}`);

const alloc1 = db.createAllocation({
  subnet_id: testSubnet.id,
  ip: '172.16.100.1',
  hostname: 'gw-core',
  device_type: 'gateway',
  status: 'reserved',
  description: 'Core Gateway'
});
assert.strictEqual(alloc1.ip, '172.16.100.1');
console.log(`  ✔ Reserved gateway allocation created`);

const alloc2 = db.createAllocation({
  subnet_id: testSubnet.id,
  ip: '172.16.100.10',
  hostname: 'pihole-lxc',
  device_type: 'lxc',
  status: 'active',
  owner: 'ben',
  mac: 'bc:24:11:00:11:22'
});
assert.strictEqual(alloc2.hostname, 'pihole-lxc');
console.log(`  ✔ Active LXC container allocation created`);

// Search verification
const searchRes = db.search('pihole');
assert.strictEqual(searchRes.allocations.length, 1);
assert.strictEqual(searchRes.allocations[0].ip, '172.16.100.10');
console.log(`  ✔ Global search found allocated IP by hostname`);

// Clean up test subnet
db.deleteSubnet(testSubnet.id);
assert.strictEqual(db.getSubnetById(testSubnet.id), undefined);
assert.strictEqual(db.getAllocationsBySubnet(testSubnet.id).length, 0); // Cascaded delete
console.log(`  ✔ Subnet and cascaded allocations deleted cleanly`);

console.log('\n🎉 ALL 5 TEST SUITES PASSED SUCCESSFULLY!\n');
