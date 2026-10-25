const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repository = path.resolve(__dirname, '..');
const screenshots = path.join(repository, 'test-results', 'ui');
fs.mkdirSync(screenshots, { recursive: true });

async function fixture(page, options = {}) {
  await page.addInitScript((options) => {
    const position = {
      exchange: 'binance',
      symbol: 'FOLKSUSDT',
      positionAmt: '380.1985',
      entryPrice: '1.2825',
      markPrice: '2.4180',
      unRealizedProfit: '431.73',
      marginType: 'cross',
      isolatedMargin: '0',
      leverage: '10',
    };
    if (options.riskDetails) Object.assign(position, {symbol:'BTCUSDT', positionAmt:'1', entryPrice:'90', markPrice:'100', unRealizedProfit:'10', liquidationPrice:'40', initialMargin:'20', maintenanceMargin:'1', marginCurrency:'USDT', baseAsset:'BTC', fetchedAt:Date.now()});
    const positions = options.empty
      ? []
      : options.multiple
        ? [
            position,
            {
              ...position,
              exchange: 'okx',
              symbol: 'BTCUSDT',
              positionAmt: '-0.02',
              unRealizedProfit: '-22.1',
              entryPrice: '68000',
              markPrice: '69105',
              leverage: '5',
            },
            {
              ...position,
              exchange: 'binance',
              symbol: 'BTCUSDT',
              positionAmt: '0.03',
              unRealizedProfit: '33.15',
              entryPrice: '68000',
              markPrice: '69105',
              leverage: '3',
            },
          ]
        : [position];
    let configured = !options.unconfigured && !options.storageBlocked;
    if (options.hyperliquid) positions.forEach(p => { p.exchange = 'hyperliquid'; });
    let stored = { binance: { apiKey: 'demo-key-not-real', apiSecret: 'demo-secret-not-real' } };
    if (options.hyperliquid) stored = { hyperliquid: { apiKey: '0x' + '1'.repeat(40), apiSecret: '' } };
    let errors = options.partial
      ? [{ exchange: 'okx', errorCode: 'ETIMEDOUT', suggestion: '请求超时，请检查网络或代理。' }]
      : [];
    let ai = {
      enabled: true,
      defaultProvider: 'deepseek',
      useCustomKeys: true,
      credentials: {
        deepseek: { provider: 'deepseek', apiKey: options.aiMissing ? '' : 'demo-ai-key-not-real' },
      },
    };
    const calls = [];
    const account = {
      exchange: options.hyperliquid ? 'hyperliquid' : 'binance',
      totalAssets: options.large ? 1234567890123.45 : 445.47,
      spotTotalUSDT: 0.06,
      totalWalletBalance: 13.67,
      totalUnrealizedProfit: 431.73,
      totalMarginBalance: 445.4,
      availableBalance: 0,
      maxWithdrawAmount: 0,
    };
    const market = {version:'market-context-v1',source:'Binance USD-M public REST',status:'partial',fetchedAt:Date.now(),breadth:{eligibleContracts:2,pricedContracts:2,rising:1,falling:1,flat:0,medianChange24h:0,quoteVolume24h:2000},active:[{symbol:'BTCUSDT',baseAsset:'BTC',lastPrice:100,change24h:.01,quoteVolume24h:1500,onboardAt:Date.now()-86400000,exchangeTimestamp:Date.now(),fetchedAt:Date.now()}],recentListings:[{symbol:'ASSETUSDT',baseAsset:'ASSET',lastPrice:1,change24h:-.01,quoteVolume24h:500,onboardAt:Date.now()-86400000,exchangeTimestamp:Date.now(),fetchedAt:Date.now()}],assets:[{symbol:'BTCUSDT',baseAsset:'BTC',fetchedAt:Date.now(),mark:{price:100,lastFundingRate:.001,nextFundingAt:Date.now()+3600000,exchangeTimestamp:Date.now()},funding:{intervalHours:4,intervalBasis:'observed',lastSettledRate:.001,lastSettledAt:Date.now()-3600000},openInterest:null,history:{interval:'1h',samples:30,start:Date.now()-30*3600000,end:Date.now()-3600000,priceChange:.05,maxDrawdown:.1,annualizedPriceVolatility:.5},gaps:['未平仓量不可用或过期']}],unavailableSymbols:[],notes:['合成市场fixture，不是实时行情。'],sources:['https://fapi.binance.com/fapi/v1/klines']};
    const state = {
      positions,
      errors,
      failData: false,
      failAI: false,
      failMarket: false,
      aiRequests: [],
      fetchCount: 0,
      failSave: false,
      blockDisplaySave: false,
    };
    const result = (method, ...args) => {
      calls.push([method, ...args]);
      return state.failSave ? { success: false, error: '模拟保存失败' } : { success: true };
    };
    window.__qa = state;
    window.__calls = calls;
    window.electronAPI = {
      getProxySettings: async () => '',
      getStorageStatus: async () => options.storageBlocked ? {state: 'blocked', message: '加密配置无法读取，原文件已保留。请解锁系统钥匙串并重启。'} : {state: 'encrypted', message: '配置已通过系统加密存储。'},
      restartForStorage: async () => result('restartForStorage'),
      hasCredentials: async () => configured,
      getAllExchangesCredentials: async () => (options.unconfigured || options.storageBlocked ? {} : stored),
      getFuturesPositions: async () => {
        state.fetchCount++;
        if (state.failData) throw new Error('offline');
        return configured ? positions : [];
      },
      getFuturesAccountInfo: async () => {
        if (state.failData) throw new Error('offline');
        return configured
          ? options.partial
            ? [account, { ...account, exchange: 'okx', totalAssets: 100 }]
            : [account]
          : [];
      },
      getDisplaySettings: async () => ({ maxDisplayCount: 2, refreshInterval: 60 }),
      getTheme: async () => (options.light ? 'light' : 'dark'),
      getHideAmounts: async () => false,
      getDebugMode: async () => false,
      getWindowOpacity: async () => 1,
      getAutoLaunch: async () => false,
      getAppVersion: async () => options.appVersion,
      getPositionOrder: async () => [],
      getAISettings: async () => ai,
      saveAISettings: async (value) => {
        const r = result('saveAISettings', value);
        if (r.success) ai = value;
        return r;
      },
      saveExchangeCredentials: async (exchange, credentials) => {
        const r = result('saveExchangeCredentials', exchange, credentials);
        if (r.success) {
          stored[exchange] = credentials;
          configured = true;
        }
        return r;
      },
      removeExchangeCredentials: async (exchange) => {
        const r = result('removeExchangeCredentials', exchange);
        if (r.success) {
          delete stored[exchange];
          configured = Object.values(stored).some((value) => value.apiKey);
        }
        return r;
      },
      savePositionOrder: async (value) => result('savePositionOrder', value),
      saveDisplaySettings: async (value) => {
        if (state.blockDisplaySave) await new Promise(resolve => { state.releaseDisplaySave = resolve; });
        return result('saveDisplaySettings', value);
      },
      saveTheme: async (value) => {
        return result('saveTheme', value);
      },
      saveHideAmounts: async (value) => {
        return result('saveHideAmounts', value);
      },
      saveDebugMode: async (value) => {
        return result('saveDebugMode', value);
      },
      saveWindowOpacity: async (value) => {
        return result('saveWindowOpacity', value);
      },
      saveAutoLaunch: async (value) => {
        return result('saveAutoLaunch', value);
      },
      saveProxySettings: async (value) => result('saveProxySettings', value),
      getPublicMarket: async (symbols) => {calls.push(['getPublicMarket',symbols]);return state.failMarket ? {success:false,error:'模拟市场失败'} : {success:true,data:market};},
      aiAnalyzeHealth: async (...args) => {
        state.aiRequests.push(args);
        if (state.failAI) return { success: false, error: '模拟 AI 请求失败' };
        return {
          success: true,
          data: {
            facts:{version:'risk-facts-v2',positionCount:1,grossNotional:919.32,netNotional:919.32,marginEquity:445.4,grossToEquity:2.06,largestAsset:'FOLKS',largestAssetShare:1,longNotional:919.32,shortNotional:0,adverseMove5Percent:45.966,adverseMoveToEquity:.1032,positions:options.riskDetails?[{exchange:'binance',symbol:'BTCUSDT',side:'long',liquidationPrice:40,liquidationDistance:.6,initialMargin:20,maintenanceMargin:1,currency:'USDT'}]:[],accounts:options.riskDetails?[{exchange:'binance',mode:'single-asset',equity:100,riskEquity:100,scope:'futures',currency:'USDT',maintenanceMargin:1,notes:['合成验收数据']}]:[],scenarios:options.riskDetails?[1,.75,.5].flatMap(retainedShare=>[-.2,-.1,-.05,.05,.1,.2].map(priceMove=>({retainedShare,priceMove,pricePnl:100*retainedShare*priceMove}))):[],limitations:['仅为快照，缺少历史数据与强平价。']},
            market:options.riskDetails?market:undefined,fundingScenarios:options.riskDetails?[{exchange:'binance',symbol:'BTCUSDT',retainedShare:1,referenceRate:.001,nextFundingAt:Date.now()+3600000,estimatedCashflow:-.1}]:[],
            snapshotId:'demo-synthetic',model:'demo-model',provider:'deepseek',analyzedAt:'2026-10-24T10:00:00Z',
            summary: '当前持仓集中，需关注杠杆与风险敞口。',
            warnings: ['持仓较集中', '10× 杠杆会放大波动影响'],
            suggestions: ['结合自身风险承受能力，复核仓位安排。'],
          },
        };
      },
      getExchangeErrors: async () => errors,
      clearExchangeErrors: async () => {
        errors = [];
        return { success: true };
      },
      onRefreshData: (fn) => {
        state.refresh = fn;
        return () => {};
      },
      onExchangeErrors: (fn) => {
        state.onErrors = fn;
        return () => {};
      },
      resetToDefaults: async () => result('resetToDefaults'),
      deleteAllData: async () => {
        const r = result('deleteAllData');
        if (r.success) {
          configured = false;
          stored = {};
        }
        return r;
      },
      openExternal: async (value) => {
        result('openExternal', value);
      },
      minimizeWindow: async () => {
        result('minimizeWindow');
      },
      quitApp: async () => {
        result('quitApp');
      },
    };
  }, { ...options, appVersion: require('../package.json').version });
}

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.join(repository, 'vite.config.ts'),
    root: path.join(repository, 'src/renderer'),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  let browser;
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const fontDirectory = process.env.UI_TEST_FONT_DIR;
  let fontCSS = fontDirectory
    ? ['chinese-simplified-400.css', 'latin-400.css', 'chinese-simplified-600.css', 'latin-600.css']
        .map((file) => fs.readFileSync(path.join(fontDirectory, file), 'utf8'))
        .join('\n')
    : '';
  fontCSS = fontCSS.replace(
    /url\(([^)]+)\)/g,
    (_, url) =>
      'url(data:font/woff2;base64,' +
      fs.readFileSync(path.join(fontDirectory, url.replace(/[\"']/g, ''))).toString('base64') +
      ')'
  );
  if (fontDirectory)
    fontCSS += '\n.app,button,input,select{font-family: \"Noto Sans SC\",sans-serif;}';
  const errors = [];
  const results = [];
  async function open(options = {}, width = 480) {
    const page = await browser.newPage({
      viewport: { width, height: 600 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (log) => {
      if (log.type() === 'error') errors.push(log.text());
    });
    await fixture(page, options);
    await page.goto(origin);
    await page.getByRole('heading', { name: '持仓盈亏', exact: true }).waitFor();
    await page.locator('.skeleton-overview').waitFor({ state: 'detached' });
    if (fontCSS) await page.addStyleTag({ content: fontCSS });
    await page.evaluate(() => document.fonts.ready);
    return page;
  }
  async function capture(page, name) {
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('.screen, .screen-body')].some(
        (element) => element.scrollWidth > element.clientWidth + 1
      )
    );
    assert.equal(overflow, false, name + ' horizontal overflow');
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })
      ).violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      }))
    );
    if (violations.length) {
      console.log('A11Y', name, JSON.stringify(violations));
      errors.push(name + ': ' + violations.map((item) => item.id).join(','));
    }
    await page.screenshot({ path: path.join(screenshots, name + '.png') });
  }
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.UI_BROWSER_EXECUTABLE
        ? {
            executablePath: process.env.UI_BROWSER_EXECUTABLE,
            args: [
              '--no-sandbox',
              '--disable-gpu',
              '--disable-dev-shm-usage',
              '--disable-software-rasterizer',
              '--no-zygote',
            ],
          }
        : {}),
    });
    const page = await open();
    await capture(page, '01-overview');
    await page.getByText('价格与仓位详情', {exact:true}).first().click();
    await capture(page, '01-overview-expanded');
    await page.getByText('价格与仓位详情', {exact:true}).first().click();
    const analysis = page.getByRole('button', { name: 'AI 持仓分析', exact: true });
    assert(await analysis.isVisible());
    assert(await analysis.evaluate((element) => element.getBoundingClientRect().bottom <= 565));
    await analysis.click();
    await page.getByRole('heading', { name: 'AI 持仓分析', exact: true }).waitFor();
    await capture(page, '02-health');
    assert.equal(await page.evaluate(() => window.__qa.aiRequests[0][3]), true);
    await page.evaluate(() => {
      window.__qa.failAI = true;
    });
    await page.getByRole('button', { name: '重新分析', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '模拟 AI 请求失败' }).waitFor();
    await page.getByRole('button', { name: '关闭通知', exact: true }).click();
    await page.evaluate(() => {
      window.__qa.failAI = false;
    });
    await page.getByRole('button', { name: '返回持仓', exact: true }).click();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await capture(page, '03-settings-index');
    const sections = ['API 配置', '显示设置', '外观', '系统', 'AI 分析', '开发者', '关于'];
    for (const [index, section] of sections.entries()) {
      await page.getByRole('button', { name: new RegExp('^' + section) }).click();
      await page.getByRole('heading', { name: section, exact: true }).waitFor();
      await capture(page, `settings-${index}-${section}`);
      if (section === 'API 配置') {
        assert.equal(
          await page.getByLabel('API Secret', { exact: true }).getAttribute('type'),
          'password'
        );
        await page.getByRole('button', { name: '显示 API Secret', exact: true }).click();
        assert.equal(
          await page.getByLabel('API Secret', { exact: true }).getAttribute('type'),
          'text'
        );
        await page.getByLabel('API Key', { exact: true }).fill('');
        await page.getByRole('button', { name: '保存配置', exact: true }).click();
        assert(await page.getByText('请完整填写所需凭证').isVisible());
        assert.equal(
          await page.evaluate(
            () => window.__calls.filter((item) => item[0] === 'saveExchangeCredentials').length
          ),
          0
        );
        await page.getByLabel('API Key', { exact: true }).fill('new-demo-key');
        await page.evaluate(() => (window.__qa.failSave = true));
        await page.getByRole('button', { name: '保存配置', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: '模拟保存失败' }).waitFor();
        await page.evaluate(() => (window.__qa.failSave = false));
        await page.getByRole('button', { name: '保存配置', exact: true }).click();
        await page.getByText('凭证已保存', { exact: true }).first().waitFor();
        await page.getByRole('tab', { name: 'OKX', exact: true }).click();
        assert(await page.getByLabel('Passphrase', { exact: true }).isVisible());
        await page.getByRole('tab', { name: 'Hyperliquid', exact: true }).click();
        assert(await page.getByLabel('钱包地址', { exact: true }).isVisible());
        assert.equal(await page.getByLabel('API Secret', { exact: true }).count(), 0);
        assert(await page.getByText('仅使用公开钱包地址，无需私钥。暂仅支持标准账户（disabled），其他模式不生成汇总。', { exact: true }).isVisible());
      }
      if (section === '外观') {
        const slider = page.getByRole('slider', { name: '窗口透明度', exact: true });
        await slider.focus();
        await slider.press('ArrowLeft');
        await page.getByText('95%', { exact: true }).waitFor();
        assert.equal(await slider.getAttribute('aria-valuenow'), '0.95');
        await page.getByRole('button', { name: '浅色', exact: true }).click();
        await page.locator('.app.light-mode').waitFor();
        await capture(page, '04-light-appearance');
        await page.getByRole('button', { name: '深色', exact: true }).click();
      }
      if (section === '显示设置') {
        const picker = page.getByRole('combobox', { name: '菜单栏显示数量', exact: true });
        const original = await picker.innerText();
        const before = await page.evaluate(() => window.__calls.filter(c => c[0] === 'saveDisplaySettings').length);
        await picker.focus();
        await picker.press('Enter');
        await page.getByRole('listbox').waitFor();
        await page.keyboard.press('End');
        await page.keyboard.press('Escape');
        await page.getByRole('listbox').waitFor({ state: 'detached' });
        assert.equal(await picker.innerText(), original);
        assert(await picker.evaluate(element => element === document.activeElement));
        assert.equal(await page.evaluate(() => window.__calls.filter(c => c[0] === 'saveDisplaySettings').length), before);
        await page.evaluate(() => { window.__qa.blockDisplaySave = true; });
        await picker.press('Enter');
        await page.getByRole('option', { name: '1 个', exact: true }).click();
        assert(await picker.isDisabled());
        await page.evaluate(() => { window.__qa.blockDisplaySave = false; window.__qa.releaseDisplaySave(); });
        await page.getByRole('combobox', { name: '菜单栏显示数量', exact: true }).getByText('1 个', { exact: true }).waitFor();
        await page.waitForFunction(() => !document.querySelector('[aria-label="菜单栏显示数量"]').disabled);
        assert(await picker.evaluate(element => element === document.activeElement));
        assert(await page.evaluate(() => window.__calls.some(c => c[0] === 'saveDisplaySettings' && c[1].maxDisplayCount === 1)));
      }
      if (section === '系统') {
        await page.evaluate(() => {
          window.__qa.failSave = true;
        });
        await page.getByRole('switch', { name: '开机自动启动', exact: true }).click();
        await page.getByText('模拟保存失败', { exact: true }).waitFor();
        assert.equal(
          await page.getByRole('switch', { name: '开机自动启动', exact: true }).isChecked(),
          false
        );
        await page.evaluate(() => {
          window.__qa.failSave = false;
        });
        assert.equal(await page.getByLabel('代理地址（可选）', { exact: true }).getAttribute('type'), 'password');
        await page.getByLabel('代理地址（可选）', { exact: true }).fill('invalid proxy');
        await page.getByRole('button', { name: '保存代理' }).click();
        assert(
          await page.getByText('请输入有效的 HTTP / HTTPS 代理地址，或留空以直连').isVisible()
        );
      }
      if (section === '关于') {
        await page.getByRole('button', { name: '删除所有数据', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        await page.keyboard.press('Tab');
        assert(await dialog.evaluate((element) => element.contains(document.activeElement)));
        await capture(page, '05-delete-dialog');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.equal(
          await page.evaluate(
            () => window.__calls.filter((item) => item[0] === 'deleteAllData').length
          ),
          0
        );
      }
      await page.getByRole('button', { name: '返回设置', exact: true }).click();
    }
    results.push(
      'all 7 settings pages, credential validation / save failure, reveal, OKX, Hyperliquid, themes, proxy validation, dialog focus / cancel'
    );
    await page.getByRole('button', { name: '返回持仓', exact: true }).click();
    await page.getByRole('button', { name: /^通知中心/ }).click();
    await capture(page, '06-notifications');
    await page.getByRole('button', { name: '全部已读', exact: true }).click();
    await page.getByRole('button', { name: '返回持仓', exact: true }).click();
    await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
    assert.equal(await page.locator('.asset-total').innerText(), '••••••\nUSDT');
    assert(!(await page.locator('.position-pnl').innerText()).includes('431.73'));
    await capture(page, '07-hidden');
    results.push('notifications read state and amount privacy');

    const multi = await open({ multiple: true });
    await capture(multi, '07-multiple-overview');
    assert(await multi.locator('.position-item').nth(2).evaluate(element => element.getBoundingClientRect().bottom <= 565));
    await multi.getByText('价格与仓位详情', {exact:true}).first().click();
    await capture(multi, '07-multiple-expanded');
    await multi.getByRole('button', { name: '调整顺序', exact: true }).click();
    assert.equal(await multi.locator('.position-item').count(), 3);
    const initial = await multi
      .locator('.position-item')
      .evaluateAll((elements) => elements.map((element) => element.dataset.position));
    await multi.getByRole('button', { name: '下移 binance FOLKS', exact: true }).click();
    await capture(multi, '08-sort');
    await multi.getByRole('button', { name: '取消', exact: true }).click();
    assert.deepEqual(
      await multi
        .locator('.position-item')
        .evaluateAll((elements) => elements.map((element) => element.dataset.position)),
      initial
    );
    await multi.getByRole('button', { name: '调整顺序', exact: true }).click();
    await multi.getByRole('button', { name: '下移 binance FOLKS', exact: true }).click();
    await multi.getByRole('button', { name: '保存顺序', exact: true }).click();
    await multi.getByRole('heading', { name: '持仓盈亏', exact: true }).waitFor();
    const saved = await multi.evaluate(
      () => window.__calls.find((item) => item[0] === 'savePositionOrder')[1]
    );
    assert.equal(saved.length, 3);
    assert.equal(new Set(saved).size, 3);
    assert.equal(saved[1], initial[0]);
    results.push('multi-exchange same-symbol sort save and cancellation');
    await multi.evaluate(() => {
      window.__qa.failData = true;
    });
    await multi.getByRole('button', { name: '刷新数据', exact: true }).click();
    await multi.getByText('数据未完整更新', { exact: true }).waitFor();
    assert.equal(await multi.locator('.position-item').count(), 3);
    assert(await multi.getByRole('button', { name: 'AI 持仓分析', exact: true }).isDisabled());
    await capture(multi, '09-offline-stale');
    results.push('offline failure retains last data and blocks stale AI analysis');
    for (const [name, opts] of [
      ['10-empty', { empty: true }],
      ['11-unconfigured', { unconfigured: true }],
      ['12-partial', { partial: true }],
      ['13-ai-missing', { aiMissing: true }],
    ]) {
      const current = await open(opts);
      if (opts.aiMissing) {
        await current.getByRole('button', { name: 'AI 持仓分析', exact: true }).click();
        await current.getByRole('heading', { name: 'AI 分析', exact: true }).waitFor();
      }
      await capture(current, name);
      await current.close();
    }
    results.push('empty, unconfigured, partial connectivity, missing AI provider key');
    const narrow = await open({}, 320);
    await capture(narrow, '14-narrow');
    await narrow.getByRole('button', { name: '设置', exact: true }).click();
    await narrow.getByRole('button', { name: /^API 配置/ }).click();
    await capture(narrow, '15-narrow-form');
    results.push('320px width overflow checks');
    await narrow.getByRole('button', { name: '返回设置', exact: true }).click();
    await narrow.getByRole('button', { name: /^显示设置/ }).click();
    const compactPicker = narrow.getByRole('combobox', { name: '刷新间隔', exact: true });
    await compactPicker.click();
    const popup = narrow.getByRole('listbox');
    await popup.waitFor();
    assert(await popup.evaluate(element => { const r=element.getBoundingClientRect(); return r.left>=0 && r.right<=320 && r.top>=0 && r.bottom<=600; }));
    await capture(narrow, '20-component-select-320');
    await narrow.keyboard.press('Escape');
    await popup.waitFor({ state: 'detached' });
    results.push('component select keyboard cancel/focus and typed save, slider keyboard commit, private proxy, 320px popover bounds');
    const large = await open({large:true,multiple:true},320);
    await capture(large,'16-large-amounts');
    await large.close();
    const hyperliquid = await open({ hyperliquid: true }, 320);
    await hyperliquid.getByText('Hyperliquid · 统计范围与估值假设', { exact: true }).click();
    assert(await hyperliquid.getByText(/按 USDC 与 USDT 1:1 估算/).isVisible());
    await capture(hyperliquid, '18-hyperliquid-assumptions');
    await hyperliquid.close();
    results.push('Hyperliquid valuation assumptions and account-scope disclosure at 320px');
    const storageBlocked = await open({ storageBlocked: true }, 320);
    assert(await storageBlocked.getByText('配置未能安全读取', { exact: true }).isVisible());
    assert.equal(await storageBlocked.getByRole('heading', { name: '连接你的第一个交易所' }).count(), 0);
    await storageBlocked.getByRole('button', { name: '重启并重新读取', exact: true }).click();
    assert(await storageBlocked.evaluate(() => window.__calls.some(c => c[0] === 'restartForStorage')));
    await capture(storageBlocked, '19-storage-recovery');
    await storageBlocked.close();
    results.push('locked/corrupt storage recovery notice, no empty onboarding, explicit restart at 320px');
    const activity = await open({}, 320);
    await activity.getByRole('button', { name: '更多操作', exact: true }).click();
    await activity.getByRole('button', { name: '持仓动态 · 交易室', exact: true }).click();
    await activity.getByRole('heading', { name: '等待下一次持仓变化', exact: true }).waitFor();
    await activity.evaluate(() => { window.__qa.positions[0].positionAmt = '400'; window.__qa.refresh(); });
    await activity.getByText('FOLKS · 数量增加', { exact: true }).waitFor();
    assert(await activity.getByText('binance · 多仓 · 380.1985 → 400', { exact: true }).isVisible());
    await activity.getByRole('button', { name: '暂停示意动画', exact: true }).click();
    assert.equal(await activity.getByRole('button', { name: '播放示意动画', exact: true }).getAttribute('aria-pressed'), 'true');
    await capture(activity, '17-trading-room');
    await activity.evaluate(() => { window.__qa.failData = true; window.__qa.refresh(); });
    await activity.getByText('连接中断后会重建基线，间隔内变化未分类。', { exact: true }).waitFor();
    await activity.evaluate(() => { window.__qa.failData = false; window.__qa.positions[0].positionAmt = '1'; window.__qa.refresh(); });
    await activity.getByText('已有快照', { exact: true }).waitFor();
    assert.equal(await activity.locator('.event-list li').count(), 1, 'no inferred change through an outage');
    await activity.getByRole('button', { name: '返回持仓', exact: true }).click();
    await activity.getByRole('button', { name: '隐藏金额', exact: true }).click();
    await activity.getByRole('button', { name: '更多操作', exact: true }).click();
    await activity.getByRole('button', { name: '持仓动态 · 交易室', exact: true }).click();
    assert(await activity.getByText('binance · 多仓 · ••••', { exact: true }).isVisible());
    await activity.close();
    results.push('session changes, animation pause, outage rebaseline, private amounts and 320px trading room');
    const risk = await open({riskDetails:true},320);
    await risk.getByText('价格与仓位详情', {exact:true}).click();
    assert(await risk.getByText('强平参考距离',{exact:true}).isVisible());
    assert(await risk.getByText('60.00%',{exact:true}).isVisible());
    await capture(risk,'20-risk-position-details');
    await risk.getByText('价格与仓位详情', {exact:true}).click();
    await risk.getByRole('button',{name:'AI 持仓分析',exact:true}).click();
    await risk.getByText('逐仓强平与保证金',{exact:true}).click();
    await risk.getByText('各交易所独立账户口径',{exact:true}).click();
    await risk.getByText('保持 / 缩减仓位的价格情景',{exact:true}).click();
    assert.equal(await risk.locator('.scenario-table tbody tr').count(),6);
    assert(await risk.evaluate(()=>Array.isArray(window.__qa.aiRequests[0][1]) && window.__qa.aiRequests[0][1][0].exchange==='binance'));
    await risk.getByText('市场背景与条件资金费',{exact:true}).click();
    assert(await risk.getByText(/假设下次费率等于/).isVisible());
    await capture(risk,'21-risk-scenarios');
    await risk.close();
    results.push('320px liquidation/margin details, independent account AI input and six comparable coherent price scenarios');
    const research = await open({},320);
    assert.equal(await research.evaluate(()=>window.__calls.filter(c=>c[0]==='getPublicMarket').length),0);
    await research.getByRole('button',{name:'更多操作',exact:true}).click();
    await research.getByRole('button',{name:'公共市场 · 研究观察',exact:true}).click();
    await research.getByRole('heading',{name:'公共市场 · 研究观察',exact:true}).waitFor();
    await research.getByRole('heading',{name:'平台合约市场宽度 · 滚动24h',exact:true}).waitFor();
    await research.getByText('新上市观察 · 最近30天，最多5个',{exact:true}).click();
    await research.getByText('BTCUSDT · 资金费 / OI / 价格历史',{exact:true}).click();
    assert(await research.getByText('未平仓量不可用或过期',{exact:true}).isVisible());
    await capture(research,'22-public-market');
    assert(await research.evaluate(()=>window.__calls.filter(c=>c[0]==='getPublicMarket').every(c=>Array.isArray(c[1])&&c[1].every(s=>typeof s==='string'))));
    await research.evaluate(()=>window.__qa.failMarket=true);
    await research.getByRole('button',{name:'刷新研究',exact:true}).click();
    await research.getByRole('alert').filter({hasText:'公开行情获取失败'}).waitFor();
    await capture(research,'23-public-market-failure');
    await research.close();
    results.push('on-demand public research only, 320px breadth/listings/history, explicit missing OI and failed-refresh snapshot retention');
    assert.deepEqual(errors, [], 'browser errors');
    console.log(JSON.stringify({ results, errors, screenshots }, null, 2));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
