import {parseCSV,mapCSV,fingerprint} from './import-model.mjs';
import {extractTransactions} from './pdf-model.mjs';
import {validData} from './model.mjs';
export function setupImporter({getData,persist,onImported,toast}){
 const $=id=>document.getElementById(id),yen=n=>'¥'+n.toLocaleString('ja-JP');let file=null,csvRows=[],candidates=[],controller=null,busy=false,run=0,isCSV=false;
 const status=(message,error=false)=>{$('csv-status').textContent=message;$('csv-status').classList.toggle('review-error',error);};
 const previewOff=()=>{$('csv-preview-panel').hidden=true;candidates=[];};
 $('csv-open').onclick=()=>$('csv-dialog').showModal();
 const stop=()=>{controller?.abort();};$('pdf-cancel').onclick=stop;
 $('csv-close').onclick=()=>{stop();$('csv-dialog').close();};$('csv-dialog').addEventListener('cancel',stop);
 $('csv-dialog').addEventListener('close',()=>{$('pdf-password').value='';});
 $('pdf-year').value=new Date().getFullYear();
 $('csv-file').onchange=async()=>{
 stop();run++;file=$('csv-file').files[0]||null;csvRows=[];previewOff();$('csv-mapping').hidden=true;$('pdf-text-panel').hidden=true;$('pdf-text').value='';$('pdf-password').value='';$('pdf-progress').hidden=true;$('pdf-options').hidden=true;$('csv-file-options').hidden=true;
 if(!file)return;
 if(file.size>20*1024*1024){status('20MB以下のファイルを選んでください。',true);file=null;return;}
 isCSV=/\.(csv|tsv|txt)$/i.test(file.name);
 if(isCSV){$('csv-file-options').hidden=false;await loadCSV();}
 else if(/\.pdf$/i.test(file.name)){$('pdf-options').hidden=false;const image=!/\.pdf$/i.test(file.name);for(const id of ['pdf-from','pdf-to','pdf-password','pdf-method'])$(id).disabled=image;$('pdf-method').value=image?'ocr':'auto';status(`${file.name} を選択しました。「PDFから取引を読み取る」を押してください。`);}
 else {status('PDFまたはCSV形式を選んでください。',true);file=null;}
 };
 async function loadCSV(){
 if(!file||!isCSV)return;const thisRun=++run;previewOff();$('csv-mapping').hidden=true;
 try{const bytes=new Uint8Array(await file.arrayBuffer());if(thisRun!==run)return;let text,encoding=$('csv-encoding').value;
 if(encoding==='auto'){try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('shift_jis',{fatal:true}).decode(bytes);}}else text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
 csvRows=parseCSV(text);const header=Number($('csv-header').value);if(!Number.isInteger(header)||header<1||header>100||!csvRows[header-1]||csvRows.length<=header)throw Error('見出し行と、その後の取引データがあるか確認してください。');
 const headers=csvRows[header-1];if(headers.length<2)throw Error('CSVの列を読み取れませんでした。カンマ・タブ・セミコロン区切りに対応しています。');
 for(const key of ['date','note','amount','debit','credit']){const select=$('map-'+key);select.replaceChildren(new Option('指定しない',''),...headers.map((h,i)=>new Option(`${i+1}: ${h.trim().slice(0,70)||'（空欄）'}`,String(i))));}
 const auto=(key,regex)=>{const i=headers.findIndex(h=>regex.test(h));if(i>=0)$('map-'+key).value=String(i);};auto('date',/利用日|取引日|日付|年月日|date/i);auto('note',/摘要|適用|利用店|店名|内容|メモ|description|merchant/i);auto('amount',/利用金額|入出金額|取引金額|金額|amount/i);auto('debit',/出金|支払金額|お支払|引出|debit|withdraw/i);auto('credit',/入金|預入|お預|credit|deposit/i);
 $('csv-mode').value=$('map-debit').value!==''&&$('map-credit').value!==''?'separate':'expense';modeChanged();$('csv-mapping').hidden=false;status(`${file.name}：取引データ ${csvRows.length-header} 行。文字化けがある場合は文字コードを変更してください。`);
 }catch(e){status(e.message||'CSVを読み込めませんでした。文字コードを変更してみてください。',true);}
 }
 $('csv-encoding').onchange=loadCSV;$('csv-header').onchange=loadCSV;
 function modeChanged(){const separate=$('csv-mode').value==='separate';$('single-amount-label').hidden=separate;$('debit-label').hidden=!separate;$('credit-label').hidden=!separate;previewOff();}
 $('csv-mode').onchange=modeChanged;for(const key of ['date','note','amount','debit','credit'])$('map-'+key).onchange=previewOff;
 function source(){const s=$('csv-source').value.trim();if(!s||s.length>80){$('csv-source').focus();toast('口座・カード名を入力してください。');return null;}return s;}
 $('csv-preview').onclick=()=>{
 const name=source();if(!name)return;const mapping={mode:$('csv-mode').value,source:name,header:$('csv-header').value};for(const key of ['date','note','amount','debit','credit'])mapping[key]=$('map-'+key).value;
 const cols=[mapping.date,...(mapping.mode==='separate'?[mapping.debit,mapping.credit].filter(x=>x!==''):[mapping.amount])];if(mapping.date===''||(mapping.mode==='separate'?mapping.debit===''&&mapping.credit==='':mapping.amount==='')){toast('日付と金額の列を指定してください。');return;}if(new Set(cols).size!==cols.length){toast('日付・入金・出金には異なる列を指定してください。');return;}
 const rows=mapCSV(csvRows.slice(Number(mapping.header)),mapping,getData().entries);candidates=rows.map(r=>({...r,entry:r.entry||{date:'',type:'expense',amount:0,note:(r.raw?.join(' ')||'').slice(0,500),category:'その他',source:name},selected:!!r.entry&&!r.duplicate,raw:r.raw?.join(' ')||''}));showReview(false);
 };
 function setBusy(value){busy=value;for(const id of ['csv-file','pdf-read','csv-source','pdf-from','pdf-to','pdf-method','pdf-password'])$(id).disabled=value;const image=file&&!/\.pdf$/i.test(file.name);if(!value&&image)for(const id of ['pdf-from','pdf-to','pdf-password','pdf-method'])$(id).disabled=true;$('pdf-cancel').hidden=!value;}
 $('pdf-read').onclick=async()=>{
 if(busy||!file)return;const name=source();if(!name)return;const selectedFile=file;const thisRun=++run;controller=new AbortController();setBusy(true);previewOff();$('pdf-text-panel').hidden=true;$('pdf-progress').hidden=false;$('pdf-progress').value=0;
 try{const {readDocument}=await import('./pdf-reader.mjs');const pages=await readDocument(selectedFile,{mode:$('pdf-method').value,password:$('pdf-password').value,start:$('pdf-from').value,end:$('pdf-to').value},(message,progress)=>{if(thisRun!==run)return;status(message);if(progress===null)$('pdf-progress').removeAttribute('value');else $('pdf-progress').value=progress;},controller.signal);
 if(thisRun!==run)return;$('pdf-text').value=pages.map(p=>`--- ${p.page}ページ${p.ocr?'（OCR）':''} ---\n${p.text}`).join('\n\n');$('pdf-text-panel').hidden=false;status(`${pages.length}ページを読み取りました（OCR ${pages.filter(p=>p.ocr).length}ページ）。元の明細と照合して取引を選択してください。`);
 if(!pages.some(p=>p.text.trim()))status('文字を認識できませんでした。解像度や向きを確認して再読み取りしてください。',true);else buildPDF();
 }catch(e){if(thisRun===run)status(e.name==='AbortError'?'読み取りを中止しました。保存した記録は変更されていません。':e.message||'読み取りに失敗しました。ファイルを確認して再度お試しください。',e.name!=='AbortError');}
 finally{if(thisRun===run){setBusy(false);$('pdf-password').value='';$('pdf-progress').hidden=true;controller=null;}}
 };
 function buildPDF(){const name=source();if(!name)return;const year=Number($('pdf-year').value);if(!Number.isInteger(year)||year<1900||year>2200){toast('日付の年を1900〜2200で指定してください。');return;}
 try{const results=extractTransactions($('pdf-text').value,{year,type:$('pdf-type').value,amountPosition:Number($('pdf-amount-position').value)});candidates=results.map(r=>({...r,entry:{...r.entry,source:name},selected:false}));showReview(true);if(!results.length)toast('取引候補を見つけられませんでした。テキストを修正するか、行を追加してください。');}catch(e){toast(e.message);}}
 $('pdf-parse').onclick=buildPDF;for(const id of ['pdf-year','pdf-type','pdf-amount-position','pdf-text'])$(id).oninput=previewOff;
 function rowError(e){if(!e.source?.trim())return '口座・カード名を入力';if(!validData({version:1,entries:[{...e,id:'candidate'}],budgets:{}}))return '日付・金額・摘要を確認';return '';}
 function showReview(pdf){$('csv-preview-panel').hidden=false;$('preview-help').textContent=pdf?'PDF・OCRの候補はすべて未選択です。日付・金額・種類を元の明細と照合してチェックしてください。認識できなかった取引は「行を追加」で入力できます。':'日付・摘要・種類・金額はこの表で修正できます。重複候補は未選択です。';const body=$('csv-preview-rows');body.replaceChildren();
 for(const [index,item] of candidates.entries()){
 const tr=document.createElement('tr');const check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label',`${index+1}行目を取り込む`);check.checked=!!item.selected;const c=document.createElement('td');c.append(check);tr.append(c);item.check=check;
 for(const field of ['date','note','type','amount']){const td=document.createElement('td');let input;if(field==='type'){input=document.createElement('select');input.append(new Option('支出','expense'),new Option('収入','income'));}else{input=document.createElement('input');input.type=field==='date'?'date':field==='amount'?'number':'text';if(field==='amount'){input.min='1';input.max='999999999';input.step='1';}if(field==='note')input.maxLength=500;}input.value=field==='amount'?(item.entry.amount||''):item.entry[field];input.setAttribute('aria-label',`${index+1}行目の${{date:'日付',note:'摘要',type:'種類',amount:'金額'}[field]}`);input.oninput=()=>{item.entry[field]=field==='amount'?Number(input.value):input.value;updateReview();};td.append(input);tr.append(td);}
 const td=document.createElement('td'),badge=document.createElement('span');td.append(badge);item.badge=badge;
 if(item.raw){const details=document.createElement('details'),summary=document.createElement('summary'),small=document.createElement('small');summary.textContent='元の読み取り';small.textContent=item.raw;details.append(summary,small);td.append(details);}tr.append(td);check.onchange=()=>{item.selected=check.checked;updateReview();};body.append(tr);
 }updateReview();}
 function updateReview(){const known=new Set(getData().entries.map(fingerprint));let invalid=0,duplicate=0,count=0,income=0,expense=0;
 for(const item of candidates){const error=rowError(item.entry);const key=fingerprint(item.entry);item.duplicate=known.has(key);if(!error)known.add(key);if(error){invalid++;item.selected=false;}if(item.duplicate)duplicate++;item.check.disabled=!!error;item.check.checked=item.selected;item.badge.textContent=error||(item.duplicate?'重複候補：要確認':'入力OK：内容を確認');item.badge.className=error?'review-error':item.duplicate?'review-warning':'review-ok';if(item.selected){count++;if(item.entry.type==='income')income+=item.entry.amount;else expense+=item.entry.amount;}}
 $('csv-summary').textContent=`候補 ${candidates.length}件 ／ 要修正 ${invalid}件 ／ 重複候補 ${duplicate}件 ／ 選択 ${count}件（支出 ${yen(expense)}・収入 ${yen(income)}）`;$('csv-confirm').disabled=count===0;$('csv-confirm').textContent=`選択した ${count}件を取り込む`;
 }
 $('csv-source').oninput=()=>{for(const item of candidates)item.entry.source=$('csv-source').value.trim();if(candidates.length)updateReview();};
 $('csv-select-all').onclick=()=>{updateReview();for(const item of candidates)item.selected=!rowError(item.entry)&&!item.duplicate;updateReview();};$('csv-select-none').onclick=()=>{for(const item of candidates)item.selected=false;updateReview();};
 $('import-add-row').onclick=()=>{const name=source();if(!name)return;candidates.push({entry:{date:'',amount:0,type:'expense',category:'その他',note:'',source:name},selected:false});showReview(!isCSV);$('csv-preview-rows').lastChild.querySelector('input[type=date]').focus();};
 $('csv-confirm').onclick=()=>{if(!source())return;updateReview();const selected=candidates.filter(c=>c.selected);if(!selected.length)return;if(selected.some(c=>c.duplicate)&&!confirm('重複候補が選択されています。同じ取引が二重に登録される可能性があります。取り込みますか？'))return;
 const entries=selected.map(c=>({...c.entry,id:crypto.randomUUID()}));const next={...getData(),entries:[...getData().entries,...entries]};if(!validData(next)){toast('取り込みできません。日付・金額・データ件数を確認してください。');return;}
 if(persist(next)){const latest=entries.reduce((a,e)=>e.date>a?e.date:a,'');previewOff();$('csv-dialog').close();onImported(latest);toast(`${entries.length}件の取引を取り込みました`);}
 };
}
