const { app, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
app.whenReady().then(() => {
 const root = path.resolve(__dirname, '..');
 const brand = path.join(root, 'assets/brand');
 const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'positionscope-icon-'));
 try {
  assert.equal(process.platform, 'darwin');
  const iconset = path.join(temporary, 'AppIcon.iconset');
  execFileSync('/usr/bin/iconutil', ['-c', 'iconset', path.join(brand, 'app-icon.icns'), '-o', iconset]);
  // Avoid the @2x filename changing nativeImage's logical size for this pixel comparison.
  fs.copyFileSync(path.join(iconset, 'icon_512x512@2x.png'), path.join(temporary, 'largest.png'));
  const largest = nativeImage.createFromPath(path.join(temporary, 'largest.png'));
  const source = nativeImage.createFromPath(path.join(brand, 'app-icon.png'));
  assert.equal(largest.isEmpty(), false);
  assert.deepEqual(largest.getSize(), { width: 1024, height: 1024 });
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(largest.toBitmap()), hash(source.toBitmap()), 'ICNS must contain the actual brand artwork');
  const tray = nativeImage.createFromPath(path.join(brand, 'trayTemplate.png'));
  assert.deepEqual(tray.getSize(), { width: 18, height: 18 });
  assert(tray.getScaleFactors().includes(2), 'Retina representation is missing');
  tray.setTemplateImage(true);
  assert.equal(tray.isTemplateImage(), true);
  const bitmap = tray.toBitmap();
  let visible = 0, transparent = 0;
  for(let i=0;i<bitmap.length;i+=4) {
   assert.equal(bitmap[i] + bitmap[i+1] + bitmap[i+2], 0, 'template must be monochrome black');
   if(bitmap[i+3]) visible++; else transparent++;
  }
  assert(visible > 10 && transparent > 10, 'template must contain a mark and transparent space');
  const evidence = { platform: process.platform, electron: process.versions.electron, icns_decoded: true, app_artwork_matches: true, template_image: true, retina_representation: true, native_ui_tested: false };
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results/branding-native.json'), JSON.stringify(evidence, null, 2)+'\n');
  console.log(JSON.stringify(evidence));
 } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
 app.exit(0);
}).catch(error => { console.error(error.message); app.exit(1); });
