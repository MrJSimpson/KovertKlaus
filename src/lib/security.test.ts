import test from 'node:test';
import assert from 'node:assert';
import {
  signToken,
  verifyToken,
  isSafePublicUrl,
  validatePassword,
  isValidEmail,
  sanitizeText,
  formatCodename,
  generateInviteCode,
} from './security';

test('Cryptographic Sessions - signToken and verifyToken', async (t) => {
  await t.test('Successfully signs and verifies a valid userId token', () => {
    const userId = 'usr_9f83a2c0-82a4-4c47-b769-63ffb78864a1';
    const signedToken = signToken(userId);

    assert.ok(signedToken.includes('.'), 'Token must contain separator dot');
    assert.ok(signedToken.startsWith(userId), 'Token must start with payload');

    const verified = verifyToken(signedToken);
    assert.strictEqual(verified, userId, 'Verified payload must match original userId');
  });

  await t.test('Rejects token with tampered payload', () => {
    const userId = 'usr_original_id';
    const signedToken = signToken(userId);
    const [, sig] = signedToken.split('.');

    const tamperedToken = `usr_attacker_id.${sig}`;
    const verified = verifyToken(tamperedToken);

    assert.strictEqual(verified, null, 'Tampered token payload must be rejected');
  });

  await t.test('Rejects token with tampered signature', () => {
    const userId = 'usr_test_user';
    const signedToken = signToken(userId);
    const [payload] = signedToken.split('.');

    const tamperedToken = `${payload}.invalidSignatureValue123`;
    const verified = verifyToken(tamperedToken);

    assert.strictEqual(verified, null, 'Tampered token signature must be rejected');
  });

  await t.test('Rejects unsigned raw UUIDs', () => {
    const rawUuid = '9f83a2c0-82a4-4c47-b769-63ffb78864a1';
    const verified = verifyToken(rawUuid);

    assert.strictEqual(verified, null, 'Raw unsigned UUID must return null');
  });

  await t.test('Rejects null, undefined, or empty token inputs', () => {
    assert.strictEqual(verifyToken(null), null);
    assert.strictEqual(verifyToken(undefined), null);
    assert.strictEqual(verifyToken(''), null);
  });
});

test('SSRF Protection - isSafePublicUrl', async (t) => {
  await t.test('Permits valid public HTTPS and HTTP e-commerce URLs', () => {
    assert.strictEqual(isSafePublicUrl('https://amazon.com/dp/B08N5WRWNW').safe, true);
    assert.strictEqual(isSafePublicUrl('https://www.target.com/p/holiday-mug/-/A-12345678').safe, true);
    assert.strictEqual(isSafePublicUrl('http://etsy.com/listing/987654321/custom-gift').safe, true);
  });

  await t.test('Blocks loopback hostnames and localhost variants', () => {
    assert.strictEqual(isSafePublicUrl('http://localhost:3000').safe, false);
    assert.strictEqual(isSafePublicUrl('http://127.0.0.1:8080').safe, false);
    assert.strictEqual(isSafePublicUrl('http://0.0.0.0:5432').safe, false);
    assert.strictEqual(isSafePublicUrl('http://[::1]:3000').safe, false);
    assert.strictEqual(isSafePublicUrl('http://server.local').safe, false);
    assert.strictEqual(isSafePublicUrl('http://database.internal').safe, false);
  });

  await t.test('Blocks RFC 1918 Private IPv4 subnets', () => {
    assert.strictEqual(isSafePublicUrl('http://10.0.0.1/admin').safe, false);
    assert.strictEqual(isSafePublicUrl('http://172.16.5.10:8000').safe, false);
    assert.strictEqual(isSafePublicUrl('http://192.168.1.1').safe, false);
    assert.strictEqual(isSafePublicUrl('http://100.64.0.1').safe, false); // Carrier grade NAT
  });

  await t.test('Blocks AWS and Cloud metadata IP endpoints', () => {
    assert.strictEqual(isSafePublicUrl('http://169.254.169.254/latest/meta-data').safe, false);
    assert.strictEqual(isSafePublicUrl('http://instance-data').safe, false);
  });

  await t.test('Blocks DNS rebinding wildcard domains', () => {
    assert.strictEqual(isSafePublicUrl('http://127.0.0.1.nip.io').safe, false);
    assert.strictEqual(isSafePublicUrl('http://test.192.168.1.1.sslip.io').safe, false);
    assert.strictEqual(isSafePublicUrl('http://localtest.me').safe, false);
    assert.strictEqual(isSafePublicUrl('http://vcap.me').safe, false);
  });

  await t.test('Blocks integer and hexadecimal IP representations', () => {
    assert.strictEqual(isSafePublicUrl('http://2130706433').safe, false); // 127.0.0.1 integer
    assert.strictEqual(isSafePublicUrl('http://0x7f000001').safe, false); // 127.0.0.1 hex
    assert.strictEqual(isSafePublicUrl('http://017700000001').safe, false); // 127.0.0.1 octal
  });

  await t.test('Blocks non-HTTP protocols and embedded userinfo', () => {
    assert.strictEqual(isSafePublicUrl('file:///etc/passwd').safe, false);
    assert.strictEqual(isSafePublicUrl('gopher://127.0.0.1:6379').safe, false);
    assert.strictEqual(isSafePublicUrl('ftp://ftp.example.com').safe, false);
    assert.strictEqual(isSafePublicUrl('javascript:alert(1)').safe, false);
    assert.strictEqual(isSafePublicUrl('http://admin:password@example.com').safe, false);
  });
});

