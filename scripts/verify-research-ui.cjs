/* Synthetic renderer regression only. No account, exchange or model network requests. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repository = path.resolve(__dirname, '..');
const screenshots = path.join(repository, 'test-results', 'research-ui');
fs.mkdirSync(screenshots, { recursive: true });

async function fixture(page, options = {}) {
  await page.addInitScript(options => {
    const now = Date.now();
    const calls = [];
    const state = { failScan: false, failSave: false, failAI: false, failEvidence: false, failAccount: !!options.failure };
    const facts = symbol => [
      {id:symbol+':price-24h',label:'24h 价格变化',value:2.4,unit:'percent',source:'https://fapi.binance.com/fapi/v1/ticker/24hr',observedAt:now,fetchedAt:now,window:'rolling 24h'},
      {id:symbol+':volume',label:'24h 成交额',value:20000000,unit:'USDT',source:'https://fapi.binance.com/fapi/v1/ticker/24hr',observedAt:now,fetchedAt:now,window:'rolling 24h'},
    ];
    const events = ['BTC','ETH','SOL'].map((s,i)=>({id:s+'-event',snapshotId:'synthetic-snapshot',ruleVersion:'synthetic-v1',symbol:s+'USDT',baseAsset:s,kind:'relative-strength',direction:'long',title:['相对强势需要确认','成交活跃需要确认','资金费变化待复核'][i],reason:'合成测试证据；不是真实投资信息',priority:3-i,detectedAt:now,expiresAt:now+600000,facts:facts(s+'USDT'),gaps:[],deepResearchEligible:true}));
    const snapshot = {version:'research-snapshot-v1',ruleVersion:'synthetic-v1',snapshotId:'synthetic-snapshot',status:'partial',events:options.empty?[]:events,breadth:{eligible:20,priced:18,rising:10,falling:7,flat:1,medianChange24h:1,quoteVolume24h:80000000},coverage:{universe:'Binance USDT perpetual',eligible:20,tickerValid:18,fundingValid:18,aboveTurnoverFloor:12,deepResearchBudget:3,selected:['BTCUSDT','ETHUSDT','SOLUSDT'],excluded:8,turnoverFloorUSDT:10000000,scope:'仅 Binance USDT 永续合约；合成测试范围。'},timestamps:{fetchedAt:now,expiresAt:options.expired?now-1:now+600000,tickerOldestAt:now,fundingOldestAt:now},gaps:['部分盘口缺失']};
    state.advanceSnapshot=()=>{snapshot.snapshotId='synthetic-snapshot-2';snapshot.events=snapshot.events.map(event=>({...event,snapshotId:snapshot.snapshotId}));};
    const evidence = symbol=>({version:'research-evidence-v1',ruleVersion:'synthetic-v1',snapshotId:state.staleEvidence?'mismatched-snapshot':snapshot.snapshotId,symbol,fetchedAt:now,expiresAt:now+600000,status:'partial',facts:facts(symbol),changes:{price1hPercent:1.2,price24hPercent:2.4,openInterest1hPercent:null,settledFundingRate:.0001},liquidity:{spreadBps:1.3,midPrice:100,bidDepth1pctUSDT:null,askDepth1pctUSDT:null,bidBandCovered:false,askBandCovered:false,assumedOrderUSDT:1000,buyImpactBps:null,sellImpactBps:null,buyFilled:false,sellFilled:false,observedAt:now,source:'https://fapi.binance.com/fapi/v1/depth',notes:['深度未覆盖目标区间']},conditions:[{id:'price-positive',label:'价格持续为正',factIds:[symbol+':price-24h'],state:'met'},{id:'liquidity-ready',label:'流动性可验证',factIds:[],state:'unknown'}],gaps:['未平仓量历史未知']});
    const ledger={version:'research-ledger-v1',records:[],watchedSymbols:[],alerts:[],shadows:[],retention:{maxRecords:200,omittedRecords:0,omittedShadows:0},limitations:['无真实交易结果']};
    const position={exchange:'binance',symbol:'BTCUSDT',positionId:'BTC:BOTH',positionAmt:'0.02',entryPrice:'60000',markPrice:'61000',unRealizedProfit:'20',marginType:options.isolated?'isolated':'cross',isolatedMargin:options.isolated?'18.75':null,isolatedWallet:options.isolated?'-12.5':null,leverage:'3',initialMargin:'400',maintenanceMargin:'12',marginCurrency:'USDT',liquidationPrice:'20000',fetchedAt:now};
    const positions = options.noPositions ? [] : [position,{...position,symbol:'ETHUSDT',positionId:'ETH:BOTH',positionAmt:'-0.5',entryPrice:'3200',markPrice:'3220',unRealizedProfit:'-10'},{...position,symbol:'SOLUSDT',positionId:'SOL:BOTH',positionAmt:'3',entryPrice:'160',markPrice:'165',unRealizedProfit:'15'}];
    const account={exchange:'binance',totalAssets:1000,spotTotalUSDT:100,totalWalletBalance:875,totalUnrealizedProfit:25,totalMarginBalance:900,availableBalance:450,maxWithdrawAmount:450};
    const result = (method,...args)=>{calls.push([method,...args]);return state.failSave?{success:false,error:'合成保存失败'}:{success:true};};
    const api={
      onResearchAlert:cb=>{state.researchAlert=cb;return()=>{};},getWindowMode:async()=>options.mode||'workspace',openWorkspace:async p=>result('openWorkspace',p),onWorkspacePage:()=>()=>{},
      getProxySettings:async()=>'',getStorageStatus:async()=>options.blocked?{state:'blocked',message:'合成测试：钥匙串不可读，原配置已保留。'}:{state:'encrypted',message:'系统加密'},restartForStorage:async()=>result('restartForStorage'),hasCredentials:async()=>!options.unconfigured&&!options.blocked,
      getAllExchangesCredentials:async()=>options.unconfigured||options.blocked?{}:{binance:{apiKey:'synthetic-key-not-real',apiSecret:'synthetic-secret-not-real'}},
      getFuturesPositions:async()=>{if(state.failAccount)throw Error('synthetic offline');return positions;},getFuturesAccountInfo:async()=>{if(state.failAccount)throw Error('synthetic offline');return [account];},getExchangeErrors:async()=>state.failAccount?[{exchange:'binance',errorCode:'BINANCE_INVALID_POSITION',suggestion:'合成数据不完整，请重试。',retryPaused:true}]:[],clearExchangeErrors:async()=>result('clearExchangeErrors'),
      getDisplaySettings:async()=>({maxDisplayCount:2,refreshInterval:60,colorScheme:options.reversed?'red-up':'green-up',watchlistSymbols:['BTCUSDT','ETHUSDT']}),getTheme:async()=>options.dark?'dark':'light',getHideAmounts:async()=>!!options.hidden,getDebugMode:async()=>false,getWindowOpacity:async()=>1,getAutoLaunch:async()=>false,getAppVersion:async()=>'0.2.1',getPositionOrder:async()=>[],getAISettings:async()=>({enabled:true,defaultProvider:'deepseek',useCustomKeys:true,credentials:{deepseek:{apiKey:'synthetic-model-key',model:'explicit-test-model'}}}),
      saveExchangeCredentials:async(...args)=>result('saveExchangeCredentials',...args),removeExchangeCredentials:async(...args)=>result('removeExchangeCredentials',...args),savePositionOrder:async(...args)=>result('savePositionOrder',...args),saveDisplaySettings:async(...args)=>result('saveDisplaySettings',...args),saveTheme:async(...args)=>result('saveTheme',...args),saveHideAmounts:async(...args)=>result('saveHideAmounts',...args),saveDebugMode:async()=>result('saveDebugMode'),saveWindowOpacity:async()=>result('saveWindowOpacity'),saveAutoLaunch:async()=>result('saveAutoLaunch'),saveAISettings:async()=>result('saveAISettings'),saveProxySettings:async()=>result('saveProxySettings'),resetToDefaults:async()=>result('resetToDefaults'),deleteAllData:async()=>result('deleteAllData'),onRefreshData:cb=>{state.refresh=cb;return()=>{};},onExchangeErrors:()=>()=>{},onPreferencesChanged:cb=>{state.preferencesChanged=cb;return()=>{};},onDataCleared:cb=>{state.dataDeleted=cb;return()=>{};},openExternal:async url=>result('openExternal',url),quitApp:async()=>result('quitApp'),minimizeWindow:async()=>{},
      getWatchlistMarket:async()=>({success:true,data:[{symbol:'BTCUSDT',baseAsset:'BTC',lastPrice:61000,change24hPercent:2.4,observedAt:now,fetchedAt:now},{symbol:'ETHUSDT',baseAsset:'ETH',lastPrice:3220,change24hPercent:-1.2,observedAt:now,fetchedAt:now}]}),
      getResearchSnapshot:async()=>{calls.push(['getResearchSnapshot']);return state.failScan?{success:false,error:'合成扫描失败'}:{success:true,data:snapshot};},getResearchEvidence:async symbol=>{calls.push(['getResearchEvidence',symbol]);const data=evidence(symbol);if(state.holdEvidence&&symbol==='BTCUSDT')await new Promise(resolve=>{state.releaseEvidence=resolve;});return state.failEvidence?{success:false,error:'合成证据失败'}:{success:true,data};},
      onResearchLedgerChanged:cb=>{state.ledgerChanged=cb;return()=>{};},getResearchLedger:async()=>({success:true,data:JSON.parse(JSON.stringify(ledger))}),setResearchWatch:async(symbol,watched)=>{calls.push(['setResearchWatch',symbol,watched]);ledger.watchedSymbols=watched?[...ledger.watchedSymbols,symbol]:ledger.watchedSymbols.filter(s=>s!==symbol);return{success:true};},createResearchAlert:async input=>{calls.push(['createResearchAlert',input]);ledger.alerts.push({...input,id:'alert-'+(ledger.alerts.length+1),status:'armed',createdAt:now,armedAt:now,baseline:null,triggeredAt:null,triggerSample:null});return{success:true};},removeResearchAlert:async id=>{ledger.alerts=ledger.alerts.filter(a=>a.id!==id);return{success:true};},
      analyzeResearch:async input=>{calls.push(['analyzeResearch',input]);if(state.failAI)return{success:false,error:'模型输出未通过校验；未生成判断。'};const e=events.find(e=>e.id===input.eventId);const data={version:'research-ai-v1',snapshotId:input.snapshotId,eventId:e.id,symbol:e.symbol,status:'observation',summary:'证据不足，暂不判断。合成测试结果。',supportFactIds:[],counterFactIds:[],triggerConditionIds:[],invalidationConditionIds:[],facts:facts(e.symbol),conditions:evidence(e.symbol).conditions,gaps:['流动性未知'],provider:'synthetic',model:'explicit-test-model',analyzedAt:now,expiresAt:now+600000,toolTrace:[],modelCalls:1,usage:null,cost:null};ledger.records.push({id:'record-1',recordedAt:now,judgment:{eventId:e.id,snapshotId:input.snapshotId,symbol:e.symbol,ruleVersion:'synthetic-v1',provider:'synthetic',model:'explicit-test-model',decidedAt:now,decision:'abstain',direction:'neutral',summary:data.summary,facts:data.facts,conditions:[],invalidation:[],gaps:data.gaps},observations:[],omittedObservations:0});return{success:true,data};},
      registerResearchShadow:async input=>result('registerResearchShadow',input),checkForUpdates:async()=>({state:'current',currentVersion:'0.2.1',latestVersion:'0.2.1',message:'已是最新版本'})
    };
    window.electronAPI=api;window.__qa=state;window.__calls=calls;
  },options);
}

module.exports = { fixture };
if (require.main === module) (async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({configFile:path.join(repository,'vite.config.ts'),root:path.join(repository,'src/renderer'),server:{host:'127.0.0.1',port:0}});
 await server.listen();
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 let browser; const errors=[]; const results=[];
 async function open(options={},width=1180,height=760){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  page.on('pageerror',e=>errors.push(e.message));
  await fixture(page,options);await page.goto(origin+(options.mode==='popup'?'':'?mode=workspace'));
  await page.locator(options.mode==='popup'?'.popup-dashboard':'.workspace-shell').waitFor();
  if(options.mode!=='popup')await page.locator('.event-row, .research-empty').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.app.light-mode')||document.querySelector('.app:not(.light-mode)'));
  return page;
 }
 async function capture(page,name){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' page overflow');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))})));
  await page.screenshot({path:path.join(screenshots,name+'.png')});
  if (process.env.POSITIONSCOPE_VISUAL_REVIEW === '1' && ['01-research-evidence','05-popup','14-matrix','03-positions'].includes(name)) {
    // Only this isolated fixture is rendered; external requests are blocked above.
    // Keep two actual renders available for review alongside the artifact images.
    console.log(`POSITIONSCOPE_SYNTHETIC_RENDER:${name}:${(await page.screenshot({type:'jpeg',quality:65})).toString('base64')}`);
  }
  assert.deepEqual(violations,[],name+' accessibility');
 }
 try{
  browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}: {})});
  const p=await open();await p.locator('.event-row').first().waitFor();
  assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='analyzeResearch').length),0,'no automatic AI calls');
  await p.locator('[data-event-row="0"]').focus();await p.keyboard.press('ArrowDown');
  assert.equal(await p.locator('[data-event-row="1"]').getAttribute('aria-pressed'),'true');
  await p.getByRole('button',{name:'异常矩阵视图',exact:true}).click();assert.equal(await p.locator('.event-matrix .event-row').count(),3);
  assert(await p.locator('.evidence-header').getByText('ETHUSDT · 只读研究').isVisible());
  await capture(p,'14-matrix');
  assert(await p.locator('.event-matrix .event-row').evaluateAll(rows=>rows.every(r=>r.scrollWidth<=r.clientWidth+1)), 'matrix cards contain their contents');
  await p.getByRole('button',{name:'列表视图',exact:true}).click();
  await p.getByRole('button',{name:'关注',exact:true}).click();await p.getByRole('button',{name:'已关注',exact:true}).last().waitFor();
  await p.getByRole('button',{name:'条件提醒',exact:true}).click();await p.getByRole('dialog').waitFor();
  await p.getByRole('textbox',{name:'提醒阈值',exact:true}).fill('3500');await p.getByRole('button',{name:'保存条件提醒',exact:true}).click();
  assert.equal(await p.evaluate(()=>window.__calls.find(c=>c[0]==='createResearchAlert')[1].threshold),3500);
  await p.locator('.saved-alert').getByText('成交价 ↑ 3,500 USDT · 等待穿越',{exact:true}).waitFor();
  await p.getByRole('button',{name:'条件提醒',exact:true}).click();await p.getByRole('combobox',{name:'观察指标',exact:true}).click();await p.getByRole('option',{name:'资金费率 · %',exact:true}).click();
  await p.getByRole('textbox',{name:'提醒阈值',exact:true}).fill('0.10');await p.getByRole('button',{name:'保存条件提醒',exact:true}).click();
  assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c[0]==='createResearchAlert').at(-1)[1].threshold),0.001,'funding percent input stores raw ratio');
  await p.locator('.saved-alert').getByText('资金费率 ↑ 0.10% · 等待穿越',{exact:true}).waitFor();
  await capture(p,'01-research-evidence');
  await p.evaluate(()=>window.__qa.failAI=true);await p.getByRole('button',{name:'AI 查证 · 最多两次调用',exact:true}).click();await p.getByRole('alert').filter({hasText:'未通过校验'}).waitFor();
  await p.evaluate(()=>window.__qa.failAI=false);await p.getByRole('button',{name:'AI 查证 · 最多两次调用',exact:true}).click();await p.getByText('证据不足，暂不判断。合成测试结果。',{exact:true}).waitFor();
  assert.deepEqual(await p.evaluate(()=>Object.keys(window.__calls.find(c=>c[0]==='analyzeResearch')[1]).sort()),['eventId','snapshotId'],'AI IPC excludes accounts/positions/credentials');
  await p.evaluate(()=>window.__qa.advanceSnapshot());await p.getByRole('button',{name:'刷新扫描',exact:true}).click();await p.getByText('上次 AI 查证已过期或证据已更新，请基于当前快照重新查证。',{exact:true}).waitFor();assert.equal(await p.getByText('证据不足，暂不判断。合成测试结果。',{exact:true}).count(),0,'old AI must disappear after a new snapshot');
  await p.evaluate(()=>window.__qa.staleEvidence=true);await p.locator('[data-event-row="0"]').click();await p.getByRole('alert').filter({hasText:'证据与当前研究快照不匹配'}).waitFor();
  await p.evaluate(()=>{window.__qa.staleEvidence=false;window.__qa.holdEvidence=true;});await p.locator('[data-event-row="0"]').click();await p.waitForFunction(()=>typeof window.__qa.releaseEvidence==='function');await p.locator('[data-event-row="2"]').click();await p.evaluate(()=>window.__qa.releaseEvidence());assert(await p.locator('.evidence-header').getByText('SOLUSDT · 只读研究').isVisible());
  await p.getByRole('button',{name:'复盘',exact:true}).click();await p.getByRole('button',{name:'研究记录',exact:true}).click();await p.getByText('研究复盘',{exact:true}).waitFor();await capture(p,'02-review');
  assert(await p.getByText('净收益 / 胜率',{exact:true}).isVisible());assert(await p.getByRole('button',{name:'创建价格观察',exact:true}).isDisabled());
  await p.getByRole('button',{name:'持仓',exact:true}).click();await p.getByRole('heading',{name:'我的持仓',exact:true}).waitFor();await capture(p,'03-positions');
  await p.getByRole('button',{name:'隐藏金额',exact:true}).click();assert.equal(await p.locator('.positions-table-row .positive,.positions-table-row .negative').count(),0);
  await p.getByRole('button',{name:'设置',exact:true}).click();await p.getByRole('button',{name:'Binance 连接',exact:true}).click();
  await p.getByLabel('API Key',{exact:true}).fill('synthetic-draft-preserved');await p.evaluate(()=>window.__qa.failSave=true);await p.getByRole('button',{name:'保存配置',exact:true}).click();await p.getByRole('alert').filter({hasText:'合成保存失败'}).waitFor();assert.equal(await p.getByLabel('API Key',{exact:true}).inputValue(),'synthetic-draft-preserved');await capture(p,'04-settings-failed-save');
  await p.getByRole('button',{name:'研究',exact:true}).click();await p.evaluate(()=>window.__qa.failScan=true);await p.getByRole('button',{name:'刷新扫描',exact:true}).click();await p.getByRole('alert').filter({hasText:'保留上次快照'}).waitFor();assert.equal(await p.locator('.event-row').count(),3);await p.close();
  results.push('workspace list/matrix/keyboard/selection, independent follow/alerts, AI validation/no private payload, frozen review, positions privacy, failed-save draft, failed-refresh snapshot retention');
  const popup=await open({mode:'popup'},480,600);await popup.locator('.compact-position').first().waitFor();assert.equal(await popup.locator('.compact-position').count(),3);const density=await popup.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},elements:Object.fromEntries(['.popup-dashboard','.popup-header','.popup-summary','.popup-holdings','.compact-position-head','.compact-positions','.compact-position','.popup-references','.reference-grid','.popup-footer'].map(selector=>{const e=document.querySelector(selector);const r=e.getBoundingClientRect();const css=getComputedStyle(e);return[selector,{top:r.top,bottom:r.bottom,height:r.height,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,paddingTop:css.paddingTop,paddingBottom:css.paddingBottom,lineHeight:css.lineHeight}];}))}));fs.writeFileSync(path.join(screenshots,'05-popup-layout.json'),JSON.stringify(density,null,2));await capture(popup,'05-popup');assert.equal(density.elements['.compact-positions'].scrollHeight<=density.elements['.compact-positions'].clientHeight+1,true,'three positions fit first screen: '+JSON.stringify(density));await popup.evaluate(()=>window.__qa.researchAlert([{id:'alert-test',symbol:'BTCUSDT',metric:'price',threshold:60000,triggeredAt:Date.now()}]));await popup.getByRole('button',{name:'通知中心，1 条未读',exact:true}).click();await popup.getByText('BTCUSDT · 条件触发',{exact:true}).waitFor();await popup.getByText('查看复盘',{exact:true}).click();assert(await popup.evaluate(()=>window.__calls.some(c=>c[0]==='openWorkspace'&&c[1]==='review')),'triggered alert opens review');await popup.getByRole('button',{name:'隐藏金额',exact:true}).click();assert.equal(await popup.locator('.popup-pnl.positive,.popup-pnl.negative,.compact-position .positive,.compact-position .negative').count(),0);await capture(popup,'06-popup-private');await popup.evaluate(()=>window.__qa.dataDeleted());await popup.getByText('连接 Binance，开始只读监控',{exact:true}).waitFor();assert.equal(await popup.locator('.compact-position').count(),0,'cross-window data clear removes private rows');await popup.close();
  const offline=await open({mode:'popup',failure:true},480,600);await offline.getByText('持仓暂不可用',{exact:true}).waitFor();assert.equal(await offline.locator('.popup-pnl').innerText(),'—');await capture(offline,'07-popup-unavailable');await offline.close();
  const blocked=await open({mode:'popup',blocked:true},480,600);await blocked.getByText('配置未能安全读取',{exact:true}).waitFor();assert.equal(await blocked.locator('.popup-pnl').innerText(),'—');await capture(blocked,'08-storage-blocked');await blocked.close();
  const empty=await open({empty:true});await empty.getByText('没有符合条件的事件',{exact:true}).waitFor();await capture(empty,'09-research-empty');await empty.close();
  const stale=await open({expired:true});await stale.getByText('快照已过期',{exact:true}).waitFor();assert(await stale.getByRole('button',{name:'AI 查证 · 最多两次调用',exact:true}).isDisabled());await capture(stale,'10-expired');await stale.close();
  const matrix=await open({},960,640);await matrix.getByRole('button',{name:'异常矩阵视图',exact:true}).click();await matrix.locator('.event-row').first().waitFor();
  await matrix.locator('.event-main strong').first().evaluate(e=>{e.textContent='非常长的合约名称ABCDEFGHIJKLMN';});
  assert(await matrix.locator('.event-matrix .event-row').evaluateAll(rows=>rows.every(r=>r.scrollWidth<=r.clientWidth+1)), 'narrow long-symbol cards contain contents');await capture(matrix,'15-matrix-narrow');
  await matrix.getByRole('button',{name:'退出 PositionScope',exact:true}).click();assert(await matrix.evaluate(()=>window.__calls.some(c=>c[0]==='quitApp')));await matrix.close();
  const isolated=await open({isolated:true});await isolated.getByRole('button',{name:'持仓',exact:true}).click();
  const wallet=isolated.locator('[data-wallet]').first(), margin=isolated.locator('[data-margin]').first();
  assert.equal(await wallet.innerText(),'-12.50');assert.equal(await margin.innerText(),'18.75');
  assert.equal(await isolated.locator('.position-detail').count(),0);
  await capture(isolated,'13-isolated-wallet');await isolated.getByRole('button',{name:'隐藏金额',exact:true}).click();assert.equal(await wallet.innerText(),'••••••');assert.equal(await margin.innerText(),'••••••');await isolated.close();
  const dark=await open({dark:true,reversed:true});await capture(dark,'11-dark');await dark.close();
  const small=await open({},700,760);await capture(small,'12-narrow');await small.close();
  results.push('480x600 three-position density, hidden amounts neutral colors, unknown not zero, blocked encrypted store, empty/expired, light/dark, narrow layout, axe all new pages');
  assert.deepEqual(errors,[],'renderer exceptions');console.log(JSON.stringify({results,errors,screenshots},null,2));
 }finally{await browser?.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
