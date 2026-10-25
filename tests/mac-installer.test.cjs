const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.join(__dirname, '../scripts/install-verified-mac.sh');

test('Mac installer is pinned to the published release and both verified ZIP digests', () => {
  const source = fs.readFileSync(script, 'utf8');
  const version = source.match(/^VERSION='([^']+)'/m)[1];
  const release = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/releases', 'v' + version, 'release.json')));
  assert.equal(release.signed_and_notarized, true);
  assert.equal(source.match(/^APP_ID='([^']+)'/m)[1], release.app_id);
  for (const [arch, key] of [['arm64', 'ARM64'], ['x64', 'X64']]) {
    const digest = source.match(new RegExp('^' + key + "_ZIP_SHA256='([^']+)'", 'm'))[1];
    assert.equal(digest, release.assets.find(asset => asset.name === `PositionScope-${version}-${arch}.zip`).sha256);
  }
  assert.equal(spawnSync('bash', ['-n', script]).status, 0);
});

test('Mac installer refuses a non-Mac host and unknown arguments before installation', () => {
  if (process.platform !== 'darwin') {
    const result = spawnSync('bash', [script], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /must run on your Mac; no files were changed/);
    assert.equal(result.stdout, '');
  }
  const unknown = spawnSync('bash', [script, '--erase-data'], { encoding: 'utf8' });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Usage:/);
});
