// Run with Electron on an isolated CI profile. Checks native decoding, not macOS visual appearance.
const {app,nativeImage}=require('electron');
const assert=require('node:assert/strict');
const {menuSignalPng}=require('../dist/main/utils/menu-image');
app.whenReady().then(()=>{
  const options={colorScheme:'green-up',hideAmounts:false};
  const one=menuSignalPng(12,{...options,scaleFactor:1});
  const two=menuSignalPng(12,{...options,scaleFactor:2});
  const image=nativeImage.createFromBuffer(one.buffer,{scaleFactor:1});
  image.addRepresentation({buffer:two.buffer,scaleFactor:2});image.setTemplateImage(false);
  assert.equal(image.isEmpty(),false);assert.deepEqual(image.getSize(),{width:18,height:18});
  assert.deepEqual(image.getScaleFactors().sort(),[1,2]);assert.equal(image.isTemplateImage(),false);
  assert.deepEqual(image.toPNG({scaleFactor:1}).subarray(0,8),one.buffer.subarray(0,8));
  console.log(JSON.stringify({native_menu_png_decoded:true,retina_representation:true,template_image:false,synthetic_data_only:true,native_menu_appearance_tested:false}));
  app.quit();
}).catch(()=>{console.error('Native menu image smoke test failed');app.exit(1);});
