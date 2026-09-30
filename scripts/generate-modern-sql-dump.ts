import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

async function generateModernSqlDump() {
  console.log('🔄 Generating clean PostgreSQL DDL from prisma/schema.prisma...');

  const ddl = execSync(
    'npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script',
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    }
  );

  console.log('📦 Generating SQL data seeds for ThemePresets, SystemConfig, Admin, Users, and Exchanges...');

  const passwordHash = await bcrypt.hash('Klaus2026!', 12);
  const adminPassHash = await bcrypt.hash('1sEcReTdEl!vErY', 12);

  const familyMembers = [
    {
      id: '2e65ae12-b926-4489-b220-8e704d983bda',
      email: 'joshua@example.com',
      name: 'Joshua Simpson',
      codename: 'Chewie',
      streetAddress: '6189 Pine Rd NE',
      city: 'Bremerton',
      state: 'WA',
      zipCode: '98311',
      country: 'US',
    },
    { id: '2b2852e9-5126-4b57-9158-dbaa1463eaca', email: 'zachary@example.com', name: 'Zachary Simpson', codename: 'Zachary' },
    { id: '271f7a54-689d-4a3d-9d40-74b5da8a5ac5', email: 'shannon@example.com', name: 'Shannon Jaelynn Simpson', codename: 'Shannon' },
    { id: 'af08be00-376c-4871-bd05-e7bf2ea83841', email: 'matthew@example.com', name: 'Matthew Simpson', codename: 'Matthew' },
    { id: 'd151148c-aef8-434e-a048-43781cdeeddf', email: 'leslie@example.com', name: 'Leslie Simpson-Crawford', codename: 'Leslie' },
    { id: '8532980e-3e08-4b53-82fd-4bd87284eb4e', email: 'charles@example.com', name: 'Charles Crawford', codename: 'Charles' },
    { id: '864d4a8e-249a-4aff-a630-a3c1ef5ff65a', email: 'david@example.com', name: 'David Simpson', codename: 'David' },
    { id: 'b9868ab1-79ea-430a-966d-fab5eadfed14', email: 'debbie@example.com', name: 'Debbie Kraemer', codename: 'Debbie' },
    { id: '7e6f8041-20e4-4f9c-95be-58462622b542', email: 'michael@example.com', name: 'Michael Kelly', codename: 'Michael' },
    { id: '08d55464-478a-4a36-b13a-2cd720c68587', email: 'terry@example.com', name: 'Terry Kelly', codename: 'Terry' },
    { id: 'c6512237-d6b4-4e01-ba3e-180ab7eff431', email: 'sharon@example.com', name: 'Sharon Goins', codename: 'Sharon' },
    { id: '30fb6940-c586-4a76-a1ab-b91d276835a1', email: 'thomas@example.com', name: 'Thomas Goins', codename: 'Thomas' },
    { id: '83ec991a-4379-47be-8c1a-47a95aecc053', email: 'leonard@example.com', name: 'Leonard Courier', codename: 'Leonard' },
    { id: 'af7c7907-22d4-4bb1-81cd-b347b999d75f', email: 'cheryl@example.com', name: 'Cheryl Courier', codename: 'Cheryl' },
    { id: '7122c6f3-1d14-4dea-9856-7950154aff51', email: 'kristy@example.com', name: 'Kristy Bonifer', codename: 'Kristy' },
    { id: '30c7b060-1ced-4165-8f18-dc157af689a1', email: 'dayton@example.com', name: 'Dayton Moses', codename: 'Dayton' },
    { id: '66b86c8b-1743-40d5-a8ad-7cd395350ed6', email: 'kathy@example.com', name: 'Kathy Moses', codename: 'Kathy' },
    { id: 'f9ffcf17-cf57-4951-9fdc-6699a3076abf', email: 'john@example.com', name: 'John Moses', codename: 'John' },
    { id: '1a909af5-cb98-4f38-a8fb-cfaaffdc8c7d', email: 'james@example.com', name: 'James Moses', codename: 'James' },
    { id: '66295104-5539-45d3-9cad-60a0c329ffaf', email: 'julia@example.com', name: 'Julia Kelly', codename: 'Julia' },
    { id: '6a43cd31-048d-44fa-81a9-87365a9b3c1f', email: 'kimberly@example.com', name: 'Kimberly Piercy', codename: 'Kimberly' },
    { id: '634555c4-12c1-452f-97ef-3301a2f6c49c', email: 'rodney@example.com', name: 'Rodney Piercy', codename: 'Rodney' },
  ];

  let sqlData = '\n-- -----------------------------------------------------------------------------\n';
  sqlData += '-- DATA INGESTION & SEED RECORDS\n';
  sqlData += '-- -----------------------------------------------------------------------------\n\n';

  // SystemConfig
  sqlData += `INSERT INTO "SystemConfig" ("id", "activeThemeId", "activeSeason", "announcementBannerActive", "freeAnnualHostAllowance", "freeAnnualJoinAllowance", "paidEventPriceUsd", "maxFreeParticipants", "maxWishlistItems", "updatedAt")\n`;
  sqlData += `VALUES ('singleton', 'winter_holiday', 'auto', true, 1, 3, 5.00, 25, 50, NOW())\n`;
  sqlData += `ON CONFLICT ("id") DO NOTHING;\n\n`;

  // AdminUser
  sqlData += `INSERT INTO "AdminUser" ("id", "username", "email", "name", "passwordHash", "role", "isActive", "requiresPasswordReset", "createdAt", "updatedAt")\n`;
  sqlData += `VALUES ('00000000-0000-4000-a000-000000000001', 'santa', 'admin@kovertklaus.com', 'Santa Claus', '${adminPassHash}', 'SUPER_ADMIN', true, false, NOW(), NOW())\n`;
  sqlData += `ON CONFLICT ("id") DO NOTHING;\n\n`;

  // Users
  sqlData += `COPY public."User" ("id", "email", "name", "codename", "passwordHash", "streetAddress", "city", "state", "zipCode", "country", "penaltyPoints", "accountStatus", "emailNotifications", "createdAt", "updatedAt", "allowOrganizerViewAllergies", "allowOrganizerViewSizes", "allowOrganizerViewMeasurements", "allowOrganizerViewFavorites") FROM stdin;\n`;
  for (const m of familyMembers) {
    const street = m.streetAddress || '\\N';
    const city = m.city || '\\N';
    const state = m.state || '\\N';
    const zip = m.zipCode || '\\N';
    const country = m.country || 'US';
    sqlData += `${m.id}\t${m.email}\t${m.name}\t${m.codename}\t${passwordHash}\t${street}\t${city}\t${state}\t${zip}\t${country}\t0\tACTIVE\tt\t2026-08-06 00:00:00\t2026-08-06 00:00:00\tt\tt\tf\tf\n`;
  }
  sqlData += '\\.\n\n';

  // Wishlists
  sqlData += `COPY public."Wishlist" ("id", "userId", "name", "type", "createdAt", "updatedAt") FROM stdin;\n`;
  for (const m of familyMembers) {
    const wid = `w-${m.id.substring(2)}`;
    sqlData += `${wid}\t${m.id}\tMaster Wishlist Manifest - Secret Santa\tSTANDARD\t2026-08-06 00:00:00\t2026-08-06 00:00:00\n`;
  }
  // Joshua extra wishlists
  sqlData += `f7251af7-d292-4c35-9d80-ef14ad4ac05e\t2e65ae12-b926-4489-b220-8e704d983bda\tTools Kit\tSTANDARD\t2026-08-06 00:00:00\t2026-08-06 00:00:00\n`;
  sqlData += `9607a2ab-72b0-4aeb-85f7-dcab467d6413\t2e65ae12-b926-4489-b220-8e704d983bda\tOC White Elephant\tWHITE_ELEPHANT\t2026-08-06 00:00:00\t2026-08-06 00:00:00\n`;
  sqlData += '\\.\n\n';

  // Exchanges
  const simpsonExId = '5e0c8528-04c6-42fe-b95c-cffcb637a8b4';
  const elevExId = '120d0188-9510-4132-af05-c3711d12f6ec';
  sqlData += `COPY public."Exchange" ("id", "title", "description", "code", "organizerId", "maxParticipants", "giftingType", "isLocalOnly", "eventLocation", "isWhiteElephant", "budgetMin", "budgetMax", "currency", "inviteCutoffDate", "assignmentDate", "shippingDate", "executionDate", "status", "isFreeAnnualExchange", "enforcePenalties", "paymentStatus", "createdAt", "updatedAt", "organizerAssistedDraw") FROM stdin;\n`;
  sqlData += `${simpsonExId}\tSimpson Family Secret Santa 2026\tAnnual Simpson & Family Secret Santa Gift Exchange! Wishlists required.\tSIMPSON-2026\t2e65ae12-b926-4489-b220-8e704d983bda\t25\tSINGLE\tf\t\\N\tf\t25.00\t75.00\tUSD\t2026-11-20 23:59:59\t2026-11-25 00:00:00\t2026-12-15 23:59:59\t2026-12-25 18:00:00\tRECRUITING\tt\tt\tFREE_ANNUAL\t2026-08-06 00:00:00\t2026-08-06 00:00:00\tt\n`;
  sqlData += `${elevExId}\tSimpson Family White Elephant Party 2026\tIn-person local White Elephant gift stealing party! Bring 1 wrapped funny or cool gift under $30.\tSIMPSON-ELEV\t271f7a54-689d-4a3d-9d40-74b5da8a5ac5\t20\tSINGLE\tt\t6189 Pine Rd NE, Bremerton, WA 98311\tt\t10.00\t30.00\tUSD\t2026-12-10 23:59:59\t2026-12-15 00:00:00\t2026-12-20 23:59:59\t2026-12-24 17:00:00\tRECRUITING\tf\tf\tFREE_ANNUAL\t2026-08-06 00:00:00\t2026-08-06 00:00:00\tt\n`;
  sqlData += '\\.\n\n';

  // ExchangeMembers
  sqlData += `COPY public."ExchangeMember" ("id", "exchangeId", "userId", "codename", "wishlistId", "role", "shippingStatus", "deliveredConfirmed", "joinedAt") FROM stdin;\n`;
  for (const m of familyMembers) {
    const wid = `w-${m.id.substring(2)}`;
    const role = m.id === '2e65ae12-b926-4489-b220-8e704d983bda' ? 'ORGANIZER' : 'MEMBER';
    const mid = `em-${m.id.substring(3)}`;
    sqlData += `${mid}\t${simpsonExId}\t${m.id}\t${m.codename}\t${wid}\t${role}\tPENDING\tf\t2026-08-06 00:00:00\n`;
  }
  // Local members for White Elephant
  for (const m of familyMembers.slice(0, 10)) {
    const role = m.id === '271f7a54-689d-4a3d-9d40-74b5da8a5ac5' ? 'ORGANIZER' : 'MEMBER';
    const mid = `elev-${m.id.substring(5)}`;
    sqlData += `${mid}\t${elevExId}\t${m.id}\t${m.codename}\t\\N\t${role}\tPENDING\tf\t2026-08-06 00:00:00\n`;
  }
  sqlData += '\\.\n\n';

  const fullDump = `-- KovertKlaus Clean PostgreSQL Database Dump (v0.2.0-alpha)\n-- Conforms strictly to prisma/schema.prisma\n\n` + ddl + '\n' + sqlData;

  const targetFile = path.join(__dirname, '../prisma/kovertklaus_test_db.sql');
  fs.writeFileSync(targetFile, fullDump, 'utf8');
  console.log(`✅ Modernized database dump written to: ${targetFile} (${(fullDump.length / 1024).toFixed(1)} KB)`);
}

generateModernSqlDump().catch((err) => {
  console.error('❌ Failed to generate modern SQL dump:', err);
  process.exit(1);
});
