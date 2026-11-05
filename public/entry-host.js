(()=>{'use strict';
 const $=id=>document.getElementById(id),STORE='wd-entry-organizer';
 window.FixedEntryHost=class{
  constructor({request,notify}){
   this.request=request;this.notify=notify;this.busy=false;this.key='';
   const fragment=new URLSearchParams((location.hash||'').slice(1)),incoming=fragment.get('organizer');
   try{this.key=localStorage.getItem(STORE)||'';}catch{}
   if(incoming&&/^[a-f0-9]{48}$/.test(incoming)){this.key=incoming;try{localStorage.setItem(STORE,incoming);}catch{}fragment.delete('organizer');history.replaceState({},'',location.pathname+location.search+(fragment.size?'#'+fragment.toString():''));}
   $('organizerNotice').classList.toggle('hidden',!this.key);
   $('entryPublish').onclick=()=>this.set(true);$('entryClose').onclick=()=>this.set(false);
  }
  update(mode,room,connected){
   this.mode=mode;this.room=room;this.connected=connected;
   const host=mode==='host'&&!!room,active=!!room?.fixedEntry;
   $('fixedEntryPanel').classList.toggle('hidden',!host);
   $('entryPublish').classList.toggle('hidden',!this.key||active);
   $('entryClose').classList.toggle('hidden',!this.key||!active);
   $('entryPublish').disabled=this.busy||!connected||room?.status!=='lobby';
   $('entryClose').disabled=this.busy||!connected;
   $('entryHostStatus').textContent=active?(room.status==='lobby'?'本番QR：受付中 · この部屋につながります':'本番QR：この部屋に設定済み · 新しい参加者は次の受付を待機中'):this.key?'本番QRは未設定です。参加者を迎える部屋で「本番QRの受付開始」を押してください。':'固定QRを使う場合は、主催者専用リンクからこのPCを設定してください。';
  }
  async set(enabled){
   if(this.busy||this.mode!=='host'||!this.connected||!this.key)return;
   if(!enabled&&!window.confirm('固定QRの受付を終了しますか？ 参加済みの人やレースには影響しません。'))return;
   this.busy=true;this.update(this.mode,this.room,this.connected);
   try{
    let result=await this.request('publishEntry',{enabled,key:this.key});
    if(result?.error==='ENTRY_CONFLICT'&&window.confirm('固定QRは別の部屋（'+result.currentCode+'）につながっています。この部屋に切り替えますか？'))result=await this.request('publishEntry',{enabled,key:this.key,replaceCode:result.currentCode});
    if(result?.ok)this.notify(enabled?'本番QRの受付を開始しました。配布済みのQRから参加できます。':'本番QRの受付を終了しました。');
    else if(result?.error!=='ENTRY_CONFLICT')this.notify(({ENTRY_AUTH:'主催者専用リンクをもう一度開いてください。',ENTRY_RACING:'別の本番レースが進行中です。終了してから切り替えてください。',ENTRY_PRACTICE:'試走は本番QRに設定できません。',ENTRY_NOT_YOURS:'現在の受付先が変わっています。',INVALID_STATE:'発走前の部屋で受付を開始してください。'})[result?.error]||'受付の変更に失敗しました。接続を確認して再度お試しください。');
   }finally{this.busy=false;this.update(this.mode,this.room,this.connected);}
  }
 };
})();
