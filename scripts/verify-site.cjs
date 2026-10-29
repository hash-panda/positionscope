const { validateCanonicalPage, validateSitemapRoutes } = require('./site-canonical.cjs');
const { validateReleaseEvidence } = require('./release-evidence.cjs');
validateReleaseEvidence(require('node:path').resolve(__dirname, '..'));
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'../website');const origin='https://positionscope.funagent.app';
const html=[];function walk(folder){for(const e of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.html'))html.push(p)}}walk(root);
const canonicalURLs = html.map(p => {const route=path.relative(root,p).split(path.sep).join('/').replace(/index\.html$/, '');return origin+'/'+route;});
for(const [index,p] of html.entries()){const text=fs.readFileSync(p,'utf8');assert.equal((text.match(/<h1[\s>]/g)||[]).length,1,p+' must have one h1');assert(/name="description"/.test(text));validateCanonicalPage(text, canonicalURLs[index]);for(const [,link] of text.matchAll(/(?:href|src)="(\/[^"#?]*)/g)){const file=path.join(root,link.endsWith('/')?link+'index.html':link);assert(fs.existsSync(file),p+' missing '+link)}for(const [,data] of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))JSON.parse(data);assert(!text.includes('noindex'),p);}
for(const p of ['robots.txt','sitemap.xml','llms.txt'])assert(fs.statSync(path.join(root,p)).size>20);
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');for(const [,url]of sitemap.matchAll(/<loc>(.*?)<\/loc>/g))assert(url.startsWith(origin+'/'));
validateSitemapRoutes(sitemap, canonicalURLs);
console.log(`Checked ${html.length} HTML pages, canonical/metadata/headings/internal links, sitemap, robots and llms index.`);

const release=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'brand-tokens.css'),'utf8'), fs.readFileSync(path.resolve(__dirname,'../assets/brand/tokens.css'),'utf8'));
for(const p of html) {
 const source=fs.readFileSync(p,'utf8');
 assert(source.includes('href="/brand-tokens.css"'), p+' must use shared brand tokens');
 assert(source.includes('src="/app-icon.png"'), p+' must use the app icon');
}
assert.equal(release.signed_and_notarized,true);
assert(fs.readFileSync(path.join(root,'download/index.html'),'utf8').includes(release.tag));
for(const architecture of ['arm64','x64']) for(const kind of ['dmg','zip']) {
 assert(release.downloads[architecture][kind].startsWith('https://github.com/hash-panda/positionscope/releases/download/'+release.tag+'/'));
 assert(fs.readFileSync(path.join(root,'download/index.html'),'utf8').includes(release.downloads[architecture][kind]));
}
console.log('Verified current signed-release download links against release manifest.');

for (const p of html) {
 const source = fs.readFileSync(p, 'utf8');
 for (const [, json] of source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  const data = JSON.parse(json);
  if (data['@type'] === 'SoftwareApplication') {
   assert.equal(data.softwareVersion, release.version, 'structured release version');
   assert(!data.description.includes('未签名'), 'verified release must not have unsigned metadata');
  }
 }
}
