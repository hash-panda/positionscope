const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

// Offline consistency only. Apple signature/notarization checks remain native CI.
function validateReleaseEvidence(root) {
  const read = p => fs.readFileSync(path.join(root, p));
  const json = p => JSON.parse(read(p));
  const site = json('website/release.json');
  assert.match(site.version, /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/);
  const tag = 'v' + site.version;
  const folder = `docs/releases/${tag}/`;
  const manifest = json(folder + 'release.json');
  for (const key of ['version','tag','source_commit','app_id','published_at','ci_run_url']) assert.equal(site[key], manifest[key], key);
  assert.equal(site.tag, tag);
  assert.match(site.source_commit, /^[a-f0-9]{40}$/);
  assert.equal(site.app_id, 'app.funagent.positionscope');
  assert.equal(site.signed_and_notarized, true);
  assert.equal(manifest.signed_and_notarized, true);
  const prefix = `https://github.com/hash-panda/positionscope/releases/download/${tag}/`;
  const binaryNames = ['arm64','x64'].flatMap(a => ['zip','dmg'].map(k => `PositionScope-${site.version}-${a}.${k}`));
  const textNames = ['arm64','x64'].map(a => `PositionScope-${site.version}-${a}-verification.json`).concat('SHA256SUMS.txt');
  const expected = [...binaryNames, ...textNames].sort();
  assert.deepEqual(manifest.assets.map(a => a.name).sort(), expected, 'exact seven unique assets');
  const assets = new Map(manifest.assets.map(a => [a.name,a]));
  for (const asset of assets.values()) {
    assert.equal(asset.url, prefix + asset.name, 'exact immutable URL');
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(asset.size) && asset.size > 0);
  }
  for (const name of textNames) {
    const data = read(folder + name), asset = assets.get(name);
    assert.equal(data.length, asset.size, 'text size');
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256, 'text digest');
  }
  const lines = read(folder + 'SHA256SUMS.txt').toString().trim().split(/\r?\n/);
  const checksums = new Map();
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64}) [ *](\S+)$/);
    assert(match, 'checksum syntax');
    assert(!checksums.has(match[2]), 'duplicate checksum');
    checksums.set(match[2], match[1]);
  }
  assert.deepEqual([...checksums.keys()].sort(), binaryNames.slice().sort(), 'exact binary checksums');
  const installer = read('scripts/install-verified-mac.sh').toString();
  assert.equal(installer.match(/^VERSION='([^']+)'$/m)?.[1], site.version, 'installer version');
  for (const arch of ['arm64','x64']) {
    const name = `PositionScope-${site.version}-${arch}-verification.json`;
    const record = json(folder + name);
    assert.equal(site.verification_records[arch], prefix + name);
    assert.equal(record.version, site.version);
    assert.equal(record.architecture, arch);
    assert.equal(record.app_id, site.app_id);
    assert.equal(record.minimum_macos_version, site.minimum_macos_versions[arch]);
    assert.equal(manifest.minimum_macos_versions[arch], record.minimum_macos_version);
    assert.equal(record.signature_verified, true);
    assert.equal(record.staple_validated, true);
    assert.equal(record.gatekeeper_assessment, 'accepted');
    for (const key of ['app_notarization','dmg_notarization']) assert.match(record[key], /^[a-f0-9-]{36}$/);
    const names = ['zip','dmg'].map(k => `PositionScope-${site.version}-${arch}.${k}`);
    assert.deepEqual(Object.keys(record.artifacts).sort(), names.slice().sort());
    for (const kind of ['zip','dmg']) {
      const binary = `PositionScope-${site.version}-${arch}.${kind}`;
      assert.equal(site.downloads[arch][kind], prefix + binary);
      assert.equal(record.artifacts[binary], assets.get(binary).sha256, 'record binary digest');
      assert.equal(checksums.get(binary), assets.get(binary).sha256, 'checksum binary digest');
    }
    const key = arch.toUpperCase() + '_ZIP_SHA256';
    assert.equal(installer.match(new RegExp(`^${key}='([a-f0-9]{64})'$`, 'm'))?.[1], assets.get(names[0]).sha256, 'installer ZIP pin');
  }
  assert.equal(site.checksums, prefix + 'SHA256SUMS.txt');
  return tag;
}
module.exports = {validateReleaseEvidence};
