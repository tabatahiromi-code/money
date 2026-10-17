// Keep the dialog buttons responsive while application modules load.
(function(){
 var ready=false,failed=false;
 function notice(message){document.querySelectorAll('[data-app-status]').forEach(function(el){el.hidden=false;el.querySelector('span').textContent=message;});}
 document.querySelectorAll('[data-app-reload]').forEach(function(button){button.onclick=function(){window.location.reload();};});
 [['csv-open','csv-dialog','csv-close'],['receipt-open','receipt-dialog','receipt-close'],['calculator-open','calculator','calc-close']].forEach(function(pair){
 var button=document.getElementById(pair[0]),dialog=document.getElementById(pair[1]);document.getElementById(pair[2]).addEventListener('click',function(){if(dialog.open&&typeof dialog.close==='function')dialog.close();});
 button.addEventListener('click',function(){if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else{notice('このブラウザではポップアップを開けません。ブラウザを最新版に更新してください。');return;}}if(!ready)notice(failed?'画面の準備に失敗しました。「再読み込み」を押してください。保存した記録は削除されません。':'画面を準備しています。少しお待ちください。');});
 });
 window.addEventListener('money-ready',function(){ready=true;failed=false;document.querySelectorAll('[data-app-status]').forEach(function(el){el.hidden=true;});});
 function failure(){failed=true;notice(ready?'操作を完了できませんでした。入力内容を確認し、もう一度お試しください。繰り返す場合は再読み込みしてください。':'画面の準備に失敗しました。「再読み込み」を押してください。保存した記録は削除されません。');}
 window.addEventListener('error',function(event){if(event instanceof ErrorEvent||event.target&&event.target.tagName==='SCRIPT')failure();},true);
 window.addEventListener('unhandledrejection',failure);
})();
