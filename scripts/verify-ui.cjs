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
    let configured = !options.unconfigured;
    let stored = { binance: { apiKey: 'demo-key-not-real', apiSecret: 'demo-secret-not-real' } };
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
      exchange: 'binance',
      totalAssets: 445.47,
      spotTotalUSDT: 0.06,
      totalWalletBalance: 13.67,
      totalUnrealizedProfit: 431.73,
      totalMarginBalance: 445.4,
      availableBalance: 0,
      maxWithdrawAmount: 0,
    };
    const state = {
      positions,
      errors,
      failData: false,
      failAI: false,
      aiRequests: [],
      fetchCount: 0,
      failSave: false,
    };
    const result = (method, ...args) => {
      calls.push([method, ...args]);
      return state.failSave ? { success: false, error: '模拟保存失败' } : { success: true };
    };
    window.__qa = state;
    window.__calls = calls;
    window.electronAPI = {
      hasCredentials: async () => configured,
      getAllExchangesCredentials: async () => (options.unconfigured ? {} : stored),
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
      getAppVersion: async () => '1.0.0',
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
      saveDisplaySettings: async (value) => result('saveDisplaySettings', value),
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
      aiAnalyzeHealth: async (...args) => {
        state.aiRequests.push(args);
        if (state.failAI) return { success: false, error: '模拟 AI 请求失败' };
        return {
          success: true,
          data: {
            overallScore: 62,
            diversification: 35,
            leverage: 50,
            riskExposure: 63,
            profitabilityRatio: 78,
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
  }, options);
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
      }
      if (section === '外观') {
        await page.getByRole('button', { name: '浅色', exact: true }).click();
        await page.locator('.app.light-mode').waitFor();
        await capture(page, '04-light-appearance');
        await page.getByRole('button', { name: '深色', exact: true }).click();
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
        await page.getByLabel('代理地址（可选）').fill('invalid proxy');
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
