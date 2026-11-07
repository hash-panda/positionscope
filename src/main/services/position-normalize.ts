import { ExchangeType, Position } from '../types/exchange';
import { nonnegative, numeric, optionalNumber } from '../utils/position-math';
import { binanceUsdtBaseAsset } from '../utils/binance-symbol';
import { BinanceDataError, PositionField } from '../utils/binance-diagnostics';
type RecordData = Record<string, any>;
const text = (value: number | null) => value===null?null:String(value);
const positiveOptional=(value:unknown)=>{const n=optionalNumber(value);return n!==null&&n>0?String(n):null;};
const timestamp=(value:unknown)=>{const n=optionalNumber(value);return n!==null&&n>0&&Number.isSafeInteger(n)?n:null;};
function core(exchange:ExchangeType,p:RecordData,quantity:number,mark:unknown,entry:unknown,pnl:unknown):Position {
 if(!Number.isFinite(quantity)||!quantity||numeric(mark)<=0||numeric(entry)<=0)throw new Error('持仓数量或价格无效');
 numeric(pnl,'未实现盈亏');
 return {exchange,symbol:p.symbol,positionAmt:String(quantity),markPrice:String(mark),entryPrice:String(entry),unRealizedProfit:String(pnl),marginType:'unknown',isolatedMargin:null,leverage:null,fetchedAt:Date.now(),sourceUpdatedAt:null,priceSource:'exchange_mark'};
}
function checked<T>(field: PositionField, read:()=>T):T {
 try { return read(); } catch { throw new BinanceDataError('BINANCE_INVALID_POSITION', field); }
}
export function binancePositionQuantity(p:RecordData):number {
 return checked('positionAmt',()=>numeric(p?.positionAmt));
}
export function normalizeBinancePosition(p:RecordData,config:RecordData|undefined):Position {
 if(!p||typeof p!=='object'||Array.isArray(p))throw new BinanceDataError('BINANCE_INVALID_POSITION');
 const baseAsset=binanceUsdtBaseAsset(p.symbol);
 if(!baseAsset||p.marginAsset!=='USDT')throw new BinanceDataError('BINANCE_UNSUPPORTED_INSTRUMENT');
 const mode=config?.marginType;
 if(config!==undefined&&(!config||typeof config!=='object'||Array.isArray(config)||!['CROSSED','ISOLATED'].includes(mode)))throw new BinanceDataError('BINANCE_INVALID_CONFIG');
 let leverage: string | null;
 try {leverage=positiveOptional(config?.leverage);}catch{throw new BinanceDataError('BINANCE_INVALID_CONFIG');}
 try {
 const quantity=binancePositionQuantity(p),side=p.positionSide;
 if(!['BOTH','LONG','SHORT'].includes(side)||(side==='LONG'&&quantity<0)||(side==='SHORT'&&quantity>0))throw new BinanceDataError('BINANCE_INVALID_POSITION','positionSide');
 for(const field of ['markPrice','entryPrice'] as const) checked(field,()=>{if(numeric(p[field])<=0)throw new Error();});
 checked('unRealizedProfit',()=>numeric(p.unRealizedProfit));
 if(!quantity)throw new BinanceDataError('BINANCE_INVALID_POSITION','positionAmt');
 const result=core(ExchangeType.BINANCE,p,quantity,p.markPrice,p.entryPrice,p.unRealizedProfit);
 return {...result,instrumentId:p.symbol,positionId:`${p.symbol}:${side}`,positionSide:side,baseAsset,settlementAsset:'USDT',rawQuantity:String(p.positionAmt),rawQuantityUnit:'base',marginType:mode==='CROSSED'?'cross':mode==='ISOLATED'?'isolated':'unknown',leverage,isolatedMargin:mode==='ISOLATED'?text(checked('isolatedWallet',()=>nonnegative(p.isolatedWallet))):null,liquidationPrice:checked('liquidationPrice',()=>positiveOptional(p.liquidationPrice)),initialMargin:text(checked('positionInitialMargin',()=>nonnegative(p.positionInitialMargin))),maintenanceMargin:text(checked('maintMargin',()=>nonnegative(p.maintMargin))),marginCurrency:p.marginAsset,sourceUpdatedAt:checked('updateTime',()=>timestamp(p.updateTime))};
 }catch(error){if(error instanceof BinanceDataError)throw error;throw new BinanceDataError('BINANCE_INVALID_POSITION');}
}
export function bybitMode(info:RecordData):Position['marginType'] {
 if(![3,4,5,6].includes(info.unifiedMarginStatus))throw new Error('Bybit当前只支持已确认的UNIFIED账户');
 const mode:Record<string,Position['marginType']>={REGULAR_MARGIN:'cross',ISOLATED_MARGIN:'isolated',PORTFOLIO_MARGIN:'portfolio'};
 if(!mode[info.marginMode])throw new Error('Bybit账户保证金模式未知');
 return mode[info.marginMode];
}
export function normalizeBybitPosition(p:RecordData,mode:Position['marginType']):Position {
 const match=typeof p.symbol==='string'&&p.symbol.match(/^([A-Z0-9]{1,40})USDT$/);
 if(!match||![0,1,2].includes(p.positionIdx)||!['Buy','Sell'].includes(p.side)||numeric(p.size)<=0)throw new Error('Bybit持仓单位或方向无效');
 const quantity=numeric(p.size)*(p.side==='Sell'?-1:1);
 const result=core(ExchangeType.BYBIT,p,quantity,p.markPrice,p.avgPrice,p.unrealisedPnl);
 return {...result,instrumentId:p.symbol,positionId:`${p.symbol}:${p.positionIdx}`,positionSide:p.side,baseAsset:match[1],settlementAsset:'USDT',rawQuantity:String(p.size),rawQuantityUnit:'base',marginType:mode,leverage:mode==='portfolio'?null:positiveOptional(p.leverage),liquidationPrice:mode==='portfolio'?null:positiveOptional(p.liqPrice),initialMargin:mode==='portfolio'?null:text(nonnegative(p.positionIM)),maintenanceMargin:mode==='portfolio'?null:text(nonnegative(p.positionMM)),marginCurrency:'USDT',sourceUpdatedAt:timestamp(p.updatedTime)};
}
export function normalizeOKXPosition(p:RecordData,instrument:RecordData|undefined):Position {
 if(!instrument||instrument.ctType!=='linear'||instrument.settleCcy!=='USDT'||typeof instrument.ctValCcy!=='string'||! /^[A-Z0-9]{1,40}$/.test(instrument.ctValCcy)||numeric(instrument.ctVal)<=0)throw new Error('OKX合约规格缺失或不属于已支持的USDT线性合约');
 if(!['long','short','net'].includes(p.posSide)||!['cross','isolated'].includes(p.mgnMode))throw new Error('OKX持仓方向或保证金模式未知');
 const raw=numeric(p.pos),contracts=p.posSide==='short'?-Math.abs(raw):p.posSide==='long'?Math.abs(raw):raw;
 const quantity=contracts*numeric(instrument.ctVal);
 const result=core(ExchangeType.OKX,{symbol:`${instrument.ctValCcy}USDT`},quantity,p.markPx,p.avgPx,p.upl);
 return {...result,instrumentId:p.instId,positionId:String(p.posId||`${p.instId}:${p.posSide}:${p.mgnMode}`),positionSide:p.posSide,baseAsset:instrument.ctValCcy,settlementAsset:'USDT',rawQuantity:String(contracts),rawQuantityUnit:'contracts',marginType:p.mgnMode,leverage:positiveOptional(p.lever),isolatedMargin:p.mgnMode==='isolated'?text(nonnegative(p.margin)):null,liquidationPrice:positiveOptional(p.liqPx),initialMargin:text(nonnegative(p.imr)),maintenanceMargin:text(nonnegative(p.mmr)),marginCurrency:p.ccy||'USDT',sourceUpdatedAt:timestamp(p.uTime)};
}
