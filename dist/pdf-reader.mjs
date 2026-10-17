import {groupWords} from './pdf-model.mjs';
const asset=p=>new URL(p,import.meta.url).href;
export async function readDocument(file,options,onProgress,signal){
 let pdf,task,worker,renderTask,terminated=false;const pages=[];let currentPage=0;
 function check(){if(signal.aborted)throw new DOMException('中止しました','AbortError');}
 const abort=()=>{renderTask?.cancel();task?.destroy();if(worker){terminated=true;worker.terminate();}};
 signal.addEventListener('abort',abort,{once:true});
 try{
 check();onProgress('読み取りの準備中…',0);
 const isPDF=/\.pdf$/i.test(file.name)||file.type==='application/pdf';
 if(isPDF){if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};const pdfjs=await import('./vendor/pdf/pdf.mjs');check();pdfjs.GlobalWorkerOptions.workerSrc=asset('./vendor/pdf/pdf.worker.mjs');task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),password:options.password,cMapUrl:asset('./vendor/pdf/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('./vendor/pdf/standard_fonts/'),isEvalSupported:false});pdf=await task.promise;check();const start=Number(options.start)||1,end=options.end?Number(options.end):pdf.numPages;if(start<1||end<start||end>pdf.numPages||!Number.isInteger(start)||!Number.isInteger(end))throw Error(`PDFは全${pdf.numPages}ページです。ページ範囲を確認してください。`);if(end-start+1>20)throw Error(`全${pdf.numPages}ページあります。一度に20ページまでに分けて読み込んでください。`);
 for(let n=start;n<=end;n++){
 check();currentPage=n;onProgress(`${n} / ${pdf.numPages} ページを読み取り中…`,(n-start)/(end-start+1));const page=await pdf.getPage(n);const content=await page.getTextContent();check();let text=groupWords(content.items.filter(x=>x.str?.trim()).map(x=>({text:x.str,x:x.transform[4],y:-x.transform[5],w:x.width,h:Math.abs(x.height)||10})));let usedOCR=false;
 if(options.mode==='ocr'||(options.mode==='auto'&&text.replace(/\s/g,'').length<50)){
 const base=page.getViewport({scale:1});const scale=Math.min(2.5,Math.sqrt(8000000/(base.width*base.height)));const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 try{renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'});await renderTask.promise;check();text=await recognize(canvas);usedOCR=true;}finally{canvas.width=canvas.height=0;renderTask=null;}
 }
 pages.push({page:n,text,ocr:usedOCR});page.cleanup();
 }
 }else{
 check();currentPage=1;const image=await loadImage(file,signal);check();const scale=Math.min(1,Math.sqrt(8000000/(image.naturalWidth*image.naturalHeight)));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));try{const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);pages.push({page:1,text:await recognize(canvas),ocr:true});}finally{canvas.width=canvas.height=0;image.src='';}
 }
 check();onProgress('読み取りが完了しました',1);return pages;
 async function recognize(canvas){
 check();if(!worker){const {default:Tesseract}=await import('./vendor/ocr/tesseract.esm.min.js');check();worker=await Tesseract.createWorker('jpn+eng',1,{workerPath:asset('./vendor/ocr/worker.min.js'),corePath:asset('./vendor/ocr/core/'),langPath:asset('./vendor/ocr/lang'),workerBlobURL:false,gzip:true,cacheMethod:'none',logger:m=>{if(!signal.aborted){const labels={'loading tesseract core':'文字認識エンジンを準備中','loading language traineddata':'日本語・英語データを読み込み中','initializing api':'OCRを準備中','recognizing text':'文字を認識中'};onProgress(`${currentPage}ページ：${labels[m.status]||'OCRを準備中'} ${Math.round((m.progress||0)*100)}%`,null);}}});check();await worker.setParameters({preserve_interword_spaces:'1'});}
 const result=await abortable(worker.recognize(canvas,{}, {text:true,blocks:true}),signal);check();const words=[];for(const block of result.data.blocks||[])for(const p of block.paragraphs||[])for(const l of p.lines||[])for(const w of l.words||[]){words.push({text:w.text,x:w.bbox.x0,y:(w.bbox.y0+w.bbox.y1)/2,w:w.bbox.x1-w.bbox.x0,h:w.bbox.y1-w.bbox.y0});}return words.length?groupWords(words):result.data.text;
 }
 }catch(e){if(signal.aborted)throw new DOMException('中止しました','AbortError');if(e.name==='PasswordException')throw Error('PDFのパスワードを入力・確認して、再度読み取ってください。');if(e.name==='InvalidPDFException')throw Error('PDFを開けませんでした。正しいPDFファイルを選んでください。');throw e;
 }finally{signal.removeEventListener('abort',abort);if(worker&&!terminated)await worker.terminate();await pdf?.destroy();}
}
function loadImage(file,signal){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),image=new Image();function done(){URL.revokeObjectURL(url);signal.removeEventListener('abort',abort);}function abort(){done();image.src='';reject(new DOMException('中止しました','AbortError'));}signal.addEventListener('abort',abort,{once:true});image.onload=()=>{done();resolve(image);};image.onerror=()=>{done();reject(Error('画像を開けませんでした。PNG・JPEG・WebP形式を選んでください。'));};image.src=url;});}

function abortable(promise,signal){return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('中止しました','AbortError'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
