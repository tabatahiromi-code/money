import {validData} from './model.mjs';
import {closingDayOf,validClosingDay,periodMonthForDate,periodForMonth,formatPeriod,closingDayLabel} from './period-model.mjs';
const $=id=>document.getElementById(id),key='kotsukotsu-money-v1';let savedDay=0,savedSources=[];
const selectedSources=()=>Array.from(document.querySelectorAll('#card-sources input:checked'),input=>input.value).sort();
const dirty=()=>Number($('closing-day').value)!==savedDay||JSON.stringify(selectedSources())!==JSON.stringify(savedSources);
function renderSources(data,chosen=savedSources){const sources=[...new Set([...data.entries.map(e=>(e.source||'').trim()).filter(Boolean),...chosen])].sort();$('card-sources').replaceChildren();for(const source of sources){const label=document.createElement('label'),input=document.createElement('input');label.className='check-label';input.type='checkbox';input.value=source;input.checked=chosen.includes(source);input.onchange=()=>{renderPreview();$('settings-status').textContent=dirty()?'変更はまだ保存されていません。':'';};label.append(input,document.createTextNode(source));$('card-sources').append(label);}if(!sources.length)$('card-sources').textContent='名前を付けた明細を取り込むと、ここに表示されます。新しく取り込む際にも「カード利用明細」を選べます。';}

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function readData(){let raw;try{raw=localStorage.getItem(key);}catch{throw Error('ブラウザの保存領域を開けませんでした。保存設定を確認してください。');}let data;try{data=raw?JSON.parse(raw):{version:1,entries:[],budgets:{}};}catch{throw Error('保存した家計簿データを読み込めませんでした。設定は保存していません。');}if(!validData(data))throw Error('保存した家計簿データを読み込めませんでした。設定は保存していません。');return data;}
function showError(message){$('settings-error').textContent=message;$('settings-error').hidden=false;$('settings-status').textContent='';}
function renderPreview(){const value=$('closing-day').value,day=Number(value);if(value===''||!validClosingDay(day))return;const period=periodForMonth(periodMonthForDate(today(),day),day);$('settings-cycle').textContent=closingDayLabel(day);$('settings-month').textContent=`今日を含む期間：${Number(period.month.slice(0,4))}年${Number(period.month.slice(5,7))}月分`;$('settings-period').textContent=formatPeriod(period);$('settings-save').disabled=!dirty();}
for(let day=1;day<=30;day++)$('closing-day').append(new Option(`${day}日`,String(day)));
try{const initial=readData();savedDay=closingDayOf(initial);savedSources=[...(initial.settings?.cardSources||[])].sort();renderSources(initial);$('closing-day').value=String(savedDay);$('settings-fields').disabled=false;renderPreview();}catch(error){showError(error.message||'設定を読み込めませんでした。ブラウザの保存設定を確認してください。');}
$('closing-day').onchange=()=>{$('settings-error').hidden=true;$('settings-status').classList.remove('saved');renderPreview();$('settings-status').textContent=!dirty()?'':'変更はまだ保存されていません。';};
$('settings-form').onsubmit=event=>{event.preventDefault();const value=$('closing-day').value,day=Number(value);if(value===''||!validClosingDay(day)){showError('締め日は1〜30日、または末日から選んでください。');return;}
 try{
 // Read again at save time so entries added in another tab are preserved.
 const latest=readData(),next={...latest,settings:{...latest.settings,closingDay:day,cardSources:selectedSources()}};if(!validData(next))throw Error('設定を保存できませんでした。入力を確認してください。');localStorage.setItem(key,JSON.stringify(next));savedDay=day;savedSources=selectedSources();$('settings-error').hidden=true;renderPreview();$('settings-status').classList.add('saved');$('settings-status').textContent='保存しました。家計簿に戻ると反映されます。';
 }catch(error){showError(error.name==='QuotaExceededError'?'保存容量が不足しています。設定は保存していません。':error.message||'設定を保存できませんでした。ブラウザの保存設定を確認してください。');}
};
function refresh(){try{const data=readData(),untouched=!dirty(),chosen=selectedSources();savedDay=closingDayOf(data);savedSources=[...(data.settings?.cardSources||[])].sort();if(untouched)$('closing-day').value=String(savedDay);renderSources(data,untouched?savedSources:chosen);renderPreview();}catch{showError('ほかの画面の更新を読み込めませんでした。再読み込みしてください。');}}
window.addEventListener('storage',event=>{if(event.key===key)refresh();});window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});
