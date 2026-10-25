const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('shipping icon contains all Mac resolutions and the actual 1024 artwork', () => {
 const folder=path.join(__dirname,'../assets/brand');
 const source=fs.readFileSync(path.join(folder,'app-icon.png'));
 const icon=fs.readFileSync(path.join(folder,'app-icon.icns'));
 assert.equal(icon.toString('ascii',0,4),'icns');
 assert.equal(icon.readUInt32BE(4),icon.length);
 const sizes={icp4:16,icp5:32,icp6:64,ic07:128,ic08:256,ic09:512,ic10:1024,ic11:32,ic12:64,ic13:256,ic14:512};
 const found=new Set();
 let offset=8;
 while(offset<icon.length) {
  const name=icon.toString('ascii',offset,offset+4), length=icon.readUInt32BE(offset+4);
  assert(length>8&&offset+length<=icon.length);
  const png=icon.subarray(offset+8,offset+length);
  assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),sizes[name]);
  assert.equal(png.readUInt32BE(20),sizes[name]);
  if(name==='ic10')assert.deepEqual(png,source);
  found.add(name);offset+=length;
 }
 assert.deepEqual([...found].sort(),Object.keys(sizes).sort());
 for(const [name,size] of [['trayTemplate.png',18],['trayTemplate@2x.png',36]]) {
  const png=fs.readFileSync(path.join(folder,name));
  assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 }
 const config=require('../package.json').build;
 assert.equal(config.mac.icon,'assets/brand/app-icon.icns');
 assert(config.extraResources.some(resource=>resource.to==='brand'&&resource.filter.includes('trayTemplate@2x.png')));
});
