import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'dist/vendor');
async function copy(from,to){await mkdir(path.dirname(path.join(out,to)),{recursive:true});await cp(path.join(root,'node_modules',from),path.join(out,to),{recursive:true});}
for(const file of ['pdf.mjs','pdf.worker.mjs'])await copy('pdfjs-dist/build/'+file,'pdf/'+file);
for(const file of ['cmaps','standard_fonts','LICENSE'])await copy('pdfjs-dist/'+file,'pdf/'+file);
for(const file of ['tesseract.esm.min.js','worker.min.js','worker.min.js.LICENSE.txt','tesseract.min.js.LICENSE.txt'])await copy('tesseract.js/dist/'+file,'ocr/'+file);
await copy('tesseract.js/LICENSE.md','ocr/LICENSE.md');
for(const file of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','LICENSE'])await copy('tesseract.js-core/'+file,'ocr/core/'+file);
await mkdir(path.join(out,'ocr/lang'),{recursive:true});
for(const [lang,hash] of [['jpn','cac936a50547d9546d48bd6d46372fd89f1ba49209b678cf23ed938092688a28'],['eng','18c1ac52b75e35d44735fb6c2a60acfaf23033524653200738e98f0243edb75b']]){
 const file=path.join(out,'ocr/lang',lang+'.traineddata.gz');let data;try{data=await readFile(file);}catch{}
 if(!data||createHash('sha256').update(data).digest('hex')!==hash){const response=await fetch(`https://tessdata.projectnaptha.com/4.0.0_fast/${lang}.traineddata.gz`);if(!response.ok)throw Error('Failed to download OCR language data');data=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(data).digest('hex')!==hash)throw Error('OCR language data checksum mismatch');await writeFile(file,data);}
}
console.log('PDF・OCRの配信用アセットをdist/vendorに準備しました');
