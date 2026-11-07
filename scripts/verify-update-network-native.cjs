// Public release metadata and a small verification JSON only. No account/model APIs.
const {app,session,net}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {updateNetwork}=require('../dist/main/services/update-network');
const {installTarget,verifyReleaseRecord}=require('../dist/main/services/update-install');
const {LATEST_RELEASE_URL}=require('../dist/main/services/app-updates');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'positionscope-network-smoke-'));
app.setPath('userData',profile);
const timeout=setTimeout(()=>{console.error('Public Electron update transport timed out');app.exit(1);},60000);
app.whenReady().then(async()=>{
 let stage='metadata';
 try{
  const isolated=session.fromPartition('positionscope-update-transport-smoke'),io=updateNetwork(options=>net.request({...options,session:isolated}));
  const release=JSON.parse((await io.read(LATEST_RELEASE_URL,1024*1024)).toString('utf8'));
  stage='manifest';const target=installTarget('0.0.0',release,process.arch);
  stage='verification-record';const record=await io.read(target.verificationUrl,256*1024);stage='verify-record';verifyReleaseRecord(record,target,process.getSystemVersion());
  const asset=release.assets.find(a=>a.browser_download_url===target.verificationUrl);
  stage='stream-download';await io.download({...target,url:target.verificationUrl,size:asset.size,sha256:target.verificationHash},path.join(profile,'verified-public-record'),()=>{});
  const result={platform:process.platform,public_release_metadata:true,isolated_electron_session:true,https_redirect_download:true,stream_sha256:true,artifact:'verification JSON only',real_account_data:false};
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/update-network-native.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  clearTimeout(timeout);fs.rmSync(profile,{recursive:true,force:true});app.exit(0);
 }catch(error){console.error(JSON.stringify({stage,status:Number.isInteger(error?.status)?error.status:null,category:['Update transport failed','Invalid update digest or size','Update not available','Invalid release record digest','Release not verified','Unsupported macOS version','Update checksum mismatch','Update host rejected'].find(x=>error?.message===x)||'transport_or_parse'}));clearTimeout(timeout);fs.rmSync(profile,{recursive:true,force:true});console.error('Public Electron update transport verification failed; response details withheld');app.exit(1);}
});
