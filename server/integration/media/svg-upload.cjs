const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = ({ upload, flat, site, api, png }) => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50"><defs><style>.red{fill:#f00}.blue{fill:#00f}</style></defs><rect width="100" height="50" class="red"/><rect x="100" width="100" height="50" class="blue"/></svg>'
  );
  const fields = { context: 'system', systemImageType: 'logo' };
  const uploadPath = path.join(api, 'upload_file.php');
  const current = fs.readFileSync(uploadPath);
  // Disable only the new allowlist entry in the disposable copy. No .git requirement for Source ZIP users.
  const source = current.toString('utf8');
  const start = source.indexOf("  'logo' =>");
  const end = source.indexOf("  'favicon' =>", start);
  assert(start >= 0 && end > start, 'Actual logo type policy is required for the negative control');
  const baseline =
    source.slice(0, start) + "  'logo' => $standardImageTypes,\n" + source.slice(end);
  try {
    fs.writeFileSync(uploadPath, baseline);
    upload(flat, '/api/upload_file.php', fields, false, 'baseline.svg', svg, false);
  } finally {
    fs.writeFileSync(uploadPath, current);
  }
  for (const base of ['', '/zangetsu'])
    for (const role of ['admin', 'root'])
      for (const storage of ['flat', 'year_month']) {
        const result = upload(
          { ...flat, media: { ...flat.media, storage: { folderStructure: storage } } },
          base + '/api/upload_file.php',
          fields,
          false,
          'logo.svg',
          svg,
          true,
          'file',
          role
        );
        assert.equal(result.extension, 'svg');
        assert.equal(result.webpUrl, null);
        assert.equal(result.imageSrcSet, null);
        assert.equal(result.processed, null);
        assert.equal(result.responsiveVariantStatus, 'disabled');
        assert.equal(result.url, base + '/uploads/' + result.path);
        const bytes = fs.readFileSync(path.join(site, 'uploads', result.path), 'utf8');
        assert(bytes.includes('.red{fill:#f00}\n.blue{fill:#00f}'));
        assert.equal(
          JSON.parse(fs.readFileSync(path.join(site, 'data/last-row.json'))).filetype,
          'image/svg+xml'
        );
      }
  const before = fs.readdirSync(path.join(site, 'uploads'), { recursive: true }).sort();
  const rejected = (field, bytes = svg, name = 'blocked.svg', role = 'admin') => {
    upload(flat, '/api/upload_file.php', field, false, name, bytes, false, 'file', role);
    assert.deepEqual(
      fs.readdirSync(path.join(site, 'uploads'), { recursive: true }).sort(),
      before,
      'Rejected SVG created public filesystem entries'
    );
  };
  for (const field of [
    {},
    { context: 'system', systemImageType: 'favicon' },
    { context: 'system', systemImageType: 'ogImage' },
    { context: 'system', systemImageType: 'ogImageSquare' },
    { context: 'system', systemImageType: 'unknown' },
  ])
    rejected(field);
  for (const role of ['writer', 'moderator', 'member']) rejected(fields, svg, 'staff.svg', role);
  for (const text of [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="alert(1)"/>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">&x;</svg>',
    '<html><script>alert(1)</script></html>',
  ])
    rejected(fields, Buffer.from(text));
  rejected(fields, svg, 'spoof.png');
  rejected(fields, png, 'spoof.svg');
  rejected(
    fields,
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><desc>' +
        'x'.repeat(1048576) +
        '</desc></svg>'
    )
  );
  upload(flat, '/api/upload_file.php', fields, true, 'db-failure.svg', svg, false);
  assert.deepEqual(
    fs.readdirSync(path.join(site, 'uploads'), { recursive: true }).sort(),
    before,
    'Database failure left a sanitized SVG orphan'
  );
  console.log(
    'PASS SVG logo multipart: baseline refusal/current acceptance, Admin/root only, root/subfolder flat/date storage, sniffed MIME, static CSS, no GD/WebP, blocked other contexts/roles/active SVG and failure cleanup. Session/CSRF/DB transport stubbed; real PHP CGI upload/parser/filesystem.'
  );
};
