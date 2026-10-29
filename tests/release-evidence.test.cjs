const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');
const {validateReleaseEvidence}=require('../scripts/release-evidence.cjs');
const source=path.resolve(__dirname,'..');
function fixture(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'release-evidence-'));
 try{
  for(const p of ['website/release.json','scripts/install-verified-mac.sh']){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.copyFileSync(path.join(source,p),path.join(root,p));}
  const tag=JSON.parse(fs.readFileSync(path.join(source,'website/release.json'))).tag;
  fs.cpSync(path.join(source,'docs/releases',tag),path.join(root,'docs/releases',tag),{recursive:true});
  const edit=(p,change)=>{const f=path.join(root,p);let d=JSON.parse(fs.readFileSync(f));change(d);fs.writeFileSync(f,JSON.stringify(d));};
  const folder=`docs/releases/${tag}/`;
  const rehash=name=>edit(folder+'release.json',m=>{const data=fs.readFileSync(path.join(root,folder,name));Object.assign(m.assets.find(a=>a.name===name),{size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});});
  fn({root,edit,folder,rehash,tag});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('published evidence passes offline consistency without binary downloads',()=>fixture(({root,tag})=>assert.equal(validateReleaseEvidence(root),tag)));
test('altered verification bytes and duplicate assets cannot pass',()=>{
 fixture(({root,folder})=>{fs.appendFileSync(path.join(root,folder,'SHA256SUMS.txt'),'\n');assert.throws(()=>validateReleaseEvidence(root),/text size/);});
 fixture(({root,edit,folder})=>{edit(folder+'release.json',m=>m.assets[0]=m.assets[1]);assert.throws(()=>validateReleaseEvidence(root),/seven unique/);});
});
test('rehashing a failed, wrong-architecture or inconsistent signature record does not make it valid',()=>{
 for(const mutate of [d=>d.signature_verified=false,d=>d.staple_validated=false,d=>d.gatekeeper_assessment='rejected',d=>d.architecture='x64',d=>d.artifacts[Object.keys(d.artifacts)[0]]='0'.repeat(64)])fixture(({root,edit,folder,rehash,tag})=>{
  const name=`PositionScope-${tag.slice(1)}-arm64-verification.json`;edit(folder+name,mutate);rehash(name);assert.throws(()=>validateReleaseEvidence(root));
 });
});
test('wrong installer pins, release identity and cross-architecture download URLs fail closed',()=>{
 fixture(({root})=>{const p=path.join(root,'scripts/install-verified-mac.sh');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/ARM64_ZIP_SHA256='[^']+'/,'ARM64_ZIP_SHA256=\''+'0'.repeat(64)+'\''));assert.throws(()=>validateReleaseEvidence(root),/ZIP pin/);});
 for(const change of [s=>s.source_commit='0'.repeat(40),s=>s.downloads.arm64.zip=s.downloads.x64.zip,s=>s.tag='../other',s=>s.signed_and_notarized=false])fixture(({root,edit})=>{edit('website/release.json',change);assert.throws(()=>validateReleaseEvidence(root));});
});