test('Exchange Roster Target Sanitization Logic', async (t) => {
  await t.test('Sanitizes target and address for regular members', () => {
    const mockExchange = {
      id: 'ex_1',
      organizerId: 'usr_organizer',
      members: [
        {
          id: 'mem_1',
          userId: 'usr_member1',
          role: 'ELF_AGENT',
          shippingStatus: 'PENDING',
          user: {
            id: 'usr_member1',
            name: 'Member One',
            codename: 'Eagle',
            streetAddress: '123 Classified St',
            city: 'North Pole',
            state: 'AK',
            zipCode: '99705',
          },
          targetUserId: 'usr_member2',
          targetUser: {
            id: 'usr_member2',
            name: 'Member Two',
            codename: 'Hawk',
            streetAddress: '456 Secret Way',
            city: 'Anchorage',
            state: 'AK',
            zipCode: '99501',
          },
        },
        {
          id: 'mem_2',
          userId: 'usr_member2',
          role: 'ELF_AGENT',
          shippingStatus: 'PENDING',
          user: {
            id: 'usr_member2',
            name: 'Member Two',
            codename: 'Hawk',
            streetAddress: '456 Secret Way',
            city: 'Anchorage',
            state: 'AK',
            zipCode: '99501',
          },
          targetUserId: 'usr_member1',
          targetUser: {
            id: 'usr_member1',
            name: 'Member One',
            codename: 'Eagle',
            streetAddress: '123 Classified St',
            city: 'North Pole',
            state: 'AK',
            zipCode: '99705',
          },
        },
      ],
      exclusionRules: [{ id: 'excl_1', memberId: 'mem_1', restrictedMemberId: 'mem_2' }],
    };

    // Simulate viewing as Member 1
    const activeUserId = 'usr_member1';
    const isOrganizer = mockExchange.organizerId === activeUserId;

    const sanitizedMembers = mockExchange.members.map((m) => {
      const isSelf = Boolean(activeUserId && m.userId === activeUserId);
      const canViewDetails = isOrganizer || isSelf;

      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        shippingStatus: m.shippingStatus,
        user: {
          id: m.user.id,
          name: m.user.name,
          codename: m.user.codename,
          streetAddress: canViewDetails ? m.user.streetAddress : null,
          city: canViewDetails ? m.user.city : null,
          state: canViewDetails ? m.user.state : null,
          zipCode: canViewDetails ? m.user.zipCode : null,
        },
        targetUserId: canViewDetails ? m.targetUserId : null,
        targetUser: canViewDetails ? m.targetUser : null,
      };
    });

    // Member 1 can view their own target and delivery address
    const selfRecord = sanitizedMembers.find((m) => m.userId === 'usr_member1');
    assert.ok(selfRecord?.targetUser !== null, 'Member 1 must see their assigned target');
    assert.strictEqual(selfRecord?.targetUser?.id, 'usr_member2');

    // Member 1 CANNOT view Member 2's target or Member 2's personal home address
    const otherRecord = sanitizedMembers.find((m) => m.userId === 'usr_member2');
    assert.strictEqual(otherRecord?.targetUser, null, "Other members' targetUser must be null");
    assert.strictEqual(otherRecord?.targetUserId, null, "Other members' targetUserId must be null");
    assert.strictEqual(otherRecord?.user.streetAddress, null, "Other members' streetAddress must be null");
    assert.strictEqual(otherRecord?.user.zipCode, null, "Other members' zipCode must be null");
  });
});
