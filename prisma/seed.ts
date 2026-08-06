import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

const familyMembers = [
  { name: 'Zachary Simpson', email: 'zachary@example.com', codename: 'Zachary' },
  { name: 'Shannon Jaelynn Simpson', email: 'shannon@example.com', codename: 'Shannon' },
  { name: 'Matthew Simpson', email: 'matthew@example.com', codename: 'Matthew' },
  { name: 'Leslie Simpson-Crawford', email: 'leslie@example.com', codename: 'Leslie' },
  { name: 'Charles Crawford', email: 'charles@example.com', codename: 'Charles' },
  { name: 'David Simpson', email: 'david@example.com', codename: 'David' },
  { name: 'Debbie Kraemer', email: 'debbie@example.com', codename: 'Debbie' },
  { name: 'Michael Kelly', email: 'michael@example.com', codename: 'Michael' },
  { name: 'Terry Kelly', email: 'terry@example.com', codename: 'Terry' },
  { name: 'Sharon Goins', email: 'sharon@example.com', codename: 'Sharon' },
  { name: 'Thomas Goins', email: 'thomas@example.com', codename: 'Thomas' },
  { name: 'Leonard Courier', email: 'leonard@example.com', codename: 'Leonard' },
  { name: 'Cheryl Courier', email: 'cheryl@example.com', codename: 'Cheryl' },
  { name: 'Kristy Bonifer', email: 'kristy@example.com', codename: 'Kristy' },
  { name: 'Dayton Moses', email: 'dayton@example.com', codename: 'Dayton' },
  { name: 'Kathy Moses', email: 'kathy@example.com', codename: 'Kathy' },
  { name: 'John Moses', email: 'john@example.com', codename: 'John' },
  { name: 'James Moses', email: 'james@example.com', codename: 'James' },
  { name: 'Julia Kelly', email: 'julia@example.com', codename: 'Julia' },
  { name: 'Kimberly Piercy', email: 'kimberly@example.com', codename: 'Kimberly' },
  { name: 'Rodney Piercy', email: 'rodney@example.com', codename: 'Rodney' },
];

async function main() {
  console.log('🌱 Seeding KovertKlaus test family operative accounts...');

  const defaultPassword = 'Klaus2026!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  let createdCount = 0;
  let skippedCount = 0;

  for (const member of familyMembers) {
    const existing = await db.user.findUnique({
      where: { email: member.email },
    });

    if (existing) {
      console.log(`⏩ Skipping duplicate email: ${member.email} (${member.name})`);
      skippedCount++;
      continue;
    }

    const newUser = await db.user.create({
      data: {
        name: member.name,
        email: member.email,
        codename: member.codename,
        passwordHash,
      },
    });

    // Create default Master OpKit for each user
    await db.wishlist.create({
      data: {
        userId: newUser.id,
        name: 'Master OpKit - Secret Santa',
        type: 'WISHLIST',
      },
    });

    console.log(`✅ Created operative account: ${member.name} <${member.email}>`);
    createdCount++;
  }

  console.log(`\n🎉 Seeding complete! Created ${createdCount} accounts (${skippedCount} skipped).`);
  console.log(`🔑 All test accounts use password: "${defaultPassword}"`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
