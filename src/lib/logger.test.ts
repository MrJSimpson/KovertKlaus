import { sanitizeLogMetadata, logError, logWarn, logInfo, logEmailEvent, logScraperEvent } from './logger';

async function runTests() {
  console.log('🧪 Starting Persistent System Logger Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // --- Test 1: Security Redaction of Sensitive Metadata ---
  console.log('--- Test 1: Security Redaction of Sensitive Keys ---');
  const dirtyObject = {
    userEmail: 'agent@kovertklaus.com',
    password: 'superSecretPassword123!',
    passwordHash: '$2a$12$eX4mP13h4sh...',
    brevoApiKey: 'xkeysib-998877665544332211',
    resendApiKey: 're_1234567890',
    smtpPass: 'smtpSecret123',
    sessionToken: 'jwt-header.payload.signature',
    authorization: 'Bearer secret_token',
    cookie: 'kovertklaus_session=abc12345',
    nested: {
      innerPassword: 'innerPasswordSecret',
      safeParam: 'public-value-123',
    },
  };

  const cleanObject: any = sanitizeLogMetadata(dirtyObject);

  assert(cleanObject.userEmail === 'agent@kovertklaus.com', 'Preserves non-sensitive fields');
  assert(cleanObject.password === '[REDACTED]', 'Redacts top-level password');
  assert(cleanObject.passwordHash === '[REDACTED]', 'Redacts passwordHash');
  assert(cleanObject.brevoApiKey === '[REDACTED]', 'Redacts brevoApiKey');
  assert(cleanObject.resendApiKey === '[REDACTED]', 'Redacts resendApiKey');
  assert(cleanObject.smtpPass === '[REDACTED]', 'Redacts smtpPass');
  assert(cleanObject.authorization === '[REDACTED]', 'Redacts authorization header');
  assert(cleanObject.cookie === '[REDACTED]', 'Redacts cookie value');
  assert(cleanObject.nested.innerPassword === '[REDACTED]', 'Recursively redacts nested password fields');
  assert(cleanObject.nested.safeParam === 'public-value-123', 'Preserves nested non-sensitive fields');

  // --- Test 2: Payload Size Bounding (2KB Cap) ---
  console.log('\n--- Test 2: Payload Size Bounding (2KB Cap) ---');
  const hugeString = 'A'.repeat(5000);
  const oversizedObj = {
    stackTrace: hugeString,
  };
  const bounded: any = sanitizeLogMetadata(oversizedObj);
  assert(typeof bounded.stackTrace === 'string', 'Handles oversized string');
  assert(bounded.stackTrace.length <= 1020, 'Truncates oversized individual string fields');

  // --- Test 3: Log Methods Execution ---
  console.log('\n--- Test 3: Standard Logging Helper Methods ---');
  await logInfo('ADMIN', 'Admin user opened settings HUD', { adminName: 'Joshua' });
  assert(true, 'logInfo executes without throwing');

  await logWarn('DB', 'Transient query retry occurred', { retryCount: 2 });
  assert(true, 'logWarn executes without throwing');

  await logError('WORKER', 'Critical worker exception', { errorCode: 500, error: 'Database timeout' });
  assert(true, 'logError executes without throwing');

  // --- Test 4: Email Event Logger Helper ---
  console.log('\n--- Test 4: Email Event Helper Formatting ---');
  await logEmailEvent('brevo', 'recipient@kovertklaus.com', 'Mission Assignment', {
    success: true,
    attempts: 1,
    messageId: 'brevo-msg-12345',
  });
  assert(true, 'logEmailEvent executes on success without throwing');

  await logEmailEvent('brevo', 'failed@kovertklaus.com', 'Mission Assignment', {
    success: false,
    attempts: 3,
    error: 'HTTP 429 Too Many Requests',
  });
  assert(true, 'logEmailEvent executes on failure without throwing');

  // --- Test 5: Scraper Event Logger Helper ---
  console.log('\n--- Test 5: Scraper Event Helper Formatting ---');
  await logScraperEvent('http://169.254.169.254/latest/meta-data', 'BLOCKED_SSRF', {
    reason: 'Cloud metadata IP forbidden',
  });
  assert(true, 'logScraperEvent executes on SSRF block without throwing');

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal logger test error:', err);
  process.exit(1);
});
