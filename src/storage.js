export const MAX_MANUAL_VERSIONS=24;
export const MAX_AUTO_VERSIONS=12;
export const SOFT_STORAGE_BYTES=4*1024*1024;

const clone=o=>structuredClone(o);
const arr=v=>Array.isArray(v)?v:[];

export function readJsonStorage(storage,keys,fallback,validator=null){
  for(const key of Array.isArray(keys)?keys:[keys]){
    try{
      const raw=storage.getItem(key);
      if(raw==null)continue;
      const parsed=JSON.parse(raw);
      if(validator&&!validator(parsed))continue;
      return parsed;
    }catch{}
  }
  return clone(fallback);
}

export function snapshotResume(resume){
  const snap=clone(resume||{});
  snap.versions=[];
  snap.autoVersions=[];
  // La foto vive una sola vez en el CV activo. Duplicarla en cada snapshot puede llenar localStorage rápidamente.
  if(snap.basics&&typeof snap.basics==='object')delete snap.basics.photo;
  if(snap.sourceAudit&&typeof snap.sourceAudit==='object'){
    snap.sourceAudit={...snap.sourceAudit};
    delete snap.sourceAudit.sourceText;
    delete snap.sourceAudit.rawText;
  }
  return snap;
}

function cleanVersion(v,prefix='ver'){
  if(!v||typeof v!=='object')return null;
  const date=Number(v.date)||Date.now();
  const id=typeof v.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v.id)?v.id:`${prefix}_${date}`;
  return {id,date,resume:snapshotResume(v.resume||{})};
}

export function compactResumeHistory(resume,{manual=MAX_MANUAL_VERSIONS,auto=MAX_AUTO_VERSIONS}={}){
  if(!resume||typeof resume!=='object')return resume;
  resume.versions=arr(resume.versions).map(v=>cleanVersion(v,'ver')).filter(Boolean).slice(-Math.max(0,manual));
  resume.autoVersions=arr(resume.autoVersions).map(v=>cleanVersion(v,'auto')).filter(Boolean).slice(-Math.max(0,auto));
  return resume;
}

export function compactState(state,{manual=MAX_MANUAL_VERSIONS,auto=MAX_AUTO_VERSIONS}={}){
  for(const doc of arr(state?.documents))compactResumeHistory(doc?.resume,{manual,auto});
  return state;
}

export function estimateStorageBytes(value){
  try{return JSON.stringify(value).length*2}catch{return Infinity}
}

function isQuotaError(error){
  return error?.name==='QuotaExceededError'||error?.name==='NS_ERROR_DOM_QUOTA_REACHED'||error?.code===22||error?.code===1014;
}

export function persistState(storage,key,state){
  // Never compact/mutate the live application state until persistence has succeeded.
  // Quota recovery works on isolated candidates so a failed save cannot erase history
  // from the current session or from a backup exported afterwards.
  const candidate=clone(state);
  compactState(candidate);
  let raw=JSON.stringify(candidate),bytes=raw.length*2,compacted=false;
  if(bytes>SOFT_STORAGE_BYTES){
    compactState(candidate,{manual:12,auto:6});
    raw=JSON.stringify(candidate);bytes=raw.length*2;compacted=true;
  }
  try{
    storage.setItem(key,raw);
    return{ok:true,bytes,compacted,manualLimit:compacted?12:MAX_MANUAL_VERSIONS,autoLimit:compacted?6:MAX_AUTO_VERSIONS};
  }catch(error){
    if(!isQuotaError(error))return{ok:false,bytes,compacted,error,reason:'storage'};
    const quotaCandidate=clone(candidate);
    compactState(quotaCandidate,{manual:6,auto:2});
    raw=JSON.stringify(quotaCandidate);bytes=raw.length*2;compacted=true;
    try{
      storage.setItem(key,raw);
      return{ok:true,bytes,compacted,quotaRecovered:true,manualLimit:6,autoLimit:2};
    }catch(retryError){
      return{ok:false,bytes,compacted,error:retryError,reason:'quota'};
    }
  }
}


export function persistedResumeTimestamp(storage,key,resumeId){
  try{
    const raw=storage.getItem(key);if(raw==null)return 0;const parsed=JSON.parse(raw),id=String(resumeId||'');
    const doc=(Array.isArray(parsed?.documents)?parsed.documents:[]).find(d=>String(d?.resume?.id||'')===id);
    if(!doc)return 0;return Math.max(Number(doc.updatedAt)||0,Number(doc.resume?.updatedAt)||0);
  }catch{return 0}
}
export function hasNewerPersistedResume(storage,key,resumeId,localUpdatedAt){return persistedResumeTimestamp(storage,key,resumeId)>Math.max(0,Number(localUpdatedAt)||0)}

export function persistJsonValue(storage,key,value){
  try{storage.setItem(key,JSON.stringify(value));return true}catch{return false}
}

export function captureStorage(storage,keys){
  const out={};
  for(const key of Array.isArray(keys)?keys:[keys]){
    try{out[key]=storage.getItem(key)}catch{out[key]=null}
  }
  return out;
}

export function restoreStorage(storage,snapshot){
  let ok=true;
  for(const [key,raw] of Object.entries(snapshot||{})){
    try{raw==null?storage.removeItem(key):storage.setItem(key,raw)}catch{ok=false}
  }
  return ok;
}

export function persistJsonBundle(storage,entries){
  const list=Array.isArray(entries)?entries:[];
  const before=captureStorage(storage,list.map(x=>x.key));
  for(const item of list){
    if(!persistJsonValue(storage,item.key,item.value)){
      restoreStorage(storage,before);
      return{ok:false,reason:'storage'};
    }
  }
  return{ok:true};
}
