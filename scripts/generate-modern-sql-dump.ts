import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function generateModernSqlDump() {
  console.log('🔄 Generating clean PostgreSQL DDL from prisma/schema.prisma...');

  const ddl = execSync(
    'npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script',
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    }
  );

  console.log('📦 Generating SQL data seeds for ThemePresets and SystemConfig...');

  let sqlData = '\n-- -----------------------------------------------------------------------------\n';
  sqlData += '-- PRODUCTION CLEAN DATA SEED (SystemConfig). No AdminUser: first-run setup at /northpole/setup creates it.\n';
  sqlData += '-- -----------------------------------------------------------------------------\n\n';

  // SystemConfig
  sqlData += `INSERT INTO admin."SystemConfig" ("id", "activeThemeId", "activeSeason", "announcementBannerActive", "freeAnnualHostAllowance", "freeAnnualJoinAllowance", "paidEventPriceUsd", "maxFreeParticipants", "maxWishlistItems", "updatedAt")\n`;
  sqlData += `VALUES ('singleton', 'winter_holiday', 'auto', true, 1, 3, 5.00, 25, 50, NOW())\n`;
  sqlData += `ON CONFLICT ("id") DO NOTHING;\n\n`;

  const fullDump = `-- KovertKlaus Clean Production PostgreSQL Database Dump (v0.2.0-alpha)\n-- Conforms strictly to prisma/schema.prisma (Zero Dummy Records)\n\n` + ddl + '\n' + sqlData;

  const targetFile = path.join(__dirname, '../prisma/kovertklaus_test_db.sql');
  fs.writeFileSync(targetFile, fullDump, 'utf8');
  console.log(`✅ Tidy production database dump written to: ${targetFile} (${(fullDump.length / 1024).toFixed(1)} KB)`);
}

generateModernSqlDump().catch((err) => {
  console.error('❌ Failed to generate modern SQL dump:', err);
  process.exit(1);
});
