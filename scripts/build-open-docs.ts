import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * Minimal in-memory zip builder for creating standard OpenDocument (.odt / .ods) files
 * without external dependencies.
 */
class OdfZipBuilder {
  private files: { name: string; data: Buffer; isCompressed: boolean }[] = [];

  addFile(name: string, content: string | Buffer, compress = true) {
    const data = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    this.files.push({ name, data, isCompressed: compress });
  }

  // Calculate standard CRC32
  private crc32(buf: Buffer): number {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ this.table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  private table: number[] = (() => {
    let c: number;
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  })();

  build(): Buffer {
    const localHeaders: Buffer[] = [];
    const centralHeaders: Buffer[] = [];
    let offset = 0;

    for (const f of this.files) {
      const isStored = !f.isCompressed || f.name === 'mimetype';
      const compressedData = isStored ? f.data : zlib.deflateRawSync(f.data);
      const crc = this.crc32(f.data);
      const nameBuf = Buffer.from(f.name, 'utf-8');

      // Local Header (30 bytes + name + data)
      const localHdr = Buffer.alloc(30);
      localHdr.writeUInt32LE(0x04034b50, 0); // Signature
      localHdr.writeUInt16LE(20, 4); // Min version
      localHdr.writeUInt16LE(0, 6); // Flags
      localHdr.writeUInt16LE(isStored ? 0 : 8, 8); // Compression (0=stored, 8=deflate)
      localHdr.writeUInt16LE(0, 10); // Mod time
      localHdr.writeUInt16LE(0, 12); // Mod date
      localHdr.writeUInt32LE(crc, 14); // CRC32
      localHdr.writeUInt32LE(compressedData.length, 18); // Compressed size
      localHdr.writeUInt32LE(f.data.length, 22); // Uncompressed size
      localHdr.writeUInt16LE(nameBuf.length, 26); // Name length
      localHdr.writeUInt16LE(0, 28); // Extra length

      const localBlock = Buffer.concat([localHdr, nameBuf, compressedData]);
      localHeaders.push(localBlock);

      // Central Directory Header (46 bytes + name)
      const centralHdr = Buffer.alloc(46);
      centralHdr.writeUInt32LE(0x02014b50, 0); // Signature
      centralHdr.writeUInt16LE(20, 4); // Version made by
      centralHdr.writeUInt16LE(20, 6); // Version needed
      centralHdr.writeUInt16LE(0, 8); // Flags
      centralHdr.writeUInt16LE(isStored ? 0 : 8, 10); // Compression
      centralHdr.writeUInt16LE(0, 12); // Mod time
      centralHdr.writeUInt16LE(0, 14); // Mod date
      centralHdr.writeUInt32LE(crc, 16); // CRC32
      centralHdr.writeUInt32LE(compressedData.length, 20); // Compressed size
      centralHdr.writeUInt32LE(f.data.length, 24); // Uncompressed size
      centralHdr.writeUInt16LE(nameBuf.length, 28); // Name length
      centralHdr.writeUInt16LE(0, 30); // Extra field length
      centralHdr.writeUInt16LE(0, 32); // Comment length
      centralHdr.writeUInt16LE(0, 34); // Disk num
      centralHdr.writeUInt16LE(0, 36); // Internal attributes
      centralHdr.writeUInt32LE(0, 38); // External attributes
      centralHdr.writeUInt32LE(offset, 42); // Relative offset of local header

      centralHeaders.push(Buffer.concat([centralHdr, nameBuf]));
      offset += localBlock.length;
    }

    const centralDir = Buffer.concat(centralHeaders);

    // End of Central Directory Record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // Signature
    eocd.writeUInt16LE(0, 4); // Disk num
    eocd.writeUInt16LE(0, 6); // Disk with central dir
    eocd.writeUInt16LE(this.files.length, 8); // Entries on disk
    eocd.writeUInt16LE(this.files.length, 10); // Total entries
    eocd.writeUInt32LE(centralDir.length, 12); // Central dir size
    eocd.writeUInt32LE(offset, 16); // Offset of start of central dir
    eocd.writeUInt16LE(0, 20); // Comment length

    return Buffer.concat([...localHeaders, centralDir, eocd]);
  }
}

// 1. Create Knowledge Base ODT
function createKnowledgeBaseOdt(outputPath: string) {
  const zip = new OdfZipBuilder();
  zip.addFile('mimetype', 'application/vnd.oasis.opendocument.text', false);

  zip.addFile(
    'META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`
  );

  zip.addFile(
    'meta.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">
  <office:meta>
    <dc:title>KovertKlaus Administrator &amp; Operations Knowledge Base</dc:title>
    <dc:creator>KovertKlaus Engineering Team</dc:creator>
    <dc:date>${new Date().toISOString()}</dc:date>
  </office:meta>
</office:document-meta>`
  );

  zip.addFile(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.2">
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:text-properties style:font-name="Arial" style:font-size="11pt"/>
    </style:default-style>
  </office:styles>
</office:document-styles>`
  );

  zip.addFile(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.2">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">KovertKlaus — Master Operational Knowledge Base &amp; Runbook</text:h>
      <text:p>Classification: Public Administrative Guide | Target Version: v0.1.0-prealpha to v1.0.0-beta</text:p>
      <text:p></text:p>
      <text:h text:outline-level="2">1. System Purpose &amp; Operational Philosophy</text:h>
      <text:p>KovertKlaus transforms traditional holiday gift exchanges into covert holiday operations governed by automated reliability tracking (Coal Citations), 100% bidirectional match exclusion rules, and automated carrier tracking waivers.</text:p>
      <text:p></text:p>
      <text:h text:outline-level="2">2. Demerit Reliability Policy &amp; Non-Intermediary Principle</text:h>
      <text:p>KovertKlaus administrators do not arbitrate gift disputes. Penalties (Coal Citations) are strictly assessed based on objective shipping deadlines. Submitting a valid carrier tracking number waives demerits if parcels are lost by carriers.</text:p>
      <text:p>• 0-2 Citations: ACTIVE standing (Full access).</text:p>
      <text:p>• 3 Citations: REMOTE_RESTRICTED standing (Restricted strictly to in-person/local missions).</text:p>
      <text:p>• &gt;3 Citations: DISABLED standing (Suspended).</text:p>
      <text:p>• Automated Rehabilitation: Fulfilling any subsequent exchange removes 1 Coal Citation and restores standing.</text:p>
      <text:p></text:p>
      <text:h text:outline-level="2">3. Universal Transactional Email Engine</text:h>
      <text:p>KovertKlaus features a multi-provider dispatcher supporting Brevo REST API, Direct SMTP, Resend, and Console mocks. All transactional emails are protected by an automated 3-attempt exponential backoff retry loop (500ms, 1500ms, 3000ms).</text:p>
      <text:p></text:p>
      <text:h text:outline-level="2">4. North Pole Command Console (/northpole)</text:h>
      <text:p>Administrative oversight is governed by a lookup-only architecture to minimize server I/O. Administrators query records on demand by User ID, Email, Codename, or Operation Code.</text:p>
    </office:text>
  </office:body>
</office:document-content>`
  );

  fs.writeFileSync(outputPath, zip.build());
  console.log(`✅ Generated: ${outputPath}`);
}

// 2. Create Configuration Matrix ODS
function createConfigurationMatrixOds(outputPath: string) {
  const zip = new OdfZipBuilder();
  zip.addFile('mimetype', 'application/vnd.oasis.opendocument.spreadsheet', false);

  zip.addFile(
    'META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`
  );

  zip.addFile(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.2">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Environment Matrix">
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>Variable Name</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Required</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Default</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Description</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>SESSION_SECRET</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>YES (Prod)</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>kovertklaus_dev_key</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>HMAC-SHA256 signing secret for session tokens</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>DATABASE_URL</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>YES</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>postgresql://user:pass@host:5432/neondb</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Pooled database connection string</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>BREVO_API_KEY</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Optional</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>xkeysib-...</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Brevo transactional email API key</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>APP_MODE</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Optional</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>selfhosted</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Open-core feature mode (selfhosted | saas)</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>`
  );

  fs.writeFileSync(outputPath, zip.build());
  console.log(`✅ Generated: ${outputPath}`);
}

const docsDir = path.join(process.cwd(), 'docs');
createKnowledgeBaseOdt(path.join(docsDir, 'KovertKlaus_Knowledge_Base.odt'));
createKnowledgeBaseOdt(path.join(docsDir, 'KovertKlaus_Technical_Specification.odt'));
createConfigurationMatrixOds(path.join(docsDir, 'KovertKlaus_Configuration_Matrix.ods'));
