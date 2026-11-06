const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {audit,validate,PATHS,ORIGIN,LIMIT,fetchPublic,parseCurlOutput}=require('../scripts/audit-live-site.cjs');
const root=path.resolve(__dirname,'../website');const expected=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));
const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');
const fixture=route=>({status:200,headers:{'content-type':route.endsWith('/')?'text/html':'text/plain'},
 body:fs.readFileSync(path.join(root,route.endsWith('/')?route+'index.html':route),'utf8')});
test('public audit checks current generated metadata with a fixed six-route allowlist and bounded workers',async()=>{
 let active=0,max=0;const seen=[];
 const result=await audit(expected,robots,async r=>{seen.push(r);active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;return fixture(r);});
 assert.equal(result.verified,true);assert.equal(result.results.length,6);assert(max<=3);assert.deepEqual([...seen].sort(),[...PATHS].sort());
 assert.equal(result.expected_release,expected.tag);await assert.rejects(fetchPublic('/not-allowed'));
});
test('HTTP 200 cannot hide stale releases, wrong download links, duplicate or script-only canonicals',()=>{
 const changed=(r,fn)=>validate(r,{...fixture(r),body:fn(fixture(r).body)},expected,robots);
 assert.equal(changed('/release.json',s=>s.replace(expected.version,'0.0.0-stale')).verified,false);
 assert.equal(changed('/download/',s=>s.replace(expected.downloads.arm64.zip,'https://example.invalid/stale.zip')).verified,false);
 for(const route of ['/','/download/','/guides/portfolio-risk/']) {
  assert.equal(changed(route,s=>s.replace('</head>',`<link rel="canonical" href="${ORIGIN+route}"></head>`)).verified,false);
  assert.equal(changed(route,s=>s.replace(/<link rel="canonical"[^>]+>/,'<script><link rel="canonical" href="'+ORIGIN+route+'"></script>')).verified,false);
 }
 assert.equal(changed('/',s=>s.replace(/"softwareVersion":\s*"[^"]+"/,'"softwareVersion":"0.0.0-stale"')).verified,false);
 assert.equal(changed('/',s=>s.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,'<!--$&-->')).verified,false);
});
test('robots, sitemap, headers and status failures remain explicit instead of claiming indexing',()=>{
 assert.equal(validate('/robots.txt',{...fixture('/robots.txt'),body:'User-agent: *\nDisallow: /'},expected,robots).verified,false);
 const map=fixture('/sitemap.xml');assert.equal(validate('/sitemap.xml',{...map,body:map.body.replace('</urlset>','<url><loc>'+ORIGIN+'/</loc></url></urlset>')},expected,robots).verified,false);
 assert.equal(validate('/',{...fixture('/'),headers:{'content-type':'text/html','x-robots-tag':'googlebot: noindex'}},expected,robots).verified,false);
 assert.equal(validate('/',{...fixture('/'),status:403},expected,robots).reason,'http-unverified');
 assert.equal(validate('/',{...fixture('/'),body:'x'.repeat(LIMIT+1)},expected,robots).reason,'body-invalid-or-too-large');
});
test('download targets must be four current anchor hrefs without stale or ambiguous alternatives',()=>{
 const page=fixture('/download/');
 const current=expected.downloads.arm64.dmg;
 const stale=current.replaceAll(expected.version,'0.0.0-stale');
 for(const body of [
  page.body.replace(`href="${current}"`,`href="${stale}" data-href="${current}"`),
  page.body.replace(`href="${current}"`,`href="${stale}" href="${current}"`),
  page.body.replace('</main>',`<a href="${stale}">Old installer</a></main>`),
  page.body.replace(`href="${current}"`,`data-href="${current}"`),
 ]) {
  assert.notEqual(body,page.body);
  const result=validate('/download/',{...page,body},expected,robots);
  assert.equal(result.checks.download_links,false);
  assert.equal(result.reason,'content-mismatch');
 }
});
test('partial transport failures do not retry or leak raw responses, cookies, proxy details or errors',async()=>{
 const marker='synthetic-private-transport-marker';const calls=[];
 const result=await audit(expected,robots,async r=>{calls.push(r);if(r==='/sitemap.xml')throw new Error(marker);if(r==='/robots.txt')return {...fixture(r),status:403,body:marker,headers:{'set-cookie':marker}};return fixture(r);});
 assert.equal(result.verified,false);assert.equal(calls.length,6);assert.equal(result.results.filter(r=>r.verified).length,4);
 assert.equal(result.results.find(r=>r.path==='/sitemap.xml').http_status,null);assert(!JSON.stringify(result).includes(marker));
});
test('curl framing preserves final headers and body, drops cookies and rejects missing or invalid status',()=>{
 const response=parseCurlOutput('HTTP/2 103\r\nLink: hint\r\n\r\nHTTP/2 200\r\nContent-Type: text/html\r\nX-Robots-Tag: index\r\nX-Robots-Tag: noindex\r\nSet-Cookie: synthetic-private-cookie\r\n\r\n<body>ok\nPOSITIONSCOPE_HTTP:123</body>\nPOSITIONSCOPE_HTTP:200');
 assert.equal(response.status,200);assert.equal(response.headers['x-robots-tag'],'index,noindex');assert.equal(response.headers['content-type'],'text/html');
 assert.equal(response.body,'<body>ok\nPOSITIONSCOPE_HTTP:123</body>');assert(!JSON.stringify(response).includes('synthetic-private-cookie'));
 for(const value of ['body','body\nPOSITIONSCOPE_HTTP:000','body\nPOSITIONSCOPE_HTTP:NaN','HTTP/2 200\nPOSITIONSCOPE_HTTP:200'])assert.throws(()=>parseCurlOutput(value));
});
