const randomId=()=>globalThis.crypto?.randomUUID?.()||`tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function createTabSync({channelName='hoja-personal-tabs',onRemoteSave=()=>{}}={}){
  if(typeof globalThis.window==='undefined'||globalThis.window!==globalThis||typeof globalThis.BroadcastChannel!=='function')return null;
  const source=randomId();let channel;
  try{channel=new globalThis.BroadcastChannel(channelName)}catch{return null}
  channel.onmessage=e=>{const m=e?.data;if(!m||m.source===source||m.type!=='resume-saved')return;onRemoteSave(m)};
  return{
    source,
    announce(resumeId,updatedAt){try{channel.postMessage({type:'resume-saved',source,resumeId:String(resumeId||''),updatedAt:Number(updatedAt)||Date.now()})}catch{}},
    close(){try{channel.close()}catch{}}
  };
}
