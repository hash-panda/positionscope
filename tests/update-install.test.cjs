const {test}=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');
const {Readable}=require('node:stream');const fs=require('node:fs/promises');const {tmpdir}=require('node:os');const path=require('node:path');const {createHash}=require('node:crypto');
const {installTarget,verifyReleaseRecord,writeVerifiedPackage,serveVerifiedUpdate,UpdateInstaller}=require('../dist/main/services/update-install');
const {updateNetwork,allowedUpdateURL}=require('../dist/main/services/update-network');
const hash=b=>createHash('sha256').update(b).digest('hex');const zip=Buffer.from('synthetic package, not an actual application');
function fixture(){const version='0.2.3',arch='arm64',base=`https://github.com/hash-panda/positionscope/releases/download/v${version}`;
 const record=Buffer.from(JSON.stringify({version,architecture:arch,app_id:'app.funagent.positionscope',minimum_macos_version:'13.0',signature_verified:true,staple_validated:true,gatekeeper_assessment:'accepted',app_notarization:'11111111-1111-1111-1111-111111111111',artifacts:{[`PositionScope-${version}-${arch}.zip`]:hash(zip)}}));
 const release={tag_name:'v'+version,draft:false,prerelease:false,html_url:`https://github.com/hash-panda/positionscope/releases/tag/v${version}`,assets:['arm64','x64'].flatMap(a=>['dmg','zip'].map(ext=>`PositionScope-${version}-${a}.${ext}`).concat(`PositionScope-${version}-${a}-verification.json`)).concat('SHA256SUMS.txt').map(name=>({name,state:'uploaded',size:name.endsWith('.zip')?zip.length:record.length,browser_download_url:base+'/'+name,digest:'sha256:'+hash(name.endsWith('.zip')?zip:record)}))};return{release,record,target:installTarget('0.2.2',release,arch)};
}
test('installation requires complete official assets, correct architecture and SHA256 metadata',()=>{
 const {release,target,record}=fixture();assert.equal(target.version,'0.2.3');assert.equal(target.size,zip.length);verifyReleaseRecord(record,target);assert.throws(()=>verifyReleaseRecord(record,target,'12.7'));verifyReleaseRecord(record,target,'14.0');
 assert.throws(()=>installTarget('0.2.3',release,'arm64'));assert.throws(()=>installTarget('0.2.2',release,'mips'));
 for(const mutate of [r=>r.assets[1].digest=null,r=>r.assets[1].size=1024**3,r=>r.assets[2].digest='sha256:bad']){const r=structuredClone(release);mutate(r);assert.throws(()=>installTarget('0.2.2',r,'arm64'));}
 assert.throws(()=>verifyReleaseRecord(Buffer.from('tampered'),target));
 for(const change of [{signature_verified:false},{architecture:'x64'},{app_id:'other.app'},{staple_validated:false},{gatekeeper_assessment:'rejected'}]){const data=Buffer.from(JSON.stringify({...JSON.parse(record),...change}));assert.throws(()=>verifyReleaseRecord(data,{...target,verificationHash:hash(data)}));}
});
test('streaming verification rejects truncated, oversized, wrong-hash and interrupted downloads and removes partial files',async()=>{
 const dir=await fs.mkdtemp(path.join(tmpdir(),'ps-test-'));try{const target=fixture().target;let n=0;
 for(const bytes of [Buffer.alloc(0),zip.subarray(1),Buffer.concat([zip,zip]),Buffer.alloc(zip.length,1)]){const file=path.join(dir,String(n++));await assert.rejects(writeVerifiedPackage(Readable.from([bytes]),file,target,()=>{}));await assert.rejects(fs.stat(file));}
 const file=path.join(dir,'valid'),progress=[];await writeVerifiedPackage(Readable.from([zip.subarray(0,5),zip.subarray(5)]),file,target,p=>progress.push(p));assert.deepEqual(await fs.readFile(file),zip);assert(progress.every(p=>p<100));
 const interrupted=path.join(dir,'interrupted');await assert.rejects(writeVerifiedPackage(Readable.from((async function*(){yield zip.subarray(0,5);throw new Error('synthetic-secret');})()),interrupted,target,()=>{}));await assert.rejects(fs.stat(interrupted));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
function requestFactory({redirects=[],body='12345',status=200}={},calls=[]) {
 return options=>{
  const req=new EventEmitter();req.headers={};req.aborted=false;req.followed=0;calls.push({options,req});
  req.setHeader=(key,value)=>req.headers[key]=value;
  req.abort=()=>{req.aborted=true;req.emit('error',new Error('synthetic-private-details'));};
  req.followRedirect=()=>{req.followed++;};
  req.end=()=>setImmediate(()=>{
   for(const url of redirects){const before=req.followed;req.emit('redirect',302,'GET',url);if(req.aborted)return;if(req.followed===before){req.emit('error',new Error('Redirect was cancelled'));return;}}
   const stream=Readable.from([Buffer.from(body)]);stream.statusCode=status;req.emit('response',stream);
  });return req;
 };
}
test('native redirect event follows only approved HTTPS hosts and omits cookies/auth',async()=>{
 for(const u of ['http://github.com/a','https://github.com.evil.test/a','https://user:password@github.com/a','https://localhost/a','file:///tmp/a','https://github.com:444/a'])assert.equal(allowedUpdateURL(u),false);
 const url=fixture().target.url,calls=[];
 const io=updateNetwork(requestFactory({redirects:['https://release-assets.githubusercontent.com/synthetic']},calls));assert.equal((await io.read(url,5)).toString(),'12345');
 assert.equal(calls[0].req.followed,1);assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.useSessionCookies,false);assert.equal(calls[0].options.redirect,'manual');
 for(const redirects of [['http://127.0.0.1/secret'],Array(4).fill('https://release-assets.githubusercontent.com/synthetic')]){
  const rejected=[];await assert.rejects(updateNetwork(requestFactory({redirects},rejected)).read(url,10),/redirect rejected/);assert(rejected[0].req.followed<redirects.length);
 }
 await assert.rejects(updateNetwork(requestFactory()).read(url,4),/oversized/);
 await assert.rejects(updateNetwork(requestFactory({status:403})).read(url,10),error=>error.status===403&&!String(error).includes('private'));
});
test('one download at a time, ready only after native verification, retry safe and no error payload exposed',async()=>{
 const {release,record}=fixture(), native=new EventEmitter();let installs=0,checks=0,download=0,releaseDownload;
 native.setFeedURL=()=>{};native.checkForUpdates=()=>checks++;native.quitAndInstall=()=>installs++;
 const dir=await fs.mkdtemp(path.join(tmpdir(),'ps-test-'));let corrupt=false;
 const io={read:async url=>url.endsWith('/latest')?Buffer.from(JSON.stringify(release)):record,download:async()=>{download++;await new Promise(r=>releaseDownload=r);if(corrupt)throw Error('synthetic-secret');},serve:async()=>({url:'http://127.0.0.1/feed',close(){}})};
 const changes=[],u=new UpdateInstaller('0.2.2','arm64',true,dir,native,io,x=>changes.push(x));
 try{assert.equal(u.restart(),false);assert.equal((await u.check()).state,'available');const pending=u.download();while(!releaseDownload)await new Promise(r=>setImmediate(r));assert.equal((await u.download()).state,'downloading');assert.equal((await u.check()).state,'downloading');assert.equal(download,1);releaseDownload();await pending;assert.equal(checks,1);assert.equal(u.snapshot().state,'verifying');assert.equal(u.restart(),false);
 native.emit('update-downloaded');assert.equal(u.snapshot().state,'ready');assert.equal(u.restart(),true);assert.equal(installs,1);assert.equal(u.restart(),false);assert.equal((await u.check()).state,'ready');
 }finally{u.dispose();await fs.rm(dir,{recursive:true,force:true});}
 const failure=new UpdateInstaller('0.2.2','arm64',true,tmpdir(),native,{...io,download:async()=>{throw Error('secret response');}},()=>{});await failure.check();assert.equal((await failure.download()).state,'unavailable');assert(!JSON.stringify(failure.snapshot()).includes('secret'));assert.equal(failure.restart(),false);assert.equal((await failure.check()).state,'available');failure.dispose();
});
test('loopback server serves exact token paths only and rejects other host/origin/method',async()=>{
 const dir=await fs.mkdtemp(path.join(tmpdir(),'ps-feed-'));let bridge;try{const {target}=fixture(),file=path.join(dir,'zip');await fs.writeFile(file,zip);bridge=await serveVerifiedUpdate(file,target);
 const r=await fetch(bridge.url),feed=await r.json();assert.equal(feed.sha256,target.sha256);assert.deepEqual(Buffer.from(await (await fetch(feed.url)).arrayBuffer()),zip);
 assert.equal((await fetch(new URL('/anything',bridge.url))).status,404);assert.equal((await fetch(bridge.url,{method:'POST'})).status,403);assert.equal((await fetch(bridge.url,{headers:{Origin:'https://evil.test'}})).status,403);assert.equal(await new Promise((resolve,reject)=>{require('node:http').get(bridge.url,{headers:{Host:'evil.test'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);}),403);
 }finally{bridge?.close();await fs.rm(dir,{recursive:true,force:true});}
});
