export const recordKinds=['cash_flow','card_detail'];
export function validAccountingSettings(settings){return settings.cardSources===undefined||(Array.isArray(settings.cardSources)&&settings.cardSources.length<=1000&&settings.cardSources.every(source=>typeof source==='string'&&source.trim().length>0&&source.length<=80)&&new Set(settings.cardSources).size===settings.cardSources.length);}
export function isCardDetail(entry,settings={}){
 if(entry.recordKind==='card_detail')return true;
 if(entry.ofxKey){try{const key=JSON.parse(entry.ofxKey);if(Array.isArray(key)&&key[0]==='カード')return true;}catch{}}
 return (settings.cardSources||[]).includes((entry.source||'').trim());
}
export function cardHistory(entries,month,settings={}){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('利用月が正しくありません');return entries.filter(e=>e.date.startsWith(month)&&isCardDetail(e,settings)).sort((a,b)=>b.date.localeCompare(a.date));}
