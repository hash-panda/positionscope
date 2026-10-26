const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateCanonicalPage,validateSitemapRoutes}=require('../scripts/site-canonical.cjs');
const url='https://positionscope.funagent.app/download/';
const page=tag=>`<!doctype html><html><head>${tag}</head><body><h1>Download</h1></body></html>`;
const link=href=>`<link rel="canonical" href="${href}">`;
test('canonical validates head placement, exact route and generated attribute variations',()=>{
 for(const tag of [link(url),`<LINK HREF='${url}' REL='canonical'>`])assert.doesNotThrow(()=>validateCanonicalPage(page(tag),url));
 for(const bad of ['https://example.com/download/','http://positionscope.funagent.app/download/','/download/','https://positionscope.funagent.app/',url+'?preview=1',url+'#part',url.slice(0,-1)])assert.throws(()=>validateCanonicalPage(page(link(bad)),url));
});
test('missing, duplicate, commented, script-only and body canonicals cannot masquerade as valid',()=>{
 for(const html of [page(''),page(link(url)+link(url)),page(`<!--${link(url)}-->`),page(`<script>const tag='${link(url)}';</script>`),page('')+link(url)])assert.throws(()=>validateCanonicalPage(html,url));
 for(const extra of ['media="all"','hreflang="en"','lang="en"','type="text/html"',`href="${url}"`])assert.throws(()=>validateCanonicalPage(page(`<link rel="canonical" href="${url}" ${extra}>`),url));
});
test('sitemap rejects missing, duplicate, extra and off-domain routes even when every URL looks plausible',()=>{
 const urls=['https://positionscope.funagent.app/',url],xml=values=>`<urlset>${values.map(v=>`<url><loc>${v}</loc></url>`).join('')}</urlset>`;
 assert.doesNotThrow(()=>validateSitemapRoutes(xml([...urls].reverse()),urls));
 for(const values of [[url],[...urls,url],[...urls,'https://positionscope.funagent.app/old/'],[urls[0],'https://example.com/download/']])assert.throws(()=>validateSitemapRoutes(xml(values),urls));
});
