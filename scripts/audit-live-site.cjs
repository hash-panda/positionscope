// Public, read-only production checks. Not an indexing or global availability test.
const {execFile}=require('node:child_process');
const {promisify,isDeepStrictEqual}=require('node:util');
const fs=require('node:fs');
const path=require('node:path');
const {validateCanonicalPage,validateSitemapRoutes,validateDownloadLinks}=require('./site-canonical.cjs');
const run=promisify(execFile);
const ORIGIN='https://positionscope.funagent.app';
const ROUTES=['/','/download/','/guides/read-only-api/','/guides/portfolio-risk/','/privacy/','/roadmap/','/en/'];
const PATHS=Object.freeze(['/','/download/','/guides/portfolio-risk/','/robots.txt','/sitemap.xml','/release.json']);
const LIMIT=524288;
const clean=s=>s.replace(/<!--[\s\S]*?-->/g,'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
const passes=fn=>{try{fn();return true;}catch{return false;}};
const requireTrue=value=>{if(!value)throw new Error('mismatch');};

function validate(route,response,expected,robots) {
  const checks={};
  if(response.status!==200)return {path:route,http_status:response.status,verified:false,reason:'http-unverified',checks};
  if(typeof response.body!=='string'||Buffer.byteLength(response.body)>LIMIT)
    return {path:route,http_status:200,verified:false,reason:'body-invalid-or-too-large',checks};
  checks.indexable_header=!/\b(noindex|none)\b/i.test(response.headers?.['x-robots-tag']||'');
  const body=response.body;
  if(route.endsWith('.json')) {
    checks.release_manifest=passes(()=>requireTrue(isDeepStrictEqual(JSON.parse(body),expected)));
  } else if(route==='/robots.txt') {
    checks.robots_policy=body.replace(/\r\n/g,'\n').trim()===robots.replace(/\r\n/g,'\n').trim();
  } else if(route==='/sitemap.xml') {
    checks.sitemap_routes=passes(()=>validateSitemapRoutes(body,ROUTES.map(r=>ORIGIN+r)));
  } else {
    checks.html_type=/^text\/html\b/i.test(response.headers?.['content-type']||'');
    checks.canonical=passes(()=>validateCanonicalPage(body,ORIGIN+route));
    checks.indexable_meta=!/<meta\b[^>]*\bcontent\s*=\s*["'][^"']*\b(noindex|none)\b[^"']*["'][^>]*>/i.test(clean(body));
    if(route==='/')checks.structured_version=passes(()=>{
      const apps=[...body.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)]
        .map(m=>JSON.parse(m[1])).filter(d=>d['@type']==='SoftwareApplication');
      requireTrue(apps.length===1&&apps[0].softwareVersion===expected.version);
    });
    if(route==='/download/')checks.download_links=passes(()=>validateDownloadLinks(body,expected.downloads));
  }
  const verified=Object.values(checks).every(Boolean);
  return {path:route,http_status:200,verified,reason:verified?'matched':'content-mismatch',checks};
}

async function fetchPublic(route) {
  if(!PATHS.includes(route))throw new Error('Route not allowed');
  // Keep existing proxy environment and curl's normal UA. No credentials, redirects or retries.
  // --disable prevents a local curlrc from adding headers, cookies or unrelated URLs.
  const {stdout}=await run('curl',['--disable','--silent','--show-error','--include','--suppress-connect-headers',
    '--proto','=https','--connect-timeout','5','--max-time','8','--max-filesize',String(LIMIT),
    '--write-out','\nPOSITIONSCOPE_HTTP:%{http_code}',ORIGIN+route],{timeout:10000,maxBuffer:1024*1024,encoding:'utf8'});
  return parseCurlOutput(stdout);
}

function parseCurlOutput(stdout) {
  const marker=stdout.lastIndexOf('\nPOSITIONSCOPE_HTTP:');
  if(marker<0)throw new Error('Response framing unavailable');
  const status=Number(stdout.slice(marker+'\nPOSITIONSCOPE_HTTP:'.length));
  if(!Number.isInteger(status)||status<100||status>599)throw new Error('HTTP status unavailable');
  let body=stdout.slice(0,marker),headers={};
  while(/^HTTP\/\S+ \d{3}/.test(body)) {
    const end=body.search(/\r?\n\r?\n/);if(end<0)throw new Error('Headers unavailable');
    const block=body.slice(0,end);headers={};
    for(const line of block.split(/\r?\n/).slice(1)) {
      const colon=line.indexOf(':');if(colon<0)continue;
      const key=line.slice(0,colon).toLowerCase();
      if(['x-robots-tag','content-type'].includes(key))headers[key]=(headers[key]?headers[key]+',':'')+line.slice(colon+1).trim();
    }
    body=body.slice(end+(body.slice(end).startsWith('\r\n')?4:2));
  }
  return {status,headers,body};
}

async function audit(expected,robots,reader=fetchPublic) {
  const startedAt=new Date().toISOString();
  const results=new Array(PATHS.length);let next=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(next<PATHS.length) {
      const index=next++,route=PATHS[index];
      try {results[index]=validate(route,await reader(route),expected,robots);}
      catch {results[index]={path:route,http_status:null,verified:false,reason:'transport-unverified',checks:{}};}
    }
  }));
  return {version:'public-site-audit-v1',started_at:startedAt,observed_at:new Date().toISOString(),origin:ORIGIN,expected_release:expected.tag,
    verified:results.every(r=>r.verified),results,
    limitations:['Only three HTML routes and public metadata were checked; no installation or binary signature check.',
      'This observer and time only; not proof of indexing, global availability, visits, activation or revenue.',
      'Transport failures are unverified, not evidence of origin failure. No raw body, headers or transport errors are reported.']};
}

if(require.main===module) {
  if(process.argv.length!==2){process.stderr.write('Usage: node scripts/audit-live-site.cjs\n');process.exitCode=2;}
  else {
    const root=path.resolve(__dirname,'../website');
    audit(JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8')),fs.readFileSync(path.join(root,'robots.txt'),'utf8'))
      .then(result=>{process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.verified?0:1;})
      .catch(()=>{process.stderr.write('Public site audit unavailable\n');process.exitCode=1;});
  }
}
module.exports={audit,validate,fetchPublic,parseCurlOutput,PATHS,ORIGIN,LIMIT};
