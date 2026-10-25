const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { SettingsManager } = require('../dist/main/settings');

async function context(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'positionscope-vault-'));
  const key = crypto.randomBytes(32);
  const cipher = {
    available: async () => true,
    encrypt: async text => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv); const bytes = Buffer.concat([c.update(text, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), bytes]); },
    decrypt: async bytes => { const d = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); d.setAuthTag(bytes.subarray(12, 28)); return { result: Buffer.concat([d.update(bytes.subarray(28)), d.final()]).toString(), shouldReEncrypt: false }; },
  };
  const vault = path.join(directory, 'settings.vault.json');
  const open = () => SettingsManager.open(directory, cipher);
  try { await run({ directory, vault, cipher, open }); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
const credentials = {
  okx: { apiKey: 'synthetic-okx-key', apiSecret: 'synthetic-okx-secret', passphrase: 'synthetic-passphrase' },
  hyperliquid: { apiKey: '0x' + '1'.repeat(40), apiSecret: '' },
};
const ai = { enabled: true, defaultProvider: 'deepseek', useCustomKeys: true,
  credentials: { deepseek: { provider: 'deepseek', apiKey: 'synthetic-ai-key' } } };

test('new settings are encrypted-only on disk, reload independently and preserve reset/removal semantics', () => context(async ({ open, vault, directory }) => {
  const manager = await open();
  assert.equal(manager.getStorageStatus().state, 'empty');
  await manager.setExchangeCredentials('okx', credentials.okx);
  await manager.setExchangeCredentials('hyperliquid', credentials.hyperliquid);
  await manager.setAISettings(ai);
  await manager.setProxyUrl('http://synthetic-user:synthetic-password@localhost:7890');
  assert.equal(manager.getStorageStatus().state, 'encrypted');
  const disk = fs.readFileSync(vault, 'utf8');
  for (const secret of ['synthetic-okx-key', 'synthetic-passphrase', 'synthetic-ai-key', 'synthetic-password']) assert.equal(disk.includes(secret), false);
  assert.deepEqual(Object.keys(JSON.parse(disk)).sort(), ['ciphertext', 'format', 'version']);
  assert.equal(fs.statSync(vault).mode & 0o777, 0o600);
  const reloaded = await open();
  assert.deepEqual(reloaded.getAllExchangesCredentials(), credentials);
  const previousAI = reloaded.getAISettings();
  await reloaded.resetToDefaults();
  assert.deepEqual(reloaded.getAllExchangesCredentials(), credentials);
  assert.deepEqual(reloaded.getAISettings(), previousAI);
  assert.equal(reloaded.getProxyUrl(), '');
  await reloaded.removeExchangeCredentials('okx');
  const removed = await open();
  assert.equal(removed.hasExchangeCredentials('okx'), false);
  assert.equal(removed.hasExchangeCredentials('hyperliquid'), true);
  assert.equal(removed.getAIProviderCredentials('deepseek').apiKey, 'synthetic-ai-key');
  await removed.clearSettings();
  assert.equal(removed.getStorageStatus().state, 'empty');
  assert.deepEqual(fs.readdirSync(directory), []);
}));

test('unavailable encryption, encrypt failure or failed read-back never writes plaintext or commits memory', async () => {
  for (const failure of ['unavailable', 'encrypt', 'verify']) await context(async ({ open, cipher, directory }) => {
    const manager = await open();
    if (failure === 'unavailable') cipher.available = async () => false;
    if (failure === 'encrypt') cipher.encrypt = async () => { throw new Error('synthetic-secret'); };
    if (failure === 'verify') cipher.decrypt = async () => ({ result: 'mismatch' });
    await assert.rejects(manager.setExchangeCredentials('okx', credentials.okx), /不会使用明文/);
    assert.equal(manager.hasExchangeCredentials('okx'), false);
    assert.deepEqual(fs.readdirSync(directory), []);
  });
});

test('write/fsync/rename failures preserve committed credentials and leave no temporary files', async () => {
  for (const operation of ['writeFileSync', 'fsyncSync', 'renameSync']) await context(async ({ open, vault, directory }) => {
    const manager = await open(); await manager.setExchangeCredentials('okx', credentials.okx);
    const previous = fs.readFileSync(vault, 'utf8'), original = fs[operation];
    try { fs[operation] = () => { throw new Error('synthetic disk full'); };
      await assert.rejects(manager.removeExchangeCredentials('okx'), /设置未保存/);
    } finally { fs[operation] = original; }
    assert.equal(manager.hasExchangeCredentials('okx'), true);
    assert.equal(fs.readFileSync(vault, 'utf8'), previous);
    assert.deepEqual(fs.readdirSync(directory), ['settings.vault.json']);
    await manager.setTheme('light');
    assert.equal((await open()).getTheme(), 'light');
  });
});

test('locked, corrupt, unsupported and temporarily unavailable vaults stay blocked without leaking secret errors', async () => {
  for (const failure of ['locked', 'corrupt', 'version', 'payload', 'temporary']) await context(async ({ open, cipher, vault }) => {
    const original = await open(); await original.setExchangeCredentials('okx', credentials.okx);
    if (failure === 'locked') cipher.available = async () => false;
    if (failure === 'corrupt') fs.writeFileSync(vault, '{synthetic-secret-bad-json');
    if (failure === 'version') { const data = JSON.parse(fs.readFileSync(vault)); data.version = 99; fs.writeFileSync(vault, JSON.stringify(data)); }
    if (failure === 'payload') cipher.decrypt = async () => ({ result: '{synthetic-secret-bad-json' });
    if (failure === 'temporary') cipher.decrypt = async () => ({ result: '', isTemporarilyUnavailable: true });
    const before = fs.readFileSync(vault, 'utf8'), log = console.error, messages = [];
    let blocked;
    try { console.error = (...args) => messages.push(args.join(' ')); blocked = await open(); }
    finally { console.error = log; }
    assert.equal(blocked.getStorageStatus().state, 'blocked');
    assert.deepEqual(blocked.getAllExchangesCredentials(), {}); assert.equal(blocked.isAIEnabled(), false);
    await assert.rejects(blocked.setTheme('dark'), /原文件已保留/);
    assert.equal(fs.readFileSync(vault, 'utf8'), before);
    assert.equal(messages.join('\n').includes('synthetic-secret'), false);
    await blocked.clearSettings();
    assert.equal(fs.existsSync(vault), false);
  });
});

test('concurrent asynchronous saves serialize and publish only committed snapshots', () => context(async ({ open, cipher }) => {
  const manager = await open(), encrypt = cipher.encrypt;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  cipher.encrypt = async value => { entered(); await gate; return encrypt(value); };
  const first = manager.setTheme('light'); await started;
  const input = structuredClone(credentials.okx);
  const second = manager.setExchangeCredentials('okx', input);
  input.apiKey = 'caller mutation';
  const third = manager.setAISettings(ai);
  assert.equal(manager.getTheme(), 'auto'); assert.equal(manager.hasExchangeCredentials('okx'), false);
  release(); await Promise.all([first, second, third]);
  const saved = await open();
  assert.equal(saved.getTheme(), 'light'); assert.equal(saved.getExchangeCredentials('okx').apiKey, credentials.okx.apiKey);
  assert.equal(saved.getAIProviderCredentials('deepseek').apiKey, 'synthetic-ai-key');
  const exposed = saved.getAllExchangesCredentials(); exposed.okx.apiSecret = 'caller mutation';
  assert.equal(saved.getExchangeCredentials('okx').apiSecret, credentials.okx.apiSecret);
}));

test('key rotation rewrites verified ciphertext before making settings available', () => context(async ({ open, cipher, vault }) => {
  const manager = await open(); await manager.setTheme('dark');
  const previous = fs.readFileSync(vault, 'utf8'), decrypt = cipher.decrypt;
  let first = true;
  cipher.decrypt = async bytes => { const value = await decrypt(bytes); if (first) { first = false; value.shouldReEncrypt = true; } return value; };
  const reloaded = await open();
  assert.equal(reloaded.getStorageStatus().state, 'encrypted'); assert.equal(reloaded.getTheme(), 'dark');
  assert.notEqual(fs.readFileSync(vault, 'utf8'), previous);
}));

test('failed deletion preserves both disk and in-memory settings', () => context(async ({ open, vault }) => {
  const manager = await open(); await manager.setExchangeCredentials('okx', credentials.okx);
  const previous = fs.readFileSync(vault, 'utf8'), unlink = fs.unlinkSync;
  try { fs.unlinkSync = () => { throw new Error('denied'); }; await assert.rejects(manager.clearSettings(), /原加密配置已保留/); }
  finally { fs.unlinkSync = unlink; }
  assert.equal(manager.hasExchangeCredentials('okx'), true); assert.equal(fs.readFileSync(vault, 'utf8'), previous);
}));
