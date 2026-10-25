// Isolated synthetic profile and real macOS system encryption; no production account data.
const { app, safeStorage } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = process.env.POSITIONSCOPE_STORAGE_TEST_PROFILE;
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.split('=')[1];
if (process.env.POSITIONSCOPE_STORAGE_TEST !== '1' || process.platform !== 'darwin' ||
    !profile || !path.basename(profile).startsWith('positionscope-storage-') || !['save', 'reload'].includes(phase)) {
  throw new Error('Native storage test requires an isolated macOS test profile');
}
app.setName('PositionScope Storage CI'); app.setPath('userData', profile);
app.whenReady().then(async () => {
  console.log('Native storage phase:', phase);
  assert(await safeStorage.isAsyncEncryptionAvailable());
  const { SettingsManager } = require('../dist/main/settings');
  const { macSettingsCipher } = require('../dist/main/settings-crypto');
  const vault = path.join(profile, 'settings.vault.json');
  const manager = await SettingsManager.open(profile, macSettingsCipher);
  if (phase === 'save') {
    assert.equal(manager.getStorageStatus().state, 'empty');
    await manager.setExchangeCredentials('okx', { apiKey: 'synthetic-native-key', apiSecret: 'synthetic-native-secret', passphrase: 'synthetic-native-passphrase' });
    await manager.setAIProviderCredentials('deepseek', { provider: 'deepseek', apiKey: 'synthetic-native-model-key' });
    await manager.setTheme('dark');
    assert.equal(manager.getStorageStatus().state, 'encrypted');
    assert.equal(fs.readFileSync(vault, 'utf8').includes('synthetic-native'), false);
    console.log('Native asynchronous system encryption passed');
  } else {
    assert.equal(manager.getStorageStatus().state, 'encrypted');
    assert.equal(manager.getTheme(), 'dark');
    assert.equal(manager.getExchangeCredentials('okx').passphrase, 'synthetic-native-passphrase');
    await manager.resetToDefaults();
    assert.equal((await SettingsManager.open(profile, macSettingsCipher)).getExchangeCredentials('okx').apiSecret, 'synthetic-native-secret');
    await manager.removeExchangeCredentials('okx');
    const removed = await SettingsManager.open(profile, macSettingsCipher);
    assert.equal(removed.hasExchangeCredentials('okx'), false);
    assert.equal(removed.getAIProviderCredentials('deepseek').apiKey, 'synthetic-native-model-key');
    await removed.clearSettings(); assert.equal(fs.existsSync(vault), false);
    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync('test-results/storage-native.json', JSON.stringify({
      platform: process.platform, electron: process.versions.electron,
      asynchronous_system_encryption: true, cross_process_reload: true,
      reset_preserves_credentials: true, targeted_removal: true, deletion: true,
      synthetic_profile_only: true, packaged_app_keychain_prompt_tested: false,
    }, null, 2));
    console.log('Native cross-process reload, reset, removal and deletion passed');
  }
  app.exit(0);
}).catch(() => { console.error('Native storage smoke verification failed:', phase); app.exit(1); });
