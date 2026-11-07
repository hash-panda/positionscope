const {test} = require('node:test');
const assert = require('node:assert/strict');
const {inflateSync} = require('node:zlib');
const {menuSignalPng} = require('../dist/main/utils/menu-image');
function decode(buffer){
  assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const chunks=[];let at=8;while(at<buffer.length){const n=buffer.readUInt32BE(at),type=buffer.toString('ascii',at+4,at+8);chunks.push({type,data:buffer.subarray(at+8,at+8+n)});at+=n+12;}
  assert.deepEqual(chunks.map(c=>c.type),['IHDR','IDAT','IEND']);
  const header=chunks[0].data,width=header.readUInt32BE(0),height=header.readUInt32BE(4);assert.equal(header[9],6);
  const pixels=inflateSync(chunks[1].data);assert.equal(pixels.length,height*(width*4+1));
  const colors=new Set();for(let y=0;y<height;y++){assert.equal(pixels[y*(width*4+1)],0);for(let x=0;x<width;x++){const at=y*(width*4+1)+1+x*4;if(pixels[at+3])colors.add([...pixels.subarray(at,at+4)].join(','));}}
  return{width,height,pixels,colors:[...colors]};
}
test('menu arrows encode lossless 18pt RGBA images at normal and Retina density',()=>{
  for(const scaleFactor of [1,2]){
    const icon=menuSignalPng(100,{colorScheme:'green-up',hideAmounts:false,scaleFactor});
    const png=decode(icon.buffer);assert.equal(png.width,18*scaleFactor);assert.equal(png.height,18*scaleFactor);
    assert.deepEqual(png.colors,['26,145,106,255']);
    assert.deepEqual(decode(menuSignalPng(-10,{colorScheme:'green-up',hideAmounts:false,scaleFactor}).buffer).colors,['213,64,76,255']);
    assert.deepEqual(decode(menuSignalPng(10,{colorScheme:'red-up',hideAmounts:false,scaleFactor}).buffer).colors,['213,64,76,255']);
  }
});
test('hidden amounts never leak PnL sign or value through color or arrow shape',()=>{
  for(const scaleFactor of [1,2]){
    const expected=menuSignalPng(null,{colorScheme:'green-up',hideAmounts:true,scaleFactor}).buffer;
    for(const colorScheme of ['green-up','red-up'])for(const pnl of [null,NaN,Infinity,-10000,0,10000]){
      assert.deepEqual(menuSignalPng(pnl,{colorScheme,hideAmounts:true,scaleFactor}).buffer,expected);
      assert.deepEqual(menuSignalPng(pnl,{colorScheme,hideAmounts:false,stale:true,scaleFactor}).buffer,expected);
    }
    assert.deepEqual(decode(expected).colors,['133,141,153,255']);
  }
});
test('up and down have distinct shapes independently of configured color',()=>{
  const up=decode(menuSignalPng(1,{colorScheme:'green-up',hideAmounts:false,scaleFactor:1}).buffer);
  const down=decode(menuSignalPng(-1,{colorScheme:'red-up',hideAmounts:false,scaleFactor:1}).buffer);
  assert.deepEqual(up.colors,down.colors);assert.notDeepEqual(up.pixels,down.pixels);
});
