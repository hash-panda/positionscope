const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const path = require('node:path');
const { setImmediate: tick } = require('node:timers/promises');

// Execute the compiled main process. Only platform/network/persistence boundaries
// are replaced; no account, filesystem vault, model or public HTTP is contacted.
async function fixture(run) {
  const handlers = new Map(), timers = new Map(), windows = [], trays = [];
  const calls = { privateReads: 0, model: 0, public: [], observed: [], invalidations: 0, cleared: 0 };
  const state = { credentials: false, hide: false, ledger: { alerts: [], shadows: [] } };
  const events = [];
  const image = () => ({ isEmpty: () => false, setTemplateImage() {}, addRepresentation() {} });
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.visible = false; this.destroyed = false;
      this.webContents = new EventEmitter(); this.webContents.mainFrame = {};
      this.messages = [];
      Object.assign(this.webContents, {
        send: (...args) => this.messages.push(args),
        setWindowOpenHandler: handler => { this.openHandler = handler; },
        openDevTools() {}, closeDevTools() {}, isDevToolsOpened: () => false,
      });
      windows.push(this);
    }
    loadFile(file, options) { this.loaded = { file, options }; return Promise.resolve(); }
    loadURL(url) { this.loaded = { url }; return Promise.resolve(); }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    focus() { this.focused = true; }
    setOpacity(value) { this.opacity = value; }
    setPosition() {}
    minimize() { this.minimized = true; }
    isVisible() { return this.visible; }
    isDestroyed() { return this.destroyed; }
    static fromWebContents(sender) { return windows.find(w => w.webContents === sender); }
  }
  class FakeTray extends EventEmitter {
    constructor() { super(); this.titles = []; trays.push(this); }
    setTitle(title) { this.title = title; this.titles.push(title); events.push(['title', title]); }
    setToolTip() {}
    setImage(value) { this.image = value; }
    getBounds() { return { x: 0, y: 0, width: 20, height: 20 }; }
    popUpContextMenu() {}
  }
  const app = new EventEmitter();
  const paths = { appData: '/synthetic/app-data' };
  Object.assign(app, { isPackaged: true, setName() {}, setPath: (key, value) => { paths[key] = value; },
    getPath: key => paths[key], getAppPath: () => '/synthetic/app', getVersion: () => '0.2.1',
    whenReady: () => Promise.resolve(), setLoginItemSettings() {}, quit() {}, relaunch() {}, exit() {}, dock: { hide() {} } });
  const settings = {
    getProxyUrl: () => '', getAllExchangesCredentials: () => ({}),
    getDisplaySettings: () => ({ maxDisplayCount: 2, refreshInterval: 5, colorScheme: 'green-up', watchlistSymbols: ['BTCUSDT', 'ETHUSDT'] }),
    getAISettings: () => ({ enabled: false, useCustomKeys: false, credentials: {} }),
    getWindowOpacity: () => 1, getHideAmounts: () => state.hide, getPositionOrder: () => [],
    async setHideAmounts(value) { state.hide = value; },
    async clearSettings() { state.hide = false; calls.cleared++; },
  };
  const exchange = {
    hasAnyCredentials: () => state.credentials, hasAnyErrors: () => false, hasBlockingErrors: () => false,
    setCredentials() {}, removeAllCredentials() { state.credentials = false; },
    async getAllFuturesPositions() { calls.privateReads++; events.push(['private-read']); return []; },
  };
  const ai = { setConfig() {}, clearCache() {}, isAvailable: () => true,
    getResearchProvider() { calls.model++; throw new Error('model must never run in these tests'); },
    async analyzePortfolioHealth() { calls.model++; }, async chat() { calls.model++; } };
  const legacyMarket = { setProxy() {}, snapshot: async () => { throw new Error('unexpected public market request'); } };
  const market = {
    setProxy() {}, async snapshot() { calls.public.push(['snapshot']); return { snapshotId: 'synthetic-public' }; },
    async getEvidence(symbol) { calls.public.push(['evidence', symbol]); return { symbol }; },
    async getWatchlistMarket(symbols) { calls.public.push(['watch', symbols]); return []; },
    async getPublicSamples(symbols) { calls.public.push(['samples', symbols]); return [{ symbol: 'BTCUSDT', value: 100, metric: 'price' }]; },
    async isSupportedSymbol() { return true; },
  };
  const ledger = {
    snapshot: () => structuredClone(state.ledger),
    async observePublicSamples(samples) { calls.observed.push(samples); return { triggeredAlerts: ['synthetic-alert'], completedShadows: [] }; },
    async clearAll() { state.ledger = { alerts: [], shadows: [] }; },
  };
  class ResearchAI { async analyze() { calls.model++; throw new Error('not scheduled'); } }
  class Controller { invalidate() { calls.invalidations++; } async analyze() { calls.model++; throw new Error('not scheduled'); } }
  const replacements = {
    electron: { app, BrowserWindow: FakeWindow, Tray: FakeTray, Menu: { buildFromTemplate: items => items },
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      autoUpdater: {}, session: { fromPartition: () => ({ fetch: async () => { throw Error('unexpected update network'); } }) },
      nativeImage: { createFromPath: image, createFromBuffer: image }, shell: { openExternal: async () => {} } },
    './settings': { SettingsManager: { open: async () => settings } },
    './settings-crypto': { macSettingsCipher: {} },
    './services/exchangeManager': { ExchangeManager: class { constructor() { return exchange; } } },
    './services/ai': { aiService: ai },
    './services/public-market': { publicMarketService: legacyMarket },
    './services/research/market-scanner': { BinanceResearchService: class { constructor() { return market; } } },
    './services/research/ai-research': { BoundedResearchAIService: ResearchAI },
    './services/research/research-ledger': { ResearchLedger: { open: async () => ledger } },
    './services/research/research-controller': { ResearchController: Controller },
    './services/update-install': { UpdateInstaller: class { snapshot(){return {state:'current'};} check(){return this.snapshot();} download(){return {state:'downloading'};} restart(){return false;} dispose(){} } },
  };
  const main = require.resolve('../dist/main/main.js');
  const originalLoad = Module._load, originalSetInterval = global.setInterval, originalClearInterval = global.clearInterval;
  const resourceDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
  const listeners = new Map(['uncaughtException', 'unhandledRejection'].map(name => [name, process.listeners(name)]));
  let timerId = 0;
  global.setInterval = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  global.clearInterval = id => timers.delete(id);
  Object.defineProperty(process, 'resourcesPath', { value: '/synthetic/resources', configurable: true });
  Module._load = function(request, parent, isMain) {
    if (parent?.filename === main && Object.hasOwn(replacements, request)) return replacements[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  const sender = target => ({ sender: target.webContents, senderFrame: target.webContents.mainFrame });
  const invoke = (channel, event, ...args) => {
    assert(handlers.has(channel), `missing IPC ${channel}`);
    return handlers.get(channel)(event, ...args);
  };
  try {
    delete require.cache[main]; require(main); Module._load = originalLoad;
    await tick(); assert.equal(windows.length, 1, 'main startup created the popup');
    await run({ invoke, sender, windows, trays, settings, exchange, market, legacyMarket, ledger, state, calls, timers, events, app });
  } finally {
    app.emit('before-quit');
    Module._load = originalLoad; global.setInterval = originalSetInterval; global.clearInterval = originalClearInterval;
    if (resourceDescriptor) Object.defineProperty(process, 'resourcesPath', resourceDescriptor); else delete process.resourcesPath;
    for (const [name, before] of listeners) for (const listener of process.listeners(name)) if (!before.includes(listener)) process.removeListener(name, listener);
    delete require.cache[main];
  }
}

test('main opens one isolated resizable workspace, routes pages and retains the compact popup', () => fixture(async h => {
  const popup = h.windows[0]; assert.equal(popup.options.width, 480); assert.equal(popup.options.height, 600); assert.equal(popup.options.resizable, false);
  assert.deepEqual(await h.invoke('open-workspace', h.sender(popup), 'review'), { success: true });
  const workspace = h.windows[1];
  assert.equal(workspace.options.width, 1180); assert.equal(workspace.options.height, 760);
  assert.equal(workspace.options.minWidth, 960); assert.equal(workspace.options.minHeight, 640); assert.notEqual(workspace.options.resizable, false);
  assert.deepEqual(workspace.loaded.options.query, { mode: 'workspace', page: 'review' }); assert.equal(popup.visible, false);
  workspace.emit('ready-to-show'); assert(workspace.visible && workspace.focused);
  assert.equal(await h.invoke('get-window-mode', h.sender(popup)), 'popup'); assert.equal(await h.invoke('get-window-mode', h.sender(workspace)), 'workspace');
  await h.invoke('open-workspace', h.sender(popup), 'settings'); assert.equal(h.windows.length, 2);
  assert.deepEqual(workspace.messages.at(-1), ['workspace-page', 'settings']);
  for (const invalid of ['https://example.invalid/', '../settings', 'unknown', {}, 42]) assert.equal((await h.invoke('open-workspace', h.sender(popup), invalid)).success, false);
  assert.equal(h.windows.length, 2);
  for (const target of [popup, workspace]) {
    assert.equal(target.options.webPreferences.nodeIntegration, false); assert.equal(target.options.webPreferences.contextIsolation, true);
    assert.deepEqual(target.openHandler({ url: 'https://example.invalid/' }), { action: 'deny' });
    let prevented = false; target.webContents.emit('will-navigate', { preventDefault() { prevented = true; } }); assert(prevented);
  }
}));

test('research IPC rejects foreign senders and child frames before any service work', () => fixture(async h => {
  const popup = h.windows[0]; await h.invoke('open-workspace', h.sender(popup), 'research'); const workspace = h.windows[1];
  const channels = ['get-research-snapshot', 'get-watchlist-market', 'get-research-evidence', 'get-research-ledger', 'analyze-research', 'set-research-watch', 'create-research-alert', 'remove-research-alert', 'rearm-research-alert', 'register-research-shadow'];
  for (const event of [{ sender: {}, senderFrame: {} }, { sender: popup.webContents, senderFrame: {} }, { sender: workspace.webContents, senderFrame: {} }]) {
    for (const channel of channels) assert.equal((await h.invoke(channel, event, 'BTCUSDT', true)).success, false, channel);
  }
  assert.equal(h.calls.public.length, 0); assert.equal(h.calls.privateReads, 0); assert.equal(h.calls.model, 0);
  for (const target of [popup, workspace]) assert.equal((await h.invoke('get-research-snapshot', h.sender(target))).success, true);
  assert.equal(h.calls.public.length, 2);
  workspace.destroyed = true; assert.equal((await h.invoke('get-research-snapshot', h.sender(workspace))).success, false);
}));

test('hiding amounts masks the native menu before persistence or a pending account response completes', () => fixture(async h => {
  h.state.credentials = true;
  let finishRead, finishSave;
  const position = { exchange: 'binance', symbol: 'BTCUSDT', positionAmt: '1', entryPrice: '100', markPrice: '321', unRealizedProfit: '221' };
  h.exchange.getAllFuturesPositions = () => { h.calls.privateReads++; return new Promise(resolve => { finishRead = resolve; }); };
  h.settings.setHideAmounts = value => new Promise(resolve => { finishSave = () => { h.state.hide = value; resolve(); }; });
  const accountRead = h.invoke('get-futures-positions', h.sender(h.windows[0]));
  const save = h.invoke('save-hide-amounts', h.sender(h.windows[0]), true);
  assert.equal(h.trays[0].title, '••••'); assert.equal(h.state.hide, false, 'the persistent write is still pending');
  assert.equal(h.calls.privateReads, 1, 'privacy did not wait for or initiate another account read');
  finishRead([position]); await accountRead;
  assert.match(h.trays[0].title, /••••/); assert(!h.trays[0].title.includes('321')); assert(!h.trays[0].title.includes('221'));
  h.exchange.getAllFuturesPositions = async () => [position]; finishSave(); assert.deepEqual(await save, { success: true }); await tick();
  assert.match(h.trays[0].title, /••••/); assert(h.windows[0].messages.some(([channel]) => channel === 'preferences-changed'));
}));

test('deleting data clears services and broadcasts data-cleared to both live windows', () => fixture(async h => {
  await h.invoke('open-workspace', h.sender(h.windows[0]), 'positions'); h.state.credentials = true;
  h.state.ledger.alerts = [{ status: 'armed', symbol: 'BTCUSDT' }];
  assert.deepEqual(await h.invoke('delete-all-data', h.sender(h.windows[1])), { success: true });
  assert.equal(h.state.credentials, false); assert.equal(h.calls.cleared, 1); assert.equal(h.calls.invalidations, 1);
  assert.deepEqual(h.state.ledger, { alerts: [], shadows: [] }); assert.equal(h.trays[0].title, '--');
  for (const target of h.windows) {
    assert.equal(target.messages.filter(([channel]) => channel === 'data-cleared').length, 1);
    assert(target.messages.some(([channel]) => channel === 'preferences-changed'));
    assert(target.messages.some(([channel]) => channel === 'research-ledger-changed'));
  }
}));

test('the research scheduler observes only active public symbols with no model or account calls and no overlapping polls', () => fixture(async h => {
  h.state.ledger = { alerts: [{ symbol: 'BTCUSDT', status: 'armed' }, { symbol: 'IGNOREDUSDT', status: 'triggered' }],
    shadows: [{ symbol: 'BTCUSDT', status: 'awaiting-entry' }, { symbol: 'ETHUSDT', status: 'observing' }, { symbol: 'CLOSEDUSDT', status: 'completed' }] };
  let finish; h.market.getPublicSamples = symbols => { h.calls.public.push(['samples', symbols]); return new Promise(resolve => { finish = resolve; }); };
  const timer = [...h.timers.values()].find(t => t.delay === 60000); assert(timer);
  timer.callback(); timer.callback(); assert.deepEqual(h.calls.public, [['samples', ['BTCUSDT', 'ETHUSDT']]]);
  finish([{ symbol: 'BTCUSDT', metric: 'price', value: 100 }]); await tick();
  assert.equal(h.calls.observed.length, 1); assert.equal(h.calls.model, 0); assert.equal(h.calls.privateReads, 0);
  assert(h.windows[0].messages.some(([channel]) => channel === 'research-ledger-changed'));
  h.app.emit('before-quit'); assert.equal(h.timers.size, 0);
}));

test('deletion discards a late public polling result so cleared alerts cannot be restored or fired', () => fixture(async h => {
  h.state.ledger.alerts = [{ symbol: 'BTCUSDT', status: 'armed' }];
  let finish; h.market.getPublicSamples = () => new Promise(resolve => { finish = resolve; });
  [...h.timers.values()].find(t => t.delay === 60000).callback();
  await h.invoke('delete-all-data', h.sender(h.windows[0]));
  finish([{ symbol: 'BTCUSDT', metric: 'price', value: 100 }]); await tick();
  assert.equal(h.calls.observed.length, 0); assert.deepEqual(h.state.ledger, { alerts: [], shadows: [] });
  assert.equal(h.calls.model, 0); assert.equal(h.calls.privateReads, 0);
}));

test('deletion invalidates pending metadata checks before a watch or alert can be written back', async () => {
  for (const channel of ['set-research-watch', 'create-research-alert']) await fixture(async h => {
    let finish; h.market.isSupportedSymbol = () => new Promise(resolve => { finish = resolve; });
    let writes = 0;
    h.ledger.setWatched = async () => { writes++; h.state.ledger.watchedSymbols = ['BTCUSDT']; return ['BTCUSDT']; };
    h.ledger.createAlert = async () => { writes++; h.state.ledger.alerts.push({ symbol:'BTCUSDT',status:'armed' }); return {}; };
    const args = channel === 'set-research-watch' ? ['BTCUSDT',true] : [{symbol:'BTCUSDT',metric:'price',threshold:100}];
    const pending = h.invoke(channel,h.sender(h.windows[0]),...args);
    await h.invoke('delete-all-data',h.sender(h.windows[0]));
    finish(true);const result = await pending;
    assert.equal(result.success,false);assert.equal(writes,0);assert.deepEqual(h.state.ledger,{alerts:[],shadows:[]});
  });
});

test('deletion or model reconfiguration during public preflight cannot send the old portfolio to a model',async()=>{
  for(const action of ['delete','config'])await fixture(async h=>{
    const configured={enabled:true,useCustomKeys:true,defaultProvider:'deepseek',credentials:{deepseek:{apiKey:'synthetic-key',model:'explicit-synthetic-model'}}};
    h.settings.getAISettings=()=>configured;h.settings.setAISettings=async()=>{};
    let finish;h.legacyMarket.snapshot=()=>new Promise(resolve=>{finish=resolve;});
    const positions=[{exchange:'binance',symbol:'BTCUSDT',positionAmt:'1',entryPrice:'90',markPrice:'100',unRealizedProfit:'10',marginType:'cross',isolatedMargin:'0',leverage:'5'}];
    const pending=h.invoke('ai-analyze-health',h.sender(h.windows[0]),positions,[{exchange:'binance',totalMarginBalance:100}],'deepseek');
    if(action==='delete')await h.invoke('delete-all-data',h.sender(h.windows[0]));
    // A later configured model is available: the old request still has no authority to send its old snapshot.
    await h.invoke('save-ai-settings',h.sender(h.windows[0]),configured);
    finish({});const result=await pending;
    assert.equal(result.success,false);assert.equal(h.calls.model,0);assert.equal(h.calls.privateReads,0);
  });
});

test('update IPC accepts only owned top-level windows; no renderer supplied download URL',async()=>fixture(async h=>{
 const owner=h.sender(h.windows[0]);
 for(const channel of ['get-update-state','check-for-updates','download-update','install-update'])for(const event of [{sender:{},senderFrame:{}},{sender:owner.sender,senderFrame:{}}])assert.throws(()=>h.invoke(channel,event),/Invalid update request/);
 assert.equal((await h.invoke('get-update-state',owner)).state,'current');
 assert.equal((await h.invoke('check-for-updates',owner)).state,'current');
 assert.equal((await h.invoke('download-update',owner,'https://untrusted.example')).state,'downloading');
 assert.equal(await h.invoke('install-update',owner),false);
}));
