import {moneyValue,normalizeDate} from './import-model.mjs';
export function extractReceipt(text){
 const lines=text.normalize('NFKC').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let date='',note='',total=0,totalScore=-1;const amounts=[];
 const numbers=t=>{const values=[];for(const m of t.matchAll(/[¥￥]?\s*\d[\d,]*(?:\.0+)?(?:\s*円)?(?![\d,点個%])/g)){try{const value=moneyValue(m[0]);if(value>0)values.push(value);}catch{}}return values;};
 for(const [i,line] of lines.entries()){
 const d=line.match(/(?:\d{4}|(?:令和|R)\s*\d{1,2})\s*[\/年.\-]\s*\d{1,2}\s*[\/月.\-]\s*\d{1,2}\s*日?/i);if(d&&!date){try{date=normalizeDate(d[0].replace(/\s/g,'').replace(/^(?:令和|R)(\d+)/i,(_,n)=>String(2018+Number(n))));}catch{}}
 const compact=line.replace(/\s/g,'');const label=compact.match(/総合計|領収金額|ご請求金額|合計|お支払(?:い)?金額|お買上(?:げ)?金額|お買上計|お支払|現計|お買上/);
 const score=/総合計|領収金額|ご請求金額/.test(compact)?5:/合計|お支払(?:い)?金額|お買上(?:げ)?金額|お買上計/.test(compact)?4:/お支払|現計|お買上/.test(compact)?2:-1;
 const ignore=/小計|お預|預り|お釣|釣銭|つり|電話|TEL|登録番号|残高/i.test(compact)||(!label&&/消費税|内税|外税/.test(compact));
 const tail=d?line.slice(line.indexOf(d[0])+d[0].length):line,candidates=numbers(tail);
 if(!ignore&&!d&&candidates.length){for(const value of candidates)amounts.push({value,label:line.slice(0,100)});if(label&&score>=totalScore){const totalCandidates=numbers(compact.slice(label.index+label[0].length));if(totalCandidates.length){total=totalCandidates[0];totalScore=score;}}}
 if(!ignore&&score>=4&&!candidates.length&&lines[i+1]){try{const value=moneyValue(lines[i+1]);if(value>0&&score>=totalScore){total=value;totalScore=score;amounts.push({value,label:line+' '+lines[i+1]});}}catch{}}
 }
 note=lines.slice(0,6).find(line=>/[\p{L}]/u.test(line)&&! /レシート|領収|利用明細|お買上明細|電話|TEL|登録番号|合計|税込|住所|\d{2,}/i.test(line.replace(/\s/g,'')))||'';
 return {date,amount:total,note:note.slice(0,500),amounts:amounts.slice(0,150),warnings:[...(!date?['日付を確認して入力してください。']:[]),...(!total?['合計金額を特定できませんでした。元のレシートで確認してください。']:[])]};
}
