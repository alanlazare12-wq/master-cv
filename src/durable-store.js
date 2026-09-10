const DB_NAME='hoja-personal-durable';
const DB_VERSION=2;
const OBJECT_STORE='snapshots';
const ENVELOPE_SCHEMA=2;

const clone=v=>structuredClone(v);
const num=v=>Number.isFinite(Number(v))?Number(v):0;

export function indexedDbAvailable(){return typeof globalThis.indexedDB!=='undefined'&&globalThis.indexedDB!=null}

function jsonDigest(value){
  let text='';try{text=JSON.stringify(value)}catch{return''}
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return (hash>>>0).toString(16).padStart(8,'0');
}

export function stateLatestTimestamp(state){
  let latest=0;
  for(const doc of Array.isArray(state?.documents)?state.documents:[]){latest=Math.max(latest,num(doc?.updatedAt),num(doc?.resume?.updatedAt))}
  return latest;
}

export function createDurableEnvelope(state,{revision=0,savedAt=Date.now(),appVersion=''}={}){
  const safeState=clone(state);
  return{schema:ENVELOPE_SCHEMA,revision:Math.max(0,Math.trunc(num(revision))),savedAt:Math.max(num(savedAt),stateLatestTimestamp(safeState)),appVersion:String(appVersion||''),digest:jsonDigest(safeState),state:safeState};
}

export function normalizeDurableEnvelope(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  // v44/v45 stored {savedAt,state}. Promote it without invalidating existing recovery data.
  if(value.state&&typeof value.state==='object'&&!Array.isArray(value.state)){
    const envelope={schema:num(value.schema)||1,revision:Math.max(0,Math.trunc(num(value.revision))),savedAt:Math.max(num(value.savedAt),stateLatestTimestamp(value.state)),appVersion:String(value.appVersion||''),digest:String(value.digest||''),state:value.state};
    if(envelope.digest&&envelope.digest!==jsonDigest(envelope.state))return null;
    return envelope;
  }
  // Defensive compatibility for an accidentally stored raw state.
  if(Array.isArray(value.documents))return createDurableEnvelope(value,{revision:0,savedAt:stateLatestTimestamp(value)});
  return null;
}

export function durableEnvelopeValid(value,validator=null){
  const env=normalizeDurableEnvelope(value);if(!env)return false;
  if(validator&&!validator(env.state))return false;
  return true;
}

export function compareDurableEnvelopes(a,b){
  const aa=normalizeDurableEnvelope(a),bb=normalizeDurableEnvelope(b);if(!aa&&!bb)return 0;if(aa&&!bb)return 1;if(!aa&&bb)return-1;
  if(aa.revision!==bb.revision)return aa.revision>bb.revision?1:-1;
  if(aa.savedAt!==bb.savedAt)return aa.savedAt>bb.savedAt?1:-1;
  return 0;
}

export function newestDurableEnvelope(...values){
  let best=null;for(const value of values){const env=normalizeDurableEnvelope(value);if(env&&(!best||compareDurableEnvelopes(env,best)>0))best=env}return best;
}

function openDb(){
  if(!indexedDbAvailable())return Promise.resolve(null);
  return new Promise(resolve=>{
    let req,settled=false;const finish=value=>{if(settled){try{value?.close?.()}catch{}return}settled=true;resolve(value)};
    try{req=globalThis.indexedDB.open(DB_NAME,DB_VERSION)}catch{return finish(null)}
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(OBJECT_STORE))db.createObjectStore(OBJECT_STORE)};
    req.onsuccess=()=>finish(req.result);
    req.onerror=()=>finish(null);
    req.onblocked=()=>finish(null);
  });
}

export async function mirrorState(key,state,meta={}){
  const db=await openDb();if(!db)return{ok:false,reason:'unavailable'};
  const incoming=createDurableEnvelope(state,meta),hasExpected=meta.expectedRevision!==undefined&&meta.expectedRevision!==null,expectedRevision=Math.max(0,Math.trunc(num(meta.expectedRevision)));
  return new Promise(resolve=>{
    try{
      const tx=db.transaction(OBJECT_STORE,'readwrite'),store=tx.objectStore(OBJECT_STORE),req=store.get(String(key));let outcome={ok:false,reason:'transaction'};
      req.onsuccess=()=>{
        const current=normalizeDurableEnvelope(req.result),currentRevision=current?.revision||0;
        if(hasExpected&&currentRevision!==expectedRevision){outcome={ok:true,skipped:true,conflict:true,revision:currentRevision,savedAt:current?.savedAt||0};return}
        if(current&&compareDurableEnvelopes(current,incoming)>0){outcome={ok:true,skipped:true,conflict:true,revision:current.revision,savedAt:current.savedAt};return}
        try{store.put(incoming,String(key));outcome={ok:true,skipped:false,revision:incoming.revision,savedAt:incoming.savedAt}}catch{outcome={ok:false,reason:'write'}}
      };
      req.onerror=()=>{outcome={ok:false,reason:'read'}};
      tx.oncomplete=()=>{try{db.close()}catch{}resolve(outcome)};
      tx.onerror=tx.onabort=()=>{try{db.close()}catch{}resolve({ok:false,reason:'transaction'})};
    }catch{try{db.close()}catch{}resolve({ok:false,reason:'transaction'})}
  });
}

export async function readMirroredState(key){
  const db=await openDb();if(!db)return null;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction(OBJECT_STORE,'readonly'),req=tx.objectStore(OBJECT_STORE).get(String(key));
      req.onsuccess=()=>{const value=normalizeDurableEnvelope(req.result);try{db.close()}catch{}resolve(value)};
      req.onerror=()=>{try{db.close()}catch{}resolve(null)};
    }catch{try{db.close()}catch{}resolve(null)}
  });
}

export async function removeMirroredState(key){
  const db=await openDb();if(!db)return false;
  return new Promise(resolve=>{
    try{const tx=db.transaction(OBJECT_STORE,'readwrite');tx.objectStore(OBJECT_STORE).delete(String(key));tx.oncomplete=()=>{try{db.close()}catch{}resolve(true)};tx.onerror=tx.onabort=()=>{try{db.close()}catch{}resolve(false)}}catch{try{db.close()}catch{}resolve(false)}
  });
}
