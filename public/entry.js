(()=>{'use strict';
 const title=document.getElementById('entryTitle'),detail=document.getElementById('entryDetail'),button=document.getElementById('retryEntry');
 let timer=null,busy=false,leaving=false,stopped=false;
 function view(a,b){title.textContent=a;detail.textContent=b;}
 async function check(){
  if(busy||leaving||stopped)return;clearTimeout(timer);busy=true;button.disabled=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/entry',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('unavailable');const state=await response.json();
   let returning=false;try{returning=!!localStorage.getItem('wd-token-'+state.code);}catch{}
   if(state.code&&/^[A-Z0-9]{5}$/.test(state.code)&&state.hostConnected&&(returning||state.status==='lobby'&&state.available>0)){
    leaving=true;view('出走登録へ進みます','自分の番号と名前を選んでください。');location.replace('/?mode=player&room='+encodeURIComponent(state.code)+'&entry=fixed');return;
   }
   if(!state.code)view('受付開始までお待ちください','会場の準備ができると、この画面から自動で出走登録へ進みます。');
   else if(!state.hostConnected)view('会場の接続を待っています','主催者の画面が戻ると自動で確認します。このままお待ちください。');
   else if(state.status==='lobby')view('9人の出走登録がそろいました','新しく参加する方は、司会者にお声がけください。登録済みの方は同じスマホ・ブラウザで開いてください。');
   else view(state.status==='finished'?'次のレースの準備中です':'ただいまレース中です','次の受付が始まるまで、この画面でお待ちください。');
  }catch{view('会場への接続を確認中です','通信状況を確認しながら自動で再接続しています。初回は少し時間がかかることがあります。');}
  finally{clearTimeout(timeout);busy=false;button.disabled=false;if(!leaving&&!stopped)timer=setTimeout(check,3000);}
 }
 button.onclick=check;window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer)});window.addEventListener('pageshow',()=>{stopped=false;check()});window.addEventListener('online',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});check();
})();
