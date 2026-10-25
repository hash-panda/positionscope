import axios, { AxiosInstance } from 'axios';
import type { AssetContext, MarketRow, MarketSnapshot, FundingScenario } from '../types/market';
import type { Position } from '../types/exchange';
import { numeric, optionalNumber, positionNotional } from '../utils/position-math';
const HOUR = 3_600_000;
const PATHS = new Set(['/fapi/v1/exchangeInfo','/fapi/v1/ticker/24hr','/fapi/v1/premiumIndex','/fapi/v1/fundingInfo','/fapi/v1/fundingRate','/fapi/v1/openInterest','/fapi/v1/klines']);
const positive = (v: unknown) => { const n = numeric(v); if (n <= 0) throw new Error('公开市场价格无效'); return n; };
const time = (v: unknown) => { const n = positive(v); if (!Number.isSafeInteger(n)) throw new Error('市场时间无效'); return n; };
const sourceURL = (path: string) => `https://fapi.binance.com${path}`;

export function priceHistory(rows: unknown, now: number): AssetContext['history'] {
  if (!Array.isArray(rows)) throw new Error('K线格式无效');
  const closed = rows.filter(r => Array.isArray(r) && numeric(r[6]) < now).map(r => ({open: time(r[0]), close: time(r[6]), price: positive(r[4])}));
  if (closed.length < 25 || closed.length > 200) throw new Error('已收盘小时K线不足25或超限');
  for (let i=0; i<closed.length; i++) {
    if (closed[i].close - closed[i].open !== HOUR-1 || (i && closed[i].open - closed[i-1].open !== HOUR)) throw new Error('小时K线间隔不连续');
  }
  if (now - closed[closed.length-1].close > 2*HOUR) throw new Error('小时K线已过期');
  let peak=closed[0].price, maxDrawdown=0;
  const returns: number[]=[];
  for (let i=0; i<closed.length; i++) {
    peak=Math.max(peak,closed[i].price); maxDrawdown=Math.max(maxDrawdown,1-closed[i].price/peak);
    if(i) returns.push(Math.log(closed[i].price/closed[i-1].price));
  }
  const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
  const variance=returns.reduce((sum,r)=>sum+(r-mean)**2,0)/(returns.length-1);
  const volatility=Math.sqrt(variance*365*24), change=closed[closed.length-1].price/closed[0].price-1;
  if (![volatility,change,maxDrawdown].every(Number.isFinite)) throw new Error('价格历史计算超限');
  return {interval:'1h',samples:closed.length,start:closed[0].close,end:closed[closed.length-1].close,priceChange:change,maxDrawdown,annualizedPriceVolatility:volatility};
}
export function fundingScenarios(positions: Position[], market?: MarketSnapshot): FundingScenario[] {
  if (!market || market.status==='unavailable') return [];
  const result: FundingScenario[]=[];
  for (const p of positions) {
    // A Binance quote must never become another venue's funding obligation.
    if (p.exchange!=='binance' || (p.instrumentId || p.symbol)!==p.symbol) continue;
    const a=market.assets.find(a=>a.symbol===p.symbol);
    if (!a?.mark || a.mark.nextFundingAt<=Date.now() || Date.now()-a.fetchedAt>180_000) continue;
    const signedNotional=positionNotional(p)*(numeric(p.positionAmt)>0?1:-1);
    for (const retainedShare of [1,.75,.5]) {
      const estimatedCashflow=-signedNotional*retainedShare*a.mark.lastFundingRate;
      if(Number.isFinite(estimatedCashflow))result.push({exchange:p.exchange,symbol:p.symbol,referenceRate:a.mark.lastFundingRate,nextFundingAt:a.mark.nextFundingAt,retainedShare,estimatedCashflow});
    }
  }
  return result;
}
export class PublicMarketService {
  private client: AxiosInstance;
  private proxy = '';
  private blockedUntil = 0;
  private requestDeadline = 0;
  private cache: {key:string; data:MarketSnapshot} | null = null;
  private inFlight: Promise<MarketSnapshot> | null = null;
  private specs: {at:number; rows:any[]} | null = null;
  constructor() { this.client=axios.create({baseURL:'https://fapi.binance.com',timeout:8000}); }
  setProxy(value: string) {
    if(this.proxy===value)return;
    let proxy: any=false;
    if(value) {const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw new Error('代理协议不支持');proxy={host:u.hostname,port:Number(u.port)|| (u.protocol==='https:'?443:80),protocol:u.protocol.slice(0,-1),...(u.username?{auth:{username:decodeURIComponent(u.username),password:decodeURIComponent(u.password)}}:{})};}
    this.client=axios.create({baseURL:'https://fapi.binance.com',timeout:8000,proxy});this.proxy=value;this.cache=null;this.specs=null;
  }
  private async read(path:string, params:Record<string,string|number>={}) {
    if(this.requestDeadline && Date.now() >= this.requestDeadline)throw new Error('本次公共市场读取预算已用完');
    if(!PATHS.has(path))throw new Error('公开只读接口不在允许范围');
    if(Date.now()<this.blockedUntil)throw new Error('市场接口限流冷却中');
    try {return (await this.client.get(path,{params})).data;}
    catch(error:any) {
      const status=error.response?.status;
      if(status===429||status===418) {
        const raw=error.response?.headers?.['retry-after']; const seconds=Number(raw);
        const retry=Number.isFinite(seconds)&&seconds>0?seconds*1000:Math.max(0,Date.parse(raw)-Date.now());
        this.blockedUntil=Date.now()+Math.max(status===418?600_000:60_000,Number.isFinite(retry)?Math.min(retry,86_400_000):0);
      }
      // No Axios config, request query, proxy credentials or response payload escapes.
      throw new Error(status===429||status===418?'市场接口限流，请稍后刷新':'公共市场请求不可用');
    }
  }
  async snapshot(requested: string[]): Promise<MarketSnapshot> {
    if(!Array.isArray(requested)||requested.length>500||requested.some(s=>typeof s!=='string'||! /^[A-Z0-9]{1,40}USDT$/.test(s)))throw new Error('市场交易对格式无效');
    const unique=[...new Set(['BTCUSDT','ETHUSDT',...requested])];
    const symbols=unique.slice(0,12).sort();
    const key=symbols.join(',')+'|omitted:'+Math.max(0,unique.length-12);
    if(this.cache?.key===key&&Date.now()-this.cache.data.fetchedAt<60_000)return this.cache.data;
    // Do not create concurrent bursts; callers can retry their own symbol set after this request.
    if(this.inFlight) {await this.inFlight;return this.snapshot(requested);}
    this.inFlight=this.collect(symbols,unique.length>12);
    try {const data=await this.inFlight;this.cache={key,data};return data;} finally {this.inFlight=null;}
  }
  private async collect(symbols:string[],truncated:boolean):Promise<MarketSnapshot> {
    const fetchedAt=Date.now(); this.requestDeadline=fetchedAt+45_000;
    const data:MarketSnapshot={version:'market-context-v1',source:'Binance USD-M public REST',fetchedAt,status:'unavailable',breadth:null,active:[],recentListings:[],assets:[],unavailableSymbols:[],
      notes:['范围为Binance在交易的USDT永续合约，不代表整个加密市场或现货。','成交额不等于盘口流动性；新上市仅指该平台合约上线，不等于项目早期价值。','价格波动率与回撤只基于最近已收盘小时价格，不是账户收益、胜率或未来预测。','资金费lastFundingRate为接口参考值；下一次实际结算费率和持有时长未知，不能外推全年收益。',...(truncated?['本次最多研究BTC/ETH及10个其他标的，部分持仓未覆盖。']:[])],sources:[...PATHS].map(sourceURL)};
    let instruments:any[];
    try {
      if(this.specs&&Date.now()-this.specs.at<900_000)instruments=this.specs.rows;
      else {const info=await this.read('/fapi/v1/exchangeInfo');if(!Array.isArray(info.symbols))throw new Error();instruments=info.symbols;this.specs={at:Date.now(),rows:instruments};}
      instruments=instruments.filter(s=>s.status==='TRADING'&&s.contractType==='PERPETUAL'&&s.quoteAsset==='USDT'&&s.marginAsset==='USDT'&&typeof s.baseAsset==='string'&&/^[A-Z0-9]{1,40}$/.test(s.baseAsset)&&/^[A-Z0-9]{1,40}USDT$/.test(s.symbol));
      const bySymbol=new Map(instruments.map(s=>[s.symbol,s]));
      const ticker=await this.read('/fapi/v1/ticker/24hr');if(!Array.isArray(ticker))throw new Error();
      const rows:MarketRow[]=[];
      for(const t of ticker) {
        const s=bySymbol.get(t.symbol);if(!s)continue;
        try {const close=time(t.closeTime),vol=numeric(t.quoteVolume),change=numeric(t.priceChangePercent)/100;
          if(Date.now()-close>180_000||close>Date.now()+60_000||vol<0)continue;
          rows.push({symbol:t.symbol,baseAsset:s.baseAsset,lastPrice:positive(t.lastPrice),change24h:change,quoteVolume24h:vol,onboardAt:optionalNumber(s.onboardDate),exchangeTimestamp:close,fetchedAt:Date.now()});
        }catch{/* Invalid rows are excluded and coverage remains explicit. */}
      }
      if(!rows.length)throw new Error();
      const changes=rows.map(r=>r.change24h).sort((a,b)=>a-b),mid=Math.floor(changes.length/2);
      const volume=rows.reduce((sum,r)=>sum+r.quoteVolume24h,0);if(!Number.isFinite(volume))throw new Error();
      data.breadth={eligibleContracts:instruments.length,pricedContracts:rows.length,rising:rows.filter(r=>r.change24h>0).length,falling:rows.filter(r=>r.change24h<0).length,flat:rows.filter(r=>r.change24h===0).length,medianChange24h:changes.length%2?changes[mid]:(changes[mid-1]+changes[mid])/2,quoteVolume24h:volume};
      data.active=[...rows].sort((a,b)=>b.quoteVolume24h-a.quoteVolume24h).slice(0,5);
      data.recentListings=rows.filter(r=>r.onboardAt!==null&&r.onboardAt<=fetchedAt&&fetchedAt-r.onboardAt<=30*24*HOUR).sort((a,b)=>b.onboardAt!-a.onboardAt!).slice(0,5);
      const fundingInfo=await this.read('/fapi/v1/fundingInfo').catch(()=>null);
      let next=0;
      const results:AssetContext[]=[];
      await Promise.all(Array.from({length:3},async()=>{
        while(next<symbols.length){const symbol=symbols[next++],spec=bySymbol.get(symbol);if(!spec){data.unavailableSymbols.push(symbol);continue;}
          const asset:AssetContext={symbol,baseAsset:spec.baseAsset,fetchedAt:Date.now(),mark:null,funding:null,openInterest:null,history:null,gaps:[]};
          // One worker makes at most four requests sequentially; at most three requests are in flight.
          try {const m=await this.read('/fapi/v1/premiumIndex',{symbol});const t=time(m.time);
            if(m.symbol!==symbol||Date.now()-t>180_000||t>Date.now()+60_000)throw new Error();
            asset.mark={price:positive(m.markPrice),lastFundingRate:numeric(m.lastFundingRate),nextFundingAt:time(m.nextFundingTime),exchangeTimestamp:t};
          }catch{asset.gaps.push('标记价/资金费参考不可用或过期');}
          try {const f=await this.read('/fapi/v1/fundingRate',{symbol,limit:3});if(!Array.isArray(f)||!f.length||f.some(r=>r.symbol!==symbol))throw new Error();
            f.sort((a,b)=>time(a.fundingTime)-time(b.fundingTime));const last=f[f.length-1];
            const announced=Array.isArray(fundingInfo)?fundingInfo.find(r=>r.symbol===symbol):null;
            let intervalHours=optionalNumber(announced?.fundingIntervalHours),basis:'announced'|'observed'|'unknown'=intervalHours!==null?'announced':'unknown';
            if(intervalHours===null&&f.length===3){const delta=time(f[2].fundingTime)-time(f[1].fundingTime);if(delta>0&&delta===time(f[1].fundingTime)-time(f[0].fundingTime)){intervalHours=delta/HOUR;basis='observed';}}
            if(intervalHours!==null&&(intervalHours<=0||intervalHours>24))throw new Error();
            const settled=time(last.fundingTime);if(settled>Date.now()+60_000||Date.now()-settled>48*HOUR)throw new Error();
            asset.funding={intervalHours,intervalBasis:basis,lastSettledRate:numeric(last.fundingRate),lastSettledAt:settled};
          }catch{asset.gaps.push('资金费历史/间隔不可用');}
          try {const oi=await this.read('/fapi/v1/openInterest',{symbol});const quantity=numeric(oi.openInterest),t=time(oi.time);if(oi.symbol!==symbol||quantity<0||Date.now()-t>180_000||t>Date.now()+60_000)throw new Error();asset.openInterest={baseQuantity:quantity,exchangeTimestamp:t};}catch{asset.gaps.push('未平仓量不可用或过期');}
          try {asset.history=priceHistory(await this.read('/fapi/v1/klines',{symbol,interval:'1h',limit:200}),Date.now());}catch{asset.gaps.push('连续已收盘价格历史不可用');}
          results.push(asset);
        }
      }));
      data.assets=results.sort((a,b)=>a.symbol.localeCompare(b.symbol));
      if(Date.now()>=this.requestDeadline)data.notes.push('本次45秒请求预算已用完，部分来源缺失；未使用推测值。');
      data.status=rows.length===instruments.length&&!data.unavailableSymbols.length&&results.every(a=>!a.gaps.length)?'available':'partial';
    }catch{data.notes.push('公开行情未完整获取；未使用旧数据或虚构零值。');}
    this.requestDeadline=0;
    return data;
  }
}
export const publicMarketService=new PublicMarketService();
