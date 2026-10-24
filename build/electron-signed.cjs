const {build}=require('../package.json');
if(!process.env.APPLE_SIGNING_IDENTITY?.startsWith('Developer ID Application:')) throw new Error('A Developer ID Application identity is required');
module.exports={...build,forceCodeSigning:true,mac:{...build.mac,identity:process.env.APPLE_SIGNING_IDENTITY,hardenedRuntime:true,entitlements:'build/entitlements.mac.plist',entitlementsInherit:'build/entitlements.mac.plist',target:['dir']}};
