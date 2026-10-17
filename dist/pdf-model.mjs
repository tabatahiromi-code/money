import {normalizeDate,moneyValue} from './import-model.mjs';
// Join text fragments by their physical row, so tables read across columns.
export function groupWords(words){
 const rows=[];
 for(const w of words.filter(w=>w.text.trim()).sort((a,b)=>a.y-b.y||a.x-b.x)){
 const row=rows.find(r=>Math.abs(r.y-w.y)<=Math.max(3,Math.min(r.h,w.h)*0.45));
 if(row){row.words.push(w);row.y=(row.y*(row.words.length-1)+w.y)/row.words.length;row.h=Math.max(row.h,w.h);}else rows.push({y:w.y,h:w.h,words:[w]});
 }
 return rows.sort((a,b)=>a.y-b.y).map(r=>{let text='',end=null;for(const w of r.words.sort((a,b)=>a.x-b.x)){const gap=end===null?0:w.x-end;text+=(gap>Math.max(2,w.h*0.25)?' ':'')+w.text;end=w.x+w.w;}return text.trim();}).join('\n');
}
const datePattern=/(?:\d{4}\s*[\/年.\-]\s*\d{1,2}\s*[\/月.\-]\s*\d{1,2}\s*日?|(?:令和|R)\s*\d{1,2}\s*[\/年.\-]\s*\d{1,2}\s*[\/月.\-]\s*\d{1,2}\s*日?|\d{1,2}\s*[\/月.\-]\s*\d{1,2}\s*日?)/i;
export function extractTransactions(text,{year,type='expense',amountPosition=1}={}){
 const lines=text.normalize('NFKC').replace(/[,，]\s+(?=\d{3}\b)/g,',').split(/\r?\n/);const results=[];
 for(let i=0;i<lines.length;i++){
 const line=lines[i].trim(),match=line.match(datePattern);if(!match)continue;let token=match[0].replace(/\s/g,'');
 token=token.replace(/^(?:令和|R)(\d+)/i,(_,n)=>String(2018+Number(n)));
 if(!/^\d{4}/.test(token))token=String(year)+'/'+token;
 let date='',error='';try{date=normalizeDate(token);}catch(e){error=e.message;}
 const tail=line.slice(match.index+match[0].length).trim();
 const matches=[...tail.matchAll(/(?<![\p{L}\p{N}.,])(?:[+\-−△▲]\s*)?[¥￥]?\s*\(?\d[\d,]*(?:\.0+)?\)?(?:円)?(?![\p{L}\p{N}.,])/gu)].filter(m=>m[0].trim());
 const at=Number(amountPosition)>0?matches.length-Number(amountPosition):0,chosen=matches[at];let amount=null,entryType=type;
 try{if(chosen){const n=moneyValue(chosen[0].replace('−','-'));amount=Math.abs(n);if(type==='signed')entryType=n<0?'expense':'income';if(!amount)error=error||'金額を確認してください';}else error=error||'金額を入力してください';}catch(e){error=error||e.message;}
 const note=(matches.length?tail.slice(0,matches[0].index):tail).trim().slice(0,500);
 results.push({entry:{date,amount:amount||0,type:entryType==='signed'?'expense':entryType,category:'その他',note},raw:line,line:i+1,error,candidates:matches.map(m=>m[0].trim())});
 if(results.length>=2000)throw Error('候補が2,000件を超えています。ページを分けて読み込んでください。');
 }
 return results;
}
