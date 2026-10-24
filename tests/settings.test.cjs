const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
test('restoring display defaults preserves all exchange and AI credentials', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-ui-settings-'));
  const load = Module._load;
  try {
    Module._load = function (id, ...args) {
      if (id === 'electron')
        return { app: { getPath: () => directory, setLoginItemSettings: () => {} } };
      return load.call(this, id, ...args);
    };
    const credentials = {
      binance: { apiKey: 'test-key', apiSecret: 'test-secret' },
      okx: { apiKey: 'okx-key', apiSecret: 'okx-secret', passphrase: 'test-passphrase' },
      hyperliquid: { apiKey: '0x' + '1'.repeat(40), apiSecret: '' },
    };
    const ai = {
      enabled: true,
      defaultProvider: 'deepseek',
      useCustomKeys: true,
      credentials: { deepseek: { provider: 'deepseek', apiKey: 'test-ai-key' } },
    };
    fs.writeFileSync(
      path.join(directory, 'settings.json'),
      JSON.stringify({
        exchanges: credentials,
        ai,
        theme: 'light',
        maxDisplayCount: 1,
        refreshInterval: 60,
        windowOpacity: 0.5,
        proxyUrl: 'http://localhost:7890',
      })
    );
    const { SettingsManager } = require('../dist/main/settings.js');
    const manager = new SettingsManager();
    const previousAI = manager.getAISettings();
    manager.resetToDefaults();
    assert.deepEqual(manager.getAllExchangesCredentials(), credentials);
    assert.deepEqual(manager.getAISettings(), previousAI);
    assert.equal(manager.hasExchangeCredentials('hyperliquid'), true);
    assert.equal(manager.getTheme(), 'dark');
    assert.equal(manager.getWindowOpacity(), 1);
    assert.deepEqual(manager.getDisplaySettings(), { maxDisplayCount: 2, refreshInterval: 5 });
    assert.equal(manager.getProxyUrl(), '');
  } finally {
    Module._load = load;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
