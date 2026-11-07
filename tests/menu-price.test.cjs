const {test}=require('node:test');const assert=require('node:assert/strict');
const {MenuPriceHistory,menuPriceLabel}=require('../dist/main/utils/menu-price');
const {priceText,entryPriceChange}=require('../dist/main/utils/menu-format');
const p=(price,at=1000)=>({exchange:'binance',symbol:'BTCUSDT',markPrice:String(price),entryPrice:'100',positionAmt:'-1',fetchedAt:at});
test('price precision never rounds small positive quotes to zero; entry percent is not short ROI',()=>{
 assert.equal(priceText(75988.4),'75,988.40');assert.equal(priceText(.0000000123),'1.23e-8');assert.equal(priceText(NaN),'—');
 assert.equal(priceText(1.23456),'1.235');assert.equal(priceText(.123456),'.1235'.replace(/^\./,'0.'));
 assert(Math.abs(entryPriceChange(p(110))-10)<1e-10);assert.equal(entryPriceChange({...p(110),entryPrice:'0'}),null);
 assert.equal(menuPriceLabel(p(110),-1,false),'BTC 110.00 ↓');assert.equal(menuPriceLabel(p(110),1,true),'BTC ••••');
});
test('quote direction ignores duplicate reads and resets across stale gaps, deletion and missing timestamps',()=>{
 const h=new MenuPriceHistory(),read=(x,now=x.fetchedAt)=>h.observe([x],now,15000).get('binance:BTCUSDT');
 assert.equal(read(p(100)),0);assert.equal(read(p(101,2000)),1);assert.equal(read(p(101,2000)),1);
 assert.equal(read(p(99,3000)),-1);assert.equal(read(p(100,2500),3000),0);assert.equal(read(p(99,4000)),0);
 assert.equal(read(p(200,30000)),0);h.clear();assert.equal(read(p(210,31000)),0);
 assert.equal(read(p(211,undefined),50000),0);h.observe([],51000,15000);assert.equal(read(p(212,52000)),0);
});
