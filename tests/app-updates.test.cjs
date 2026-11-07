const {test} = require('node:test');
const assert = require('node:assert/strict');
const {inspectLatestRelease, isNewerStableVersion} = require('../dist/main/services/app-updates');
function release(version='0.2.1') {
  const tag = `v${version}`, base = 'https://github.com/hash-panda/positionscope/releases';
  return {tag_name:tag, draft:false, prerelease:false, html_url:`${base}/tag/${tag}`, assets:
    ['arm64','x64'].flatMap(arch=>['dmg','zip'].map(ext=>`PositionScope-${version}-${arch}.${ext}`).concat(`PositionScope-${version}-${arch}-verification.json`)).concat('SHA256SUMS.txt')
      .map(name=>({name, state:'uploaded', size:100, browser_download_url:`${base}/download/${tag}/${name}`}))};
}
test('stable versions compare numerically, including update from the preview channel', () => {
  for (const [before,after,newer] of [['0.2.0-beta.16','0.2.1',true],['0.2.1-beta.1','0.2.1',true],['0.2.9','0.2.10',true],['0.2.1','0.2.1',false],['0.3.0','0.2.10',false],['1.0.0','0.99.0',false]]) assert.equal(isNewerStableVersion(before,after),newer);
  for (const bad of ['0.02.1','0.2','0.2.1-beta.17','0.2.1\n','0.2.9007199254740992','https://example.com']) assert.throws(()=>isNewerStableVersion('0.2.1',bad));
});
test('only complete stable official release assets offer the official release page', () => {
  const result=inspectLatestRelease('0.2.0-beta.16',release());
  assert.equal(result.state,'available');assert.equal(result.releaseUrl,'https://github.com/hash-panda/positionscope/releases/tag/v0.2.1');
  assert.equal(inspectLatestRelease('0.2.1',release()).state,'current');
  assert.equal(inspectLatestRelease('0.3.0',release()).state,'current');
  const mutations=[r=>r.draft=true,r=>r.prerelease=true,r=>r.tag_name='v0.2.1-beta.1',r=>r.html_url='http://github.com/hash-panda/positionscope/releases/tag/v0.2.1',r=>r.html_url+='?redirect=evil',r=>r.assets.pop(),r=>r.assets.push(r.assets[0]),r=>r.assets[0].size=0,r=>r.assets[0].state='new',r=>r.assets[0].browser_download_url='https://github.com/other/project/releases/download/v0.2.1/file.dmg',r=>r.assets[0].browser_download_url+='?token=private'];
  for(const mutate of mutations){const r=release();mutate(r);const value=inspectLatestRelease('0.2.0-beta.16',r);assert.equal(value.state,'unavailable');assert.equal(value.releaseUrl,undefined);}
});
test('missing architecture, checksum or verification record fails closed',()=>{
  for(let index=0;index<7;index++){const value=release();value.assets.splice(index,1);assert.equal(inspectLatestRelease('0.2.0-beta.16',value).state,'unavailable');}
  for(const value of [null,[],false,{}, {assets:[null]}])assert.equal(inspectLatestRelease('0.2.1',value).state,'unavailable');
});
