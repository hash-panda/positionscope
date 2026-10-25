import { safeStorage } from 'electron';
import type { SettingsCipher } from './settings';

// PositionScope ships for macOS; never accept an unverified fallback provider.
export const macSettingsCipher: SettingsCipher = {
  available: async () => process.platform === 'darwin' && await safeStorage.isAsyncEncryptionAvailable(),
  encrypt: value => safeStorage.encryptStringAsync(value),
  decrypt: value => safeStorage.decryptStringAsync(value),
};
