const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Standard IEEE 802.3 CRC32
function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

// Pure Node.js ZIP Archive Creator
function createZipArchive(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.name, 'utf8');
    const isStored = file.compression === 0;
    const rawData = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const uncompressedSize = rawData.length;
    const checksum = crc32(rawData);

    let compressedData = rawData;
    let compressionMethod = 0;

    if (!isStored) {
      compressedData = zlib.deflateRawSync(rawData);
      compressionMethod = 8;
    }
    const compressedSize = compressedData.length;

    // Local file header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(compressionMethod, 8); // compression method
    localHeader.writeUInt16LE(0x4a21, 10); // time (arbitrary valid DOS time)
    localHeader.writeUInt16LE(0x5d54, 12); // date (2026-08-20)
    localHeader.writeUInt32LE(checksum, 14); // crc32
    localHeader.writeUInt32LE(compressedSize, 18); // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28); // extra field length
    filenameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader);
    localHeaders.push(compressedData);

    // Central directory header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46 + filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(compressionMethod, 10); // compression method
    centralHeader.writeUInt16LE(0x4a21, 12); // time
    centralHeader.writeUInt16LE(0x5d54, 14); // date
    centralHeader.writeUInt32LE(checksum, 16); // crc32
    centralHeader.writeUInt32LE(compressedSize, 20); // compressed size
    centralHeader.writeUInt32LE(uncompressedSize, 24); // uncompressed size
    centralHeader.writeUInt16LE(filenameBuf.length, 28); // filename length
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    filenameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressedData.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with CD
  eocd.writeUInt16LE(files.length, 8); // total entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // size of CD
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of CD
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

