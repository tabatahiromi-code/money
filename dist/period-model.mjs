export function validClosingDay(day){return Number.isInteger(day)&&day>=0&&day<=30;}
export function closingDayOf(data){return data?.settings?.closingDay??0;}
function utcDate(year,month,day){const date=new Date(0);date.setUTCFullYear(year,month,day);date.setUTCHours(0,0,0,0);return date;}
function parts(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('集計月が正しくありません');return [Number(month.slice(0,4)),Number(month.slice(5,7))-1];}
function endDay(year,month,closingDay){const last=utcDate(year,month+1,0).getUTCDate();return closingDay===0?last:Math.min(last,closingDay);}
export function shiftMonth(month,offset){const [year,index]=parts(month);return utcDate(year,index+offset,1).toISOString().slice(0,7);}
export function periodForMonth(month,closingDay=0){
 if(!validClosingDay(closingDay))throw Error('締め日は1〜30日または末日を指定してください');
 const [year,index]=parts(month);const previous=utcDate(year,index-1,1);const start=utcDate(previous.getUTCFullYear(),previous.getUTCMonth(),endDay(previous.getUTCFullYear(),previous.getUTCMonth(),closingDay)+1);const end=utcDate(year,index,endDay(year,index,closingDay));
 return {month,start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export function periodMonthForDate(date,closingDay=0){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('日付が正しくありません');
 const month=date.slice(0,7);return date>periodForMonth(month,closingDay).end?shiftMonth(month,1):month;
}
export function formatPeriod(period){return `${period.start.replaceAll('-','/')} 〜 ${period.end.replaceAll('-','/')}`;}
export function closingDayLabel(closingDay){return closingDay===0?'毎月1日〜月末':`毎月${closingDay+1}日〜翌月${closingDay}日`;}
