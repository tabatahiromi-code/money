import assert from 'node:assert/strict';
import {summary,validData} from './dist/model.mjs';
import {isCardDetail,cardHistory} from './dist/accounting-model.mjs';
const entry=(id,date,amount,extra={})=>({id,date,amount,type:'expense',category:'食費',note:id,...extra});
const entries=[entry('cash','2026-10-18',100),entry('card','2026-10-19',500,{recordKind:'card_detail'}),entry('legacy-ofx','2026-10-20',600,{ofxKey:JSON.stringify(['カード','bank','account','JPY','fitid'])}),entry('csv-card','2026-10-21',700,{source:'メインカード'}),entry('payment','2026-11-10',1800,{source:'銀行',recordKind:'cash_flow'}),entry('refund','2026-10-22',30,{type:'income',category:'その他',recordKind:'card_detail'}),entry('earlier','2026-10-01',80,{recordKind:'card_detail'})];
const settings={closingDay:15,cardSources:['メインカード']},data={version:1,entries,budgets:{},settings};
assert.ok(validData(data));const s=summary(entries,'2026-11',15,settings);assert.equal(s.expense,1900);assert.equal(s.income,0);assert.equal(s.balance,-1900);assert.deepEqual(s.rows.map(e=>e.id),['cash','payment']);assert.equal(s.cardRows.length,4);
assert.deepEqual(cardHistory(entries,'2026-10',settings).map(e=>e.id),['refund','csv-card','legacy-ofx','card','earlier']);assert.equal(cardHistory(entries,'2026-11',settings).length,0);assert.ok(isCardDetail(entries[2]));assert.ok(!isCardDetail(entries[4],settings));assert.ok(validData(JSON.parse(JSON.stringify(data))));assert.ok(validData({version:1,entries:entries.slice(0,1),budgets:{}}));assert.ok(!validData({...data,settings:{cardSources:'card'}}));assert.ok(!validData({...data,entries:[{...entries[0],recordKind:'invalid'}]}));assert.throws(()=>cardHistory(entries,'2026-13'));
console.log('カード明細：既存OFX・CSV/PDF分類、収支/予算の計算対象除外、利用月一覧、返金、バックアップ互換性を確認しました');
