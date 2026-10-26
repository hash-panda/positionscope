const assert = require('node:assert/strict');
// This checks the project's generated, quoted-attribute HTML, not arbitrary HTML.
const clean = text => text.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
function attributes(tag) {
  const result = new Map();
  for (const match of tag.matchAll(/\s([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const name = match[1].toLowerCase();
    assert(!result.has(name), `Duplicate canonical attribute: ${name}`);
    result.set(name, match[2] ?? match[3]);
  }
  return result;
}
function canonicalLinks(text) {
  return [...text.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]).filter(tag => /\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["']/i.test(tag));
}
function validateCanonicalPage(html, expectedURL) {
  const source = clean(html), heads = [...source.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/gi)];
  assert.equal(heads.length, 1, 'Expected one head');
  const all = canonicalLinks(source), head = canonicalLinks(heads[0][1]);
  assert.equal(all.length, 1, 'Expected exactly one canonical');
  assert.equal(head.length, 1, 'Canonical must be in head');
  const attrs = attributes(head[0]);
  assert.equal(attrs.get('rel').toLowerCase(), 'canonical', 'Canonical relation must be unambiguous');
  assert.equal(attrs.get('href'), expectedURL, `Canonical must match page route: ${expectedURL}`);
  for (const name of ['hreflang','lang','media','type']) assert(!attrs.has(name), `Canonical cannot carry alternate attribute: ${name}`);
}
function validateSitemapRoutes(xml, expectedURLs) {
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URL');
  assert.deepEqual([...urls].sort(), [...expectedURLs].sort(), 'Sitemap must cover exactly the canonical page routes');
}
module.exports = { validateCanonicalPage, validateSitemapRoutes };
