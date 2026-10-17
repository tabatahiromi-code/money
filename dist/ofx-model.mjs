import {moneyValue,normalizeDate,fingerprint} from './import-model.mjs';
const prefix='(?:[A-Za-z_][\\w.-]*:)?';
function unescapeText(text){return text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,e=>{const value=e.slice(1,-1),named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(named[value.toLowerCase()])return named[value.toLowerCase()];const n=value[1]?.toLowerCase()==='x'?parseInt(value.slice(2),16):Number(value.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'�';});}
function field(text,tag){const match=text.match(new RegExp('<'+prefix+tag+'(?:\\s[^>]*)?>\\s*([^<]*)','i'));return match?unescapeText(match[1]).trim():'';}
function blocks(text,tag){return [...text.matchAll(new RegExp('<'+prefix+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+prefix+tag+'\\s*>','gi'))].map(m=>m[1]);}
export function decodeStatement(bytes,preference='auto',ofx=false){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let encoding=preference;
 if(encoding==='auto'){
 if(data[0]===0xff&&data[1]===0xfe)encoding='utf-16le';else if(data[0]===0xfe&&data[1]===0xff)encoding='utf-16be';else if(data[0]===0xef&&data[1]===0xbb&&data[2]===0xbf)encoding='utf-8';
 else if(ofx){const header=new TextDecoder('windows-1252').decode(data.slice(0,4096));const xml=header.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i)?.[1];const charset=header.match(/(?:^|[\r\n])CHARSET\s*:\s*([^\r\n]+)/i)?.[1]?.trim();const declared=header.match(/(?:^|[\r\n])ENCODING\s*:\s*([^\r\n]+)/i)?.[1]?.trim();const labels={'1252':'windows-1252','windows-1252':'windows-1252','iso-8859-1':'windows-1252','932':'shift_jis','shift_jis':'shift_jis','shift-jis':'shift_jis','sjis':'shift_jis','ms_kanji':'shift_jis','1200':'utf-16le','65001':'utf-8','utf8':'utf-8','utf-8':'utf-8','utf-16':'utf-16le','utf-16le':'utf-16le','utf-16be':'utf-16be'};encoding=labels[(xml||'').toLowerCase()]||labels[(charset||'').toLowerCase()]||labels[(declared||'').toLowerCase()]||'auto';}
 }
 if(encoding!=='auto')return new TextDecoder(encoding,{fatal:true}).decode(data);
 try{return new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{try{return new TextDecoder('shift_jis',{fatal:true}).decode(data);}catch{if(ofx)return new TextDecoder('windows-1252',{fatal:true}).decode(data);throw Error('文字コードを読み取れませんでした。文字コードを指定してください。');}}
}
export function createDuplicateTracker(existing=[]){const ids=new Set(),fallback=new Set(),all=new Set();function add(e){all.add(fingerprint(e));if(e.ofxKey)ids.add(e.ofxKey);else fallback.add(fingerprint(e));}for(const e of existing)add(e);return {has:e=>e.ofxKey?(ids.has(e.ofxKey)||fallback.has(fingerprint(e))):all.has(fingerprint(e)),add};}
export function parseOFX(input){
 if(typeof input!=='string'||input.length>20*1024*1024)throw Error('OFXは20MB以下のファイルにしてください。');
 if(/<!DOCTYPE|<!ENTITY/i.test(input))throw Error('外部定義を含むOFXには対応していません。');
 const text=input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,(_,value)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')).replace(/<!--[\s\S]*?-->/g,'');
 if(!new RegExp('<'+prefix+'OFX(?:\\s|>)','i').test(text))throw Error('OFX形式を確認できませんでした。OFXまたはCSVファイルを選んでください。');
 if(new RegExp('<'+prefix+'(?:CORRECTFITID|CORRECTACTION)(?:\\s|>)','i').test(text))throw Error('訂正・削除指示を含むOFXは自動取り込みできません。通常の取引明細を取得してください。');
 for(const status of blocks(text,'STATUS')){const code=field(status,'CODE');if(code&&code!=='0')throw Error('OFXに金融機関の応答エラーが含まれています（コード '+code+'）。明細を再取得してください。');}
 const statements=[...text.matchAll(new RegExp('<'+prefix+'(STMTRS|CCSTMTRS)(?:\\s[^>]*)?>([\\s\\S]*?)</'+prefix+'\\1\\s*>','gi'))];
 if(!statements.length)throw Error('銀行・カードの取引明細がありません。投資用OFXには対応していません。');
 const accounts=[],rows=[];let missingIds=0;
 const institution=field(text,'FID')||field(text,'ORG');
 for(const statement of statements){const body=statement[2],currency=field(body,'CURDEF').toUpperCase(),account=field(body,'ACCTID'),bank=field(body,'BANKID')||field(body,'BROKERID')||institution;
 if(currency!=='JPY')throw Error(currency?`${currency}建てのOFXには対応していません。円（JPY）の明細を選んでください。`:'OFXの通貨を確認できません。円（JPY）が指定された明細を選んでください。');
 if(!account)throw Error('OFXの口座識別情報がありません。金融機関から明細を再取得してください。');
 if([account,bank].some(s=>s.length>500))throw Error('OFXの口座情報が長すぎます。ファイルを確認してください。');
 const kind=statement[1].toUpperCase()==='CCSTMTRS'?'カード':'銀行';const label=`${kind} …${account.slice(-4)}（JPY）`;accounts.push(label);
 const transactions=blocks(body,'STMTTRN');const opening=[...body.matchAll(new RegExp('<'+prefix+'STMTTRN(?:\\s[^>]*)?>','gi'))].length;
 if(opening!==transactions.length)throw Error('OFXの取引の区切りが壊れています。ファイルを再取得してください。');
 for(const transaction of transactions){const fitId=field(transaction,'FITID'),dateText=field(transaction,'DTPOSTED'),amountText=field(transaction,'TRNAMT');
 if(fitId.length>500)throw Error('OFXの取引IDが長すぎます。ファイルを確認してください。');
 const transactionCurrency=field(transaction,'CURSYM').toUpperCase();if(transactionCurrency&&transactionCurrency!=='JPY')throw Error('外貨取引を含むOFXには対応していません。円建ての明細を選んでください。');
 const name=field(transaction,'NAME'),memo=field(transaction,'MEMO'),note=[name,...(memo&&memo!==name?[memo]:[])].filter(Boolean).join(' / ');const entry={date:'',type:'expense',amount:0,note,source:'',category:'その他'};const errors=[];
 if(fitId)entry.ofxKey=JSON.stringify([kind,bank,account,currency,fitId]);else missingIds++;
 try{if(!/^\d{8}(?:\d{6}(?:\.\d+)?)?(?:\[[^\]]+\])?$/.test(dateText))throw Error('OFXの日付を確認してください');entry.date=normalizeDate(dateText.slice(0,8));}catch(e){errors.push(e.message);}
 try{const value=moneyValue(amountText);if(!value)throw Error('金額が空欄または0です');entry.amount=Math.abs(value);entry.type=value<0?'expense':'income';}catch(e){errors.push(e.message);}
 if(note.length>500)errors.push('摘要が500文字を超えています');
 rows.push({entry,account:label,raw:`${label}\n日付: ${dateText}\n金額: ${amountText}\n摘要: ${note}`,error:errors.join(' / ')});
 if(rows.length>10000)throw Error('OFXは一度に10,000件までに分けてください。');
 }
 }
 if(!rows.length)throw Error('OFXに取引データがありません。');return {rows,accounts:[...new Set(accounts)],missingIds};
}

export function detectStatementFormat(file,bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);const name=String(file.name||'').normalize('NFKC').trim();
 if(new TextDecoder('windows-1252').decode(data.slice(0,1024)).includes('%PDF-'))return 'pdf';
 let text='';try{text=decodeStatement(data.slice(0,65536),'auto',true);}catch{const encoding=data[0]===0xff&&data[1]===0xfe?'utf-16le':data[0]===0xfe&&data[1]===0xff?'utf-16be':'utf-8';text=new TextDecoder(encoding).decode(data.slice(0,65536));}
 if(/<(?:[A-Za-z_][\w.-]*:)?OFX(?:\s|>)/i.test(text)||/\.(ofx|qfx)$/i.test(name))return 'ofx';
 if(/\.pdf$/i.test(name))return 'pdf';
 if(/\.(csv|tsv|txt)$/i.test(name))return 'csv';
 if(!text.includes('\0')){const lines=text.split(/\r?\n/).filter(x=>x.trim());if(lines.length>1&&[',','\t',';'].some(d=>lines.slice(0,20).filter(line=>line.includes(d)).length>=2))return 'csv';}
 return 'unknown';
}
