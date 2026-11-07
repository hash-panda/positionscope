/* Synthetic settings/credential/privacy UI regressions. No account/model network calls. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fixture}=require('./verify-research-ui.cjs');
const repository=path.resolve(__dirname,'..');
const screenshots=path.join(repository,'test-results','workspace-settings');
fs.mkdirSync(screenshots,{recursive:true});

// The shared fixture runs once before app boot. Override the same API object only
// after boot, avoiding ordering assumptions between multiple addInitScript calls.
async function mutableSettings(page,options={}) {
  await page.evaluate(options=>{
    const api=window.electronAPI,state=window.__qa,calls=window.__calls;
    state.configured=!options.blocked&&!options.unconfigured;
    state.display={maxDisplayCount:2,refreshInterval:60,colorScheme:'green-up',watchlistSymbols:['BTCUSDT','ETHUSDT']};
    state.hideAmounts=!!options.hidden;state.proxyUrl='';state.autoLaunch=false;
    state.ai={enabled:true,defaultProvider:'deepseek',useCustomKeys:true,credentials:{deepseek:{provider:'deepseek',apiKey:'synthetic-model-key',model:'explicit-test-model'}}};
    state.stored=state.configured?{binance:{apiKey:'synthetic-key-not-real',apiSecret:'synthetic-secret-not-real'}}:{};
    const saved=(method,...args)=>{calls.push([method,...args]);return state.failSave?{success:false,error:'合成保存失败'}:{success:true};};
    api.hasCredentials=async()=>state.configured;
    api.getAllExchangesCredentials=async()=>structuredClone(state.stored);
    api.getDisplaySettings=async()=>{if(state.blockPreferenceRead)await new Promise(resolve=>{state.releasePreferenceRead=resolve;});return structuredClone(state.display);};
    api.getHideAmounts=async()=>state.hideAmounts;api.getProxySettings=async()=>state.proxyUrl;
    api.getAISettings=async()=>structuredClone(state.ai);api.getAutoLaunch=async()=>state.autoLaunch;
    api.saveDisplaySettings=async value=>{if(state.blockDisplaySave)await new Promise(resolve=>{state.releaseDisplaySave=resolve;});const r=saved('saveDisplaySettings',value);if(r.success)state.display=structuredClone(value);return r;};
    api.saveHideAmounts=async value=>{const r=saved('saveHideAmounts',value);if(r.success)state.hideAmounts=value;return r;};
    api.saveAISettings=async value=>{const r=saved('saveAISettings',value);if(r.success)state.ai=structuredClone(value);return r;};
    api.saveProxySettings=async value=>{const r=saved('saveProxySettings',value);if(r.success)state.proxyUrl=value;return r;};
    api.saveAutoLaunch=async value=>{const r=saved('saveAutoLaunch',value);if(r.success)state.autoLaunch=value;return r;};
    api.saveExchangeCredentials=async(exchange,credentials)=>{const r=saved('saveExchangeCredentials',exchange,credentials);if(r.success){state.stored[exchange]=structuredClone(credentials);state.configured=true;}return r;};
    state.updateState='available';state.downloadState={state:'current',currentVersion:'0.2.2',message:'点击检查更新。'};
    api.getUpdateState=async()=>structuredClone(state.downloadState);
    api.onAppUpdateState=callback=>{state.updateListener=callback;return()=>{state.updateListener=null;};};
    state.emitUpdate=value=>{state.downloadState={...state.downloadState,...value};state.updateListener?.(structuredClone(state.downloadState));};
    api.checkForUpdates=async()=>{calls.push(['checkForUpdates']);if(state.blockUpdateCheck)await new Promise(resolve=>{state.releaseUpdateCheck=resolve;});const value=state.updateState==='available'?{state:'available',currentVersion:'0.2.2',latestVersion:'9.0.0',message:'发现 9.0.0，可在应用内下载。'}:{state:state.updateState,currentVersion:'0.2.2',message:state.updateState==='current'?'当前已是最新可用版本。':'暂时无法确认可用更新，请稍后重试。'};state.emitUpdate(value);return value;};
    api.downloadUpdate=async()=>{calls.push(['downloadUpdate']);state.emitUpdate({state:'downloading',progress:42,message:'正在下载官方更新…'});return structuredClone(state.downloadState);};
    api.installUpdate=async()=>{calls.push(['installUpdate']);return state.downloadState.state==='ready';};
    api.aiAnalyzeHealth=async(...args)=>{calls.push(['aiAnalyzeHealth',...args]);return{success:false,error:'合成模型校验失败，未生成分析'};};
    const originalPositions=api.getFuturesPositions,originalAccounts=api.getFuturesAccountInfo;
    api.getFuturesPositions=async()=>{const old=await originalPositions();if(state.blockPositions)await new Promise(resolve=>{state.releasePositions=()=>resolve();});state.positionReadCompleted=true;return state.returnOldPositions?old:state.configured?old:[];};
    api.getFuturesAccountInfo=async()=>state.configured?originalAccounts():[];
    state.clearFromOtherWindow=()=>{state.configured=false;state.stored={};state.ai=null;state.hideAmounts=false;state.proxyUrl='';state.dataDeleted();};
  },options);
}
(async()=>{
  const {createServer}=await import('vite');
  const server=await createServer({configFile:path.join(repository,'vite.config.ts'),root:path.join(repository,'src/renderer'),server:{host:'127.0.0.1',port:0}});
  await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  let browser;const errors=[],results=[];
  async function open(options={}){
    const popup=options.mode==='popup';
    const page=await browser.newPage({viewport:popup?{width:480,height:600}:{width:1180,height:760},reducedMotion:'reduce'});
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    page.on('pageerror',e=>errors.push(e.message));await fixture(page,options);await page.goto(origin+(popup?'':'?mode=workspace'));
    await page.locator(popup?'.popup-dashboard':'.workspace-shell').waitFor();
    if(popup)await page.waitForFunction(()=>typeof window.__qa.preferencesChanged==='function');
    else {await page.getByRole('button',{name:'持仓',exact:true}).click();await page.locator(options.blocked||options.unconfigured?'.positions-page .research-empty':'.positions-table-row').first().waitFor();}
    await mutableSettings(page,options);return page;
  }
  async function settings(page,section){await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('.workspace-settings aside').getByRole('button',{name:section,exact:true}).click();}
  async function capture(page,name){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' horizontal overflow');
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))})));
    assert.deepEqual(violations,[],name+' accessibility');await page.screenshot({path:path.join(screenshots,name+'.png')});
    if(process.env.POSITIONSCOPE_VISUAL_REVIEW==='1'&&name==='00-display-layout')console.log(`POSITIONSCOPE_SYNTHETIC_SETTINGS:${(await page.screenshot({type:'jpeg',quality:65})).toString('base64')}`);
  }
  try{
    browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}: {})});
    const p=await open();await settings(p,'Binance 连接');
    assert.equal(await p.getByLabel('API Secret',{exact:true}).getAttribute('type'),'password');
    await p.getByRole('button',{name:'显示 API Secret',exact:true}).click();assert.equal(await p.getByLabel('API Secret',{exact:true}).getAttribute('type'),'text');
    assert.equal(await p.getByRole('tab',{name:/OKX|Bybit|Hyperliquid/}).count(),0);assert.equal(await p.getByLabel('Passphrase',{exact:true}).count(),0);
    await p.getByLabel('API Key',{exact:true}).fill('');await p.getByRole('button',{name:'保存配置',exact:true}).click();
    await p.getByText('请完整填写所需凭证',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='saveExchangeCredentials').length),0);
    await p.getByLabel('API Key',{exact:true}).fill('synthetic-unsaved-key');await p.evaluate(()=>window.__qa.failSave=true);await p.getByRole('button',{name:'保存配置',exact:true}).click();
    await p.getByRole('alert').filter({hasText:'合成保存失败'}).first().waitFor();assert.equal(await p.getByLabel('API Key',{exact:true}).inputValue(),'synthetic-unsaved-key');
    await p.evaluate(()=>window.__qa.failSave=false);await p.getByRole('button',{name:'保存配置',exact:true}).click();await p.waitForFunction(()=>window.__qa.stored.binance.apiKey==='synthetic-unsaved-key');
    await p.getByRole('button',{name:'移除 Binance 凭证',exact:true}).click();await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'detached'});
    assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='removeExchangeCredentials').length),0);
    results.push('Binance-only onboarding; masked credentials, empty validation, failed-save draft retention, removal cancellation');

    await settings(p,'显示与菜单栏');await p.getByText('+25.00',{exact:true}).waitFor();
    for(const width of [960,1180]) { await p.setViewportSize({width,height:760}); assert(await p.locator('.workspace-settings .screen-body').evaluate(e=>Math.abs(e.getBoundingClientRect().right-innerWidth)<2),'settings scroll viewport reaches right window edge'); assert(await p.locator('.settings-content').evaluate(e=>e.getBoundingClientRect().width<=780)); }
    await capture(p,'00-display-layout');
    const picker=p.getByRole('combobox',{name:'菜单栏显示数量',exact:true});const original=await picker.innerText();
    await picker.focus();await picker.press('Enter');await p.getByRole('listbox').waitFor();await p.keyboard.press('Home');await p.keyboard.press('Escape');await p.getByRole('listbox').waitFor({state:'detached'});assert.equal(await picker.innerText(),original);assert(await picker.evaluate(e=>e===document.activeElement));
    await p.evaluate(()=>window.__qa.blockDisplaySave=true);await picker.click();await p.getByRole('option',{name:'1 个',exact:true}).click();assert(await picker.isDisabled());
    await p.evaluate(()=>{window.__qa.blockDisplaySave=false;window.__qa.releaseDisplaySave();});await p.waitForFunction(()=>window.__qa.display.maxDisplayCount===1);await p.waitForFunction(()=>!document.querySelector('[aria-label="菜单栏显示数量"]').disabled);
    assert(await picker.evaluate(e=>e===document.activeElement));
    await p.getByRole('combobox',{name:'涨跌配色',exact:true}).click();await p.getByRole('option',{name:'红涨绿跌',exact:true}).click();await p.locator('.app.red-up').waitFor();
    await p.getByLabel('最多 8 个 USDT 永续合约，用逗号分隔',{exact:true}).fill('BTCUSDT, BTCUSDT');const count=await p.evaluate(()=>window.__calls.filter(c=>c[0]==='saveDisplaySettings').length);
    await p.getByRole('button',{name:'保存观察币种',exact:true}).click();await p.getByText('观察币种最多 8 个，请使用不重复的 Binance USDT 永续合约代码',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='saveDisplaySettings').length),count);
    await p.getByLabel('最多 8 个 USDT 永续合约，用逗号分隔',{exact:true}).fill('BTCUSDT, ETHUSDT, SOLUSDT');await p.getByRole('button',{name:'保存观察币种',exact:true}).click();await p.waitForFunction(()=>window.__qa.display.watchlistSymbols.length===3);
    await p.evaluate(()=>{window.__qa.blockPreferenceRead=true;window.__qa.hideAmounts=true;window.__qa.preferencesChanged();});
    await p.waitForFunction(()=>document.querySelector('.menubar-preview')?.textContent.includes('••••••'));
    assert.equal(await p.locator('.menubar-preview .positive,.menubar-preview .negative').count(),0);
    await p.evaluate(()=>{window.__qa.blockPreferenceRead=false;window.__qa.releasePreferenceRead();});assert(await p.getByRole('switch',{name:'隐藏金额',exact:true}).isChecked());
    await capture(p,'01-display-private');
    results.push('component keyboard/focus/busy state, color preference, duplicate watchlist rejection and save, immediate cross-window private-color masking');

    await settings(p,'系统');await p.evaluate(()=>window.__qa.failSave=true);await p.getByRole('switch',{name:'开机自动启动',exact:true}).click();await p.getByRole('alert').filter({hasText:'合成保存失败'}).first().waitFor();await p.waitForFunction(()=>document.querySelector('[role="switch"][aria-label="开机自动启动"]')?.getAttribute('aria-checked')==='false');assert.equal(await p.getByRole('switch',{name:'开机自动启动',exact:true}).isChecked(),false);await p.evaluate(()=>window.__qa.failSave=false);
    const proxy=p.getByLabel('代理地址（可选）',{exact:true});assert.equal(await proxy.getAttribute('type'),'password');await proxy.fill('invalid proxy');await p.getByRole('button',{name:'保存代理',exact:true}).click();await p.getByText('请输入有效的 HTTP / HTTPS 代理地址，或留空以直连',{exact:true}).waitFor();
    assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='saveProxySettings').length),0);
    await proxy.fill('http://synthetic-draft.invalid:7890');await p.evaluate(()=>{window.__qa.proxyUrl='http://synthetic-remote.invalid:7891';window.__qa.display.refreshInterval=3;window.__qa.display.colorScheme='green-up';window.__qa.preferencesChanged();});await p.locator('.app[data-color-scheme="green-up"]').waitFor();assert.equal(await proxy.inputValue(),'http://synthetic-draft.invalid:7890');
    await settings(p,'AI 与模型');await p.getByRole('button',{name:'Anthropic',exact:true}).click();await p.getByLabel('Anthropic API Key',{exact:true}).fill('synthetic-anthropic-draft');await p.getByRole('button',{name:'保存配置',exact:true}).click();await p.getByText(/anthropic需要填写当前可用的模型ID/).first().waitFor();
    await p.getByLabel('模型 ID（必填）',{exact:true}).fill('synthetic-explicit-model');await p.evaluate(()=>{window.__qa.display.colorScheme='red-up';window.__qa.preferencesChanged();});await p.locator('.app.red-up').waitFor();assert.equal(await p.getByLabel('Anthropic API Key',{exact:true}).inputValue(),'synthetic-anthropic-draft');
    await p.getByRole('button',{name:'保存配置',exact:true}).click();await p.waitForFunction(()=>window.__calls.some(c=>c[0]==='saveAISettings'&&c[1].credentials.anthropic.model==='synthetic-explicit-model'));
    await capture(p,'02-model-settings');results.push('auto-launch save rollback, private proxy validation and draft sync, explicit model selection and unsaved AI draft preservation');

    await settings(p,'关于与更新');assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='checkForUpdates').length),0);
    await p.evaluate(()=>window.__qa.blockUpdateCheck=true);await p.getByRole('button',{name:'检查更新',exact:true}).click();assert(await p.getByRole('button',{name:'正在检查…',exact:true}).isDisabled());
    await p.evaluate(()=>{window.__qa.blockUpdateCheck=false;window.__qa.releaseUpdateCheck();});await p.getByRole('button',{name:'下载 9.0.0 更新',exact:true}).waitFor();
    for(const state of ['current','unavailable']){await p.evaluate(state=>window.__qa.updateState=state,state);await p.getByRole('button',{name:'检查更新',exact:true}).click();await p.getByText(state==='current'?'当前已是最新可用版本。':'暂时无法确认可用更新，请稍后重试。',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'下载 9.0.0 更新',exact:true}).count(),0);}
    await p.evaluate(()=>window.__qa.updateState='available');await p.getByRole('button',{name:'检查更新',exact:true}).click();await p.getByRole('button',{name:'下载 9.0.0 更新',exact:true}).click();await p.getByText('42%',{exact:true}).waitFor();assert(await p.getByRole('button',{name:'正在下载…',exact:true}).isDisabled());assert.equal(await p.getByRole('button',{name:'重启更新',exact:true}).count(),0);
    await settings(p,'外观');await settings(p,'关于与更新');await p.getByText('42%',{exact:true}).waitFor();
    await p.evaluate(()=>window.__qa.emitUpdate({state:'verifying',progress:100,message:'正在进行 macOS 签名检查…'}));assert(await p.getByRole('button',{name:'正在验证…',exact:true}).isDisabled());
    await p.evaluate(()=>window.__qa.emitUpdate({state:'ready',progress:100,message:'更新已准备好。'}));await p.getByRole('button',{name:'重启更新',exact:true}).click();assert(await p.evaluate(()=>window.__calls.some(c=>c[0]==='installUpdate')));assert(!await p.evaluate(()=>window.__calls.some(c=>c[0]==='openExternal'&&c[1]?.includes('/releases/'))));
    for(const action of ['恢复默认设置','删除所有数据']){await p.getByRole('button',{name:action,exact:true}).click();const dialog=p.getByRole('dialog');await dialog.waitFor();await p.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)));await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});}
    assert.equal(await p.evaluate(()=>window.__calls.filter(c=>['resetToDefaults','deleteAllData'].includes(c[0])).length),0);await capture(p,'03-update-states');results.push('explicit-only update checking, loading/current/available/unavailable, in-app download/progress, navigation persistence, native verification then restart; reset/delete modal focus and cancellation');

    await p.getByRole('button',{name:'持仓',exact:true}).click();await p.getByRole('button',{name:'持仓分析',exact:true}).click();await p.getByRole('dialog',{name:'发送持仓风险事实进行分析？'}).waitFor();await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='aiAnalyzeHealth').length),0,'private analysis requires confirmation');
    await p.getByRole('button',{name:'持仓分析',exact:true}).click();await p.getByRole('button',{name:'确认发送并分析',exact:true}).click();await p.getByRole('alert').filter({hasText:'合成模型校验失败'}).waitFor();assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='aiAnalyzeHealth').length),1);
    await p.evaluate(()=>{window.__qa.blockPositions=true;window.__qa.returnOldPositions=true;window.__qa.positionReadCompleted=false;window.__qa.refresh();});await p.waitForFunction(()=>typeof window.__qa.releasePositions==='function');await p.evaluate(()=>window.__qa.clearFromOtherWindow());
    await p.getByRole('button',{name:'持仓',exact:true}).click();await p.getByRole('heading',{name:'连接 Binance 账户',exact:true}).waitFor();assert.equal(await p.locator('.positions-table-row').count(),0);
    await p.evaluate(()=>window.__qa.releasePositions());await p.waitForFunction(()=>window.__qa.positionReadCompleted===true);assert.equal(await p.locator('.positions-table-row').count(),0,'late pre-delete snapshot cannot restore positions');
    assert.equal(await p.getByRole('button',{name:/通知中心，/}).count(),0,'cross-window deletion clears notification state');
    await settings(p,'Binance 连接');assert.equal(await p.getByLabel('API Key',{exact:true}).inputValue(),'');assert.equal(await p.getByLabel('API Secret',{exact:true}).inputValue(),'');await p.close();
    results.push('private holdings consent cancel/confirm, cross-window deletion clears rows/secrets/notifications and rejects late pre-delete account response');

    const blocked=await open({mode:'popup',blocked:true});await blocked.getByText('配置未能安全读取',{exact:true}).waitFor();assert.equal(await blocked.locator('.popup-pnl').innerText(),'—');
    assert.equal(await blocked.getByText('连接 Binance，开始只读监控',{exact:true}).count(),0);assert.equal(await blocked.getByRole('button',{name:/配置只读 API/}).count(),0);await blocked.getByRole('button',{name:'重启并重新读取',exact:true}).click();assert(await blocked.evaluate(()=>window.__calls.some(c=>c[0]==='restartForStorage')));await capture(blocked,'04-encrypted-storage-blocked');await blocked.close();
    results.push('blocked encrypted store stays unknown, never becomes empty onboarding, explicit recovery action');
    assert.deepEqual(errors,[],'renderer exceptions');console.log(JSON.stringify({results,errors,screenshots},null,2));
  }finally{await browser?.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
