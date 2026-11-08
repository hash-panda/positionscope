const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src/main');
const sourceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.isFile() && entry.name.endsWith('.ts')) sourceFiles.push(full);
  }
}
collect(root);

const forbidden = [
  { label: 'secret/config value', pattern: /\b(?:apiKey|apiSecret|passphrase|proxyUrl|walletAddress|aiSettings)\b/i },
  { label: 'account or prompt-derived count', pattern: /\b(?:positions|balances|allPositions|allBalances|allAccountInfo|configuredExchanges|messages|content)\.length\b/ },
  { label: 'raw response body', pattern: /\bresponse\.data\b/ },
  { label: 'request destination', pattern: /\b(?:baseURL|url)\b/i },
];

function isLogCall(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const owner = node.expression.expression.getText();
  const method = node.expression.name.text;
  return ['console', 'logger'].includes(owner) && ['log', 'error', 'warn', 'info', 'debug'].includes(method);
}

function auditSource(file, source) {
  const failures = [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node) {
    if (isLogCall(node)) {
      const dynamicArguments = node.arguments.filter(argument =>
        !ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument));
      const text = dynamicArguments.map(argument => argument.getText(tree)).join('\n');
      for (const rule of forbidden) {
        if (text && rule.pattern.test(text)) failures.push(`${path.relative(root, file)}: ${rule.label}: ${node.getText(tree)}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return failures;
}

test('audit rejects private metadata in dynamic log arguments while allowing fixed status text', () => {
  const unsafe = [
    'console.log("settings", { apiKey, aiSettings })',
    'logger.log(`positions: ${positions.length}`)',
    'console.error("body", response.data)',
    'logger.info("request", client.defaults.baseURL)',
  ].join('\n');
  assert.equal(auditSource('synthetic.ts', unsafe).length, 4);
  assert.deepEqual(auditSource('synthetic.ts', 'console.log("Position snapshot received")'), []);
});

test('main-process logs contain no secrets, request destinations, or account/prompt-derived metadata', () => {
  const failures = sourceFiles.flatMap(file => auditSource(file, fs.readFileSync(file, 'utf8')));
  assert.deepEqual(failures, []);
});
