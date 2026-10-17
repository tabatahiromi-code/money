import assert from 'node:assert/strict';
import {periodForMonth,periodMonthForDate,shiftMonth,closingDayOf,validClosingDay} from './dist/period-model.mjs';
import {summary,validData} from './dist/model.mjs';
assert.deepEqual(periodForMonth('2026-11',15),{month:'2026-11',start:'2026-10-16',end:'2026-11-15'});
assert.deepEqual(periodForMonth('2026-01',15),{month:'2026-01',start:'2025-12-16',end:'2026-01-15'});
assert.deepEqual(periodForMonth('2026-02',0),{month:'2026-02',start:'2026-02-01',end:'2026-02-28'});
assert.deepEqual(periodForMonth('2024-02',0),{month:'2024-02',start:'2024-02-01',end:'2024-02-29'});
assert.deepEqual(periodForMonth('2026-02',30),{month:'2026-02',start:'2026-01-31',end:'2026-02-28'});
assert.deepEqual(periodForMonth('2026-03',30),{month:'2026-03',start:'2026-03-01',end:'2026-03-30'});
assert.equal(periodMonthForDate('2026-10-15',15),'2026-10');assert.equal(periodMonthForDate('2026-10-16',15),'2026-11');assert.equal(periodMonthForDate('2026-12-31',15),'2027-01');assert.equal(periodMonthForDate('2026-02-28',30),'2026-02');assert.equal(periodMonthForDate('2026-03-01',30),'2026-03');assert.equal(periodMonthForDate('2024-02-29',29),'2024-02');assert.equal(periodMonthForDate('2026-02-28',29),'2026-02');assert.equal(periodMonthForDate('2026-03-01',29),'2026-03');assert.throws(()=>periodMonthForDate('2026-02-30',15));
// Each supported closing day partitions leap and ordinary years without gaps or overlaps.
for(let day=0;day<=30;day++)for(let year=2023;year<=2026;year++)for(let month=1;month<=12;month++){
 const label=`${year}-${String(month).padStart(2,'0')}`,p=periodForMonth(label,day),next=periodForMonth(shiftMonth(label,1),day);const tomorrow=new Date(p.end+'T00:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);assert.equal(tomorrow.toISOString().slice(0,10),next.start);assert.equal(periodMonthForDate(p.start,day),label);assert.equal(periodMonthForDate(p.end,day),label);
}
const expense=(date,amount)=>({id:date,date,amount,type:'expense',category:'食費',note:'test'});
const entries=[expense('2026-10-15',1),expense('2026-10-16',10),expense('2026-11-15',100),expense('2026-11-16',1000)];assert.equal(summary(entries,'2026-11',15).expense,110);assert.deepEqual(summary(entries,'2026-11',15).rows.map(e=>e.date),['2026-10-16','2026-11-15']);assert.equal(summary(entries,'2026-11').expense,1100);
const old={version:1,entries,budgets:{'2026-11':5000}};assert.ok(validData(old));assert.equal(closingDayOf(old),0);assert.ok(validData({...old,settings:{closingDay:15}}));assert.ok(validData(JSON.parse(JSON.stringify({...old,settings:{closingDay:30}}))));for(const closingDay of [-1,31,15.5,'15',null])assert.ok(!validData({...old,settings:{closingDay}}));for(const settings of [null,[],15,'invalid'])assert.ok(!validData({...old,settings}));assert.equal(validClosingDay(0),true);console.log('締め日・月またぎ・年またぎ・うるう年・期間の連続性・集計・旧バックアップ互換を確認しました');
