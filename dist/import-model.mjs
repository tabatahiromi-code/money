// CSV parsing and mapping never sends file contents off this device.
export function parseCSV(input, delimiter){
 const text=input.replace(/^\uFEFF/,'');
 if(!delimiter){const first=text.split(/\r?\n/,1)[0];delimiter=[',','\t',';'].map(d=>[d,(first.match(new RegExp(d==='\t'?'\t':d,'g'))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0];}
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
 if(c==='"'){if(cell!==''||closed)throw Error('CSVの引用符が正しくありません。');quoted=true;}
 else if(c===delimiter){row.push(cell);cell='';closed=false;}
 else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];cell='';closed=false;}
 else {if(closed&&c.trim())throw Error('CSVの引用符の後に不正な文字があります。');if(!closed)cell+=c;}
 }
 if(quoted)throw Error('CSVの引用符が閉じられていません。');row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);if(rows.length>10001)throw Error('一度に読み込めるのは10,000行までです。');return rows;
}
export function normalizeDate(value){const t=String(value||'').normalize('NFKC').trim();let m=t.match(/^(\d{4})[\/年.\-](\d{1,2})[\/月.\-](\d{1,2})(?:日)?(?:[ T].*)?$/)||t.match(/^(\d{4})(\d{2})(\d{2})$/);if(!m)throw Error('日付の形式を確認（年/月/日）');const y=Number(m[1]),mo=Number(m[2]),day=Number(m[3]),date=`${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(y<1900||y>2200||isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('存在しない日付です');return date;}
export function moneyValue(value){const text=String(value??'').normalize('NFKC').replace(/−/g,'-').trim();if(!text||text==='-'||text==='―')return null;if(/[()]/.test(text)&&!/^\([^()]+\)$/.test(text))throw Error('金額のかっこを確認してください');const negative=/^[△▲]/.test(text)||/^\(.*\)$/.test(text);const cleaned=text.replace(/[¥￥円\s△▲()]/g,'');if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?$/.test(cleaned))throw Error('金額は円単位の整数にしてください');let n=Number(cleaned.replaceAll(',',''));if(negative)n=-Math.abs(n);if(!Number.isSafeInteger(n)||Math.abs(n)>999999999)throw Error('金額が範囲外です');return n;}
export function fingerprint(e){return JSON.stringify([e.date,e.type,e.amount,e.note.trim().replace(/\s+/g,' '),(e.source||'').trim().replace(/\s+/g,' ')]);}
export function mapCSV(rows, mapping, existing=[]){
 const known=new Set(existing.map(fingerprint));return rows.map((row,index)=>{try{
 const get=k=>mapping[k]===undefined||mapping[k]===''?'':(row[Number(mapping[k])]||'');const date=normalizeDate(get('date'));let amount,type;
 if(mapping.mode==='separate'){const debit=moneyValue(get('debit')),credit=moneyValue(get('credit'));if(debit&&credit)throw Error('入金と出金の両方に金額があります');if(debit){amount=Math.abs(debit);type='expense';}else if(credit){amount=Math.abs(credit);type='income';}}
 else{const n=moneyValue(get('amount'));if(n!==null){amount=Math.abs(n);if(mapping.mode==='kind'){const kind=get('kind').trim().toLowerCase();if(['支出','出金','支払い','expense','debit'].includes(kind))type='expense';else if(['収入','入金','income','credit'].includes(kind))type='income';else throw Error('種類は収入・支出（または入金・出金）を指定してください');}else type=mapping.mode==='income'?'income':mapping.mode==='signed'?(n<0?'expense':'income'):'expense';}}
 if(!amount)throw Error('金額が空欄または0です');const note=get('note').trim(),source=mapping.source.trim();if(note.length>500)throw Error('摘要が500文字を超えています');const e={date,type,amount,note,source,category:'その他'};const key=fingerprint(e),duplicate=known.has(key);known.add(key);return {entry:e,duplicate,row:index+Number(mapping.header||1)+1};
 }catch(error){return {error:error.message,row:index+Number(mapping.header||1)+1,raw:row};}});
}