// Generate ODF XML Documents
function generateODTFiles() {
  const mimetype = 'application/vnd.oasis.opendocument.text';

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3">
  <office:meta>
    <dc:title>KovertKlaus Master System Knowledge Base</dc:title>
    <dc:description>Comprehensive System Architecture, Clearance Governance, Runtime Parameters and Operations Guide</dc:description>
    <dc:subject>KovertKlaus Operations &amp; Administration</dc:subject>
    <dc:creator>Joshua Simpson &amp; Remy</dc:creator>
    <meta:initial-creator>Joshua Simpson</meta:initial-creator>
    <dc:date>2026-08-20T09:30:00Z</dc:date>
    <meta:keyword>Secret Santa</meta:keyword>
    <meta:keyword>White Elephant</meta:keyword>
    <meta:keyword>Sattolo Algorithm</meta:keyword>
    <meta:keyword>North Pole Admin</meta:keyword>
    <meta:keyword>Workshop</meta:keyword>
  </office:meta>
</office:document-meta>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.3">
  <office:font-face-decls>
    <style:font-face style:name="Segoe UI" svg:font-family="&apos;Segoe UI&apos;, &apos;Helvetica Neue&apos;, Arial, sans-serif"/>
    <style:font-face style:name="Consolas" svg:font-family="&apos;Consolas&apos;, &apos;Courier New&apos;, monospace"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:line-height="125%" fo:margin-top="0cm" fo:margin-bottom="0.25cm"/>
      <style:text-properties style:font-name="Segoe UI" fo:font-size="10.5pt" fo:color="#1e293b"/>
    </style:default-style>
  </office:styles>
</office:document-styles>`;

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3">
  <office:automatic-styles>
    <!-- Document Title -->
    <style:style style:name="DocTitle" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.8cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="24pt" fo:font-weight="bold" fo:color="#0f172a"/>
    </style:style>
    <!-- Subtitle -->
    <style:style style:name="DocSubtitle" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.8cm"/>
      <style:text-properties fo:font-size="12pt" fo:color="#059669" fo:font-weight="bold"/>
    </style:style>
    <!-- Heading 1 -->
    <style:style style:name="Heading1" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.6cm" fo:margin-bottom="0.25cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="16pt" fo:font-weight="bold" fo:color="#0f172a"/>
    </style:style>
    <!-- Heading 2 -->
    <style:style style:name="Heading2" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.15cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="13pt" fo:font-weight="bold" fo:color="#0369a1"/>
    </style:style>
    <!-- Heading 3 -->
    <style:style style:name="Heading3" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="11pt" fo:font-weight="bold" fo:color="#334155"/>
    </style:style>
    <!-- Normal Paragraph -->
    <style:style style:name="StandardText" style:family="paragraph">
      <style:paragraph-properties fo:line-height="130%" fo:margin-bottom="0.25cm"/>
      <style:text-properties fo:font-size="10.5pt" fo:color="#1e293b"/>
    </style:style>
    <!-- Callout Box -->
    <style:style style:name="CalloutBox" style:family="paragraph">
      <style:paragraph-properties fo:background-color="#f8fafc" fo:padding="0.3cm" fo:border="0.05pt solid #cbd5e1" fo:margin-top="0.2cm" fo:margin-bottom="0.3cm"/>
      <style:text-properties fo:font-size="10pt" fo:color="#334155"/>
    </style:style>
    <!-- Code / Monospace Text -->
    <style:style style:name="CodeText" style:family="text">
      <style:text-properties style:font-name="Consolas" fo:font-size="9.5pt" fo:color="#b91c1c" fo:background-color="#f1f5f9"/>
    </style:style>
    <!-- Table Header Style -->
    <style:style style:name="TableHeadCell" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#0f172a" fo:padding="0.2cm" fo:border="0.5pt solid #334155"/>
    </style:style>
    <style:style style:name="TableHeadText" style:family="paragraph">
      <style:text-properties fo:font-size="9.5pt" fo:font-weight="bold" fo:color="#f8fafc"/>
    </style:style>
    <!-- Table Row Style -->
    <style:style style:name="TableCell" style:family="table-cell">
      <style:table-cell-properties fo:padding="0.18cm" fo:border="0.5pt solid #e2e8f0"/>
    </style:style>
    <style:style style:name="TableText" style:family="paragraph">
      <style:text-properties fo:font-size="9.5pt" fo:color="#1e293b"/>
    </style:style>
  </office:automatic-styles>

  <office:body>
    <office:text>
      <!-- Title & Subtitle -->
      <text:p text:style-name="DocTitle">🎁 KOVERTKLAUS™ KNOWLEDGE BASE</text:p>
      <text:p text:style-name="DocSubtitle">Master System Architecture, Clearance Governance &amp; Operations Guide</text:p>

      <text:p text:style-name="CalloutBox">
        <text:span text:style-name="CodeText">Document Revision 2.0</text:span> | Classification: Whimsical Secret Service Division | Maintained by Systems Architecture &amp; North Pole Command.
      </text:p>

      <!-- SECTION 1 -->
      <text:p text:style-name="Heading1">1. Product Vision, Architecture &amp; Design System</text:p>
      <text:p text:style-name="StandardText">
        KovertKlaus combines classic holiday gift exchanges with a playful covert intelligence theme. Operatives manage operations, assemble OpKits (wishlists), acquire OpTools (gift items), and execute Secret Santa and White Elephant gift exchanges.
      </text:p>
      <text:p text:style-name="Heading2">1.1 Dual Design Aesthetics</text:p>
      <text:p text:style-name="StandardText">
        • <text:span text:style-name="CodeText">Klaus Mode 🎄 (Light Theme)</text:span>: Evergreen pine headers (emerald-950), holly berry buttons (red-700), warm gold accents, and clean white frames.<text:line-break/>
        • <text:span text:style-name="CodeText">Kovert Mode ❄️ (Dark Theme)</text:span>: Midnight slate (#090d16), icy sky blue accents (sky-400), translucent glassmorphism panels, and frost borders.
      </text:p>
      <text:p text:style-name="Heading2">1.2 Open-Core Licensing Model (BSL 1.1)</text:p>
      <text:p text:style-name="StandardText">
        • <text:span text:style-name="CodeText">Free Non-Commercial Self-Hosting</text:span>: 100% free for families, friends, non-profits, and home labs.<text:line-break/>
        • <text:span text:style-name="CodeText">Commercial Reservation</text:span>: Exclusive SaaS commercial rights belong to Joshua Simpson.<text:line-break/>
        • <text:span text:style-name="CodeText">Anti-Enshittification Covenant</text:span>: Any acquiring entity is contractually bound to maintain an open-source GPLv3 version.<text:line-break/>
        • <text:span text:style-name="CodeText">GPLv3 Automatic Sunset</text:span>: Converts unconditionally to GNU GPLv3 upon business closure, acquisition breach, or owner demise.
      </text:p>

      <!-- SECTION 2 -->
      <text:p text:style-name="Heading1">2. Clearance Levels, Roles &amp; Database Isolation</text:p>
      <text:p text:style-name="StandardText">
        To prevent privilege escalation and ensure complete separation between regular participants and administrators:
      </text:p>

      <!-- Table: Roles -->
      <table:table table:name="RolesTable">
        <table:table-column table:number-columns-repeated="3"/>
        <table:table-row>
          <table:table-cell text:style-name="TableHeadCell"><text:p text:style-name="TableHeadText">Clearance Role</text:p></table:table-cell>
          <table:table-cell text:style-name="TableHeadCell"><text:p text:style-name="TableHeadText">Database Schema</text:p></table:table-cell>
          <table:table-cell text:style-name="TableHeadCell"><text:p text:style-name="TableHeadText">Authorized Boundaries &amp; Scope</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">Field Agent</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">User</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">Public App (/dashboard, /exchange/[code], /opkits)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">OpsLeader</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">User (ExchangeMember.role = ORGANIZER)</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">Operation Command Center (/exchange/[code])</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">Workshop Operative</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">User (isWorkshop = true)</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">Workshop QA Lab (/workshop/*) + Public App</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">North Pole SysAdmin</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">AdminUser (Isolated Scheme)</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">North Pole Command (/northpole/*)</text:p></table:table-cell>
        </table:table-row>
      </table:table>

      <text:p text:style-name="Heading2">2.1 First-Time Install Credentials &amp; Mandatory NIST Password Reset</text:p>
      <text:p text:style-name="StandardText">
        For fresh installations, KovertKlaus auto-bootstraps a default Super Admin account with username <text:span text:style-name="CodeText">santa</text:span>, email <text:span text:style-name="CodeText">admin@kovertklaus.com</text:span>, and initial temporary password <text:span text:style-name="CodeText">1sEcReTdEl!vErY</text:span>.<text:line-break/>
        • <text:span text:style-name="CodeText">Mandatory Reset Enforcement</text:span>: Upon first authentication, administrative clearance remains locked until the password is reset.<text:line-break/>
        • <text:span text:style-name="CodeText">NIST SP 800-63B Compliance</text:span>: The new passphrase must be at least 12 characters, cannot match the default initial password, and cannot contain the admin username or email.
      </text:p>

      <text:p text:style-name="Heading2">2.2 The Hidden &quot;workshop&quot; Security Tag</text:p>
      <text:p text:style-name="StandardText">
        Field agents cannot view their <text:span text:style-name="CodeText">isWorkshop</text:span> status via standard API endpoints. Only administrators in <text:span text:style-name="CodeText">/northpole/users</text:span> can view or toggle this flag. When enabled, the user gains access to <text:span text:style-name="CodeText">/workshop/*</text:span> while maintaining normal website functionality.
      </text:p>

      <!-- SECTION 3 -->
      <text:p text:style-name="Heading1">3. Exchange Engine &amp; Algorithmic Invariants</text:p>
      <text:p text:style-name="Heading2">3.1 Dynamic 5-Phase Operation Lifecycle</text:p>
      <text:p text:style-name="StandardText">
        1. <text:span text:style-name="CodeText">Phase 1 (Recruiting)</text:span>: Operatives enroll via invite codes. OpsLeader sends invites or closes recruitment.<text:line-break/>
        2. <text:span text:style-name="CodeText">Phase 2 (Setup &amp; Assignment)</text:span>: Configure bidirectional matching rules, execute Sattolo target draw.<text:line-break/>
        3. <text:span text:style-name="CodeText">Phase 3 (Shipping / Execution)</text:span>: Santas acquire OpTools, ship parcels, and provide carrier tracking.<text:line-break/>
        4. <text:span text:style-name="CodeText">Phase 4 (Exchange Event)</text:span>: Operatives meet and unwrap gifts.<text:line-break/>
        5. <text:span text:style-name="CodeText">Phase 5 (Completed &amp; AAR)</text:span>: Post-event thank-yous, debrief photos, and demerit audits.
      </text:p>

      <text:p text:style-name="Heading2">3.2 Randomized Sattolo Derangement Algorithm</text:p>
      <text:p text:style-name="StandardText">
        Produces a single cyclic permutation without fixed points ($f(x) \neq x$), obfuscating the chain so that revealing one assignment provides zero clues about other pairs.
      </text:p>

      <text:p text:style-name="Heading2">3.3 100% Bidirectional Match Exclusion Rules ($A \iff B$)</text:p>
      <text:p text:style-name="StandardText">
        Prevents spouses or household members from drawing each other. Blocking Agent A from Agent B automatically and symmetrically blocks Agent B from Agent A.
      </text:p>

      <text:p text:style-name="Heading2">3.4 Mobile-First 2-Way Cascade Target Swap Invariant</text:p>
      <text:p text:style-name="StandardText">
        Selecting a new target for Agent A automatically swaps targets with the displaced giver, preserving the fundamental invariant: <text:span text:style-name="CodeText">Every operative gives 1 gift and receives 1 gift</text:span>.
      </text:p>

      <!-- SECTION 4 -->
      <text:p text:style-name="Heading1">4. Demerit, Accountability &amp; Trust Governance</text:p>
      <text:p text:style-name="StandardText">
        • <text:span text:style-name="CodeText">0–2 Demerits (ACTIVE)</text:span>: Full platform privileges.<text:line-break/>
        • <text:span text:style-name="CodeText">3 Demerits (REMOTE_RESTRICTED)</text:span>: Restricted to local in-person events only.<text:line-break/>
        • <text:span text:style-name="CodeText">&gt;3 Demerits (DISABLED)</text:span>: Account suspended from all operations.<text:line-break/>
        • <text:span text:style-name="CodeText">Carrier Protection Waiver</text:span>: Valid carrier tracking number waives demerits if lost by courier.<text:line-break/>
        • <text:span text:style-name="CodeText">Demerit Immunity Waiver</text:span>: Verified gift receipt completely waives demerit liability.
      </text:p>

      <!-- SECTION 5 -->
      <text:p text:style-name="Heading1">5. Universal Transactional Email Engine</text:p>
      <text:p text:style-name="StandardText">
        Supports 4 pluggable dispatch adapters with zero external bundling bloat:
      </text:p>
      <text:p text:style-name="StandardText">
        1. <text:span text:style-name="CodeText">Brevo v3 REST API</text:span>: Default for Cloud SaaS &amp; Cloudflare Workers (300 free emails/day). Native fetch with zero npm dependencies.<text:line-break/>
        2. <text:span text:style-name="CodeText">Direct SMTP (Nodemailer)</text:span>: For self-hosted home labs and Docker setups.<text:line-break/>
        3. <text:span text:style-name="CodeText">Resend REST API</text:span>: Alternative developer API.<text:line-break/>
        4. <text:span text:style-name="CodeText">Console Simulator</text:span>: Offline development simulator rendering stylized ASCII dispatches.
      </text:p>

      <!-- SECTION 6 -->
      <text:p text:style-name="Heading1">6. North Pole Administration (/northpole)</text:p>
      <text:p text:style-name="StandardText">
        The /northpole route provides complete management over all runtime parameters without editing .env files:
      </text:p>
      <text:p text:style-name="StandardText">
        • <text:span text:style-name="CodeText">Dashboard (/northpole)</text:span>: Live telemetry counters for users, operations, leads, and workshop testers.<text:line-break/>
        • <text:span text:style-name="CodeText">System Config (/northpole/config)</text:span>: Theme switching, seasonal rotation, email provider credentials, maintenance mode, allowances &amp; pricing.<text:line-break/>
        • <text:span text:style-name="CodeText">User Roster (/northpole/users)</text:span>: Demerit modifier, account status, and workshop security tag toggle.<text:line-break/>
        • <text:span text:style-name="CodeText">Operations Oversight (/northpole/operations)</text:span>: Inspect all exchanges, status, budgets, and participant counts.
      </text:p>

      <!-- SECTION 7 -->
      <text:p text:style-name="Heading1">7. Santa's Workshop QA Lab (/workshop)</text:p>
      <text:p text:style-name="StandardText">
        Isolated testing laboratory accessible strictly to operatives with the <text:span text:style-name="CodeText">workshop</text:span> tag:
      </text:p>
      <text:p text:style-name="StandardText">
        • <text:span text:style-name="CodeText">/workshop/draw</text:span>: Interactive Sattolo derangement and 2-way target cascade swap bench.<text:line-break/>
        • <text:span text:style-name="CodeText">/workshop/lifecycle</text:span>: Virtual calendar date timeline and milestone countdown simulator.<text:line-break/>
        • <text:span text:style-name="CodeText">/workshop/scraper</text:span>: OpenGraph scraper test bench with SSRF defense and 2.5s fast failover.<text:line-break/>
        • <text:span text:style-name="CodeText">/workshop/email</text:span>: Encrypted transactional email template previewer and live dispatch tester.
      </text:p>

      <!-- SECTION 8 -->
      <text:p text:style-name="Heading1">8. Minimal Environment &amp; Runtime Settings</text:p>
      <text:p text:style-name="StandardText">
        To minimize application footprint, .env contains ONLY essential connection strings and bootstrap secrets. All runtime options are stored in the database (<text:span text:style-name="CodeText">SystemConfig</text:span>) and administered via /northpole:
      </text:p>

      <!-- Table: Config -->
      <table:table table:name="ConfigTable">
        <table:table-column table:number-columns-repeated="3"/>
        <table:table-row>
          <table:table-cell text:style-name="TableHeadCell"><text:p text:style-name="TableHeadText">Runtime Setting</text:p></table:table-cell>
          <table:table-cell text:style-name="TableHeadCell"><text:p text:style-name="TableHeadText">Default Value</text:p></table:table-cell>
          <table:table-cell text:style-name="TableHeadCell"><text:p text:style-name="TableHeadText">Management &amp; Scope</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">activeThemeId</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">winter_holiday</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">/northpole/config (winter, spring, summer, autumn)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">appMode</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">selfhosted</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">/northpole/config (&apos;selfhosted&apos; vs &apos;saas&apos;)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">altHome</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">&quot;&quot; (App Home)</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">/northpole/config (&apos;coming_soon&apos; for waitlist)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">emailProvider</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">auto</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">/northpole/config (brevo, smtp, resend, console)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">freeAnnualHostAllowance</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">1</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">/northpole/config (Free annual organizer limit)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">freeAnnualJoinAllowance</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">3</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">/northpole/config (Free annual participant limit)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">INITIAL_ADMIN_USERNAME</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">santa</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">.env / Bootstrap (Default Admin Username)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">INITIAL_ADMIN_EMAIL</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">admin@kovertklaus.com</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">.env / Bootstrap (Default Admin Email)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">INITIAL_ADMIN_PASSWORD</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">1sEcReTdEl!vErY</text:p></table:table-cell>
          <table:table-cell text:style-name="TableCell"><text:p text:style-name="TableText">.env / Bootstrap (Mandatory Reset on First Login)</text:p></table:table-cell>
        </table:table-row>
      </table:table>

      <text:p text:style-name="CalloutBox">
        End of Knowledge Base // Generated automatically by KovertKlaus Build Engine.
      </text:p>
    </office:text>
  </office:body>
</office:document-content>`;

  return [
    { name: 'mimetype', data: mimetype, compression: 0 },
    { name: 'META-INF/manifest.xml', data: manifestXml, compression: 8 },
    { name: 'meta.xml', data: metaXml, compression: 8 },
    { name: 'styles.xml', data: stylesXml, compression: 8 },
    { name: 'content.xml', data: contentXml, compression: 8 },
  ];
}

// Build Output
const outputDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'KovertKlaus_Knowledge_Base.odt');
const files = generateODTFiles();
const zipBuffer = createZipArchive(files);

fs.writeFileSync(outputPath, zipBuffer);
console.log(`[Success] Generated LibreOffice Writer .odt Knowledge Base at: ${outputPath} (${zipBuffer.length} bytes)`);
