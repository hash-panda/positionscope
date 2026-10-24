const { build } = require('../package.json');
const identity = process.env.APPLE_SIGNING_IDENTITY;
const prefix = 'Developer ID Application:';
if (!identity?.startsWith(prefix)) throw new Error('A Developer ID Application identity is required');
// electron-builder 24 rejects Apple certificate-type prefixes in its selector.
// Keep the full identity in APPLE_SIGNING_IDENTITY for native codesign verification.
module.exports = {
  ...build,
  forceCodeSigning: true,
  mac: {
    ...build.mac,
    identity: identity.slice(prefix.length).trim(),
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    target: ['dir'],
  },
};
