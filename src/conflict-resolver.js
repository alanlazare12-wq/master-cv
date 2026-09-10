const clone=value=>structuredClone(value);
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value)?value:'';

function uniqueId(prefix,used,idFactory){
  for(let i=0;i<100;i++){
    const candidate=safeId(idFactory?.(prefix));
    if(candidate&&!used.has(candidate)){used.add(candidate);return candidate}
  }
  let n=0,candidate='';
  do{candidate=`${prefix}_${Date.now().toString(36)}_${(n++).toString(36)}`}while(used.has(candidate));
  used.add(candidate);return candidate;
}

function standaloneCareerPack(){return{role:'standalone',masterResumeId:'',masterTitle:'',variantLabel:'',masterRevision:0,linkedAt:null,lastSyncedAt:null}}

function sourceDoc(state,currentId){
  const docs=Array.isArray(state?.documents)?state.documents:[];
  return docs.find(d=>String(d?.id||'')===String(currentId||''))||docs[0]||null;
}

export function resolveConflictState(latestState,localState,localCurrentId,{mode='fork',idFactory=null,now=Date.now(),maxDocuments=500}={}){
  if(!['fork','replace'].includes(mode))throw new Error('Modo de resolución de conflicto no compatible.');
  const latestDocs=Array.isArray(latestState?.documents)?latestState.documents:[],localDoc=sourceDoc(localState,localCurrentId);
  if(!latestDocs.length)throw new Error('La biblioteca durable más reciente no es válida.');
  if(!localDoc?.resume||typeof localDoc.resume!=='object')throw new Error('No hay un CV local válido para recuperar.');
  const next={documents:clone(latestDocs),currentId:String(latestState?.currentId||''),jobText:String(latestState?.jobText||'')};
  const resumeId=String(localDoc.resume.id||''),remoteIndex=next.documents.findIndex(d=>String(d?.resume?.id||'')===resumeId);
  const stamp=Math.max(1,Number(now)||Date.now());

  if(mode==='replace'){
    const resume=clone(localDoc.resume);resume.updatedAt=stamp;
    if(remoteIndex>=0){
      const remote=next.documents[remoteIndex],docId=safeId(remote?.id)||safeId(localDoc.id)||resumeId;
      next.documents[remoteIndex]={id:docId,name:String(resume.title||localDoc.name||'CV'),resume,updatedAt:stamp};next.currentId=docId;
      return{state:next,currentId:docId,resumeId:resume.id,mode,replaced:true};
    }
    if(next.documents.length>=maxDocuments)throw new Error(`La biblioteca alcanzó el límite de ${maxDocuments} CV; no se puede recuperar otro sin eliminar o exportar uno.`);
    const usedDocs=new Set(next.documents.map(d=>String(d?.id||'')).filter(Boolean)),docId=uniqueId('doc',usedDocs,idFactory);
    next.documents.push({id:docId,name:String(resume.title||localDoc.name||'CV'),resume,updatedAt:stamp});next.currentId=docId;
    return{state:next,currentId:docId,resumeId:resume.id,mode,replaced:false};
  }

  if(next.documents.length>=maxDocuments)throw new Error(`La biblioteca alcanzó el límite de ${maxDocuments} CV; no se puede crear la copia de conflicto.`);
  const usedResumes=new Set(next.documents.map(d=>String(d?.resume?.id||'')).filter(Boolean)),usedDocs=new Set(next.documents.map(d=>String(d?.id||'')).filter(Boolean));
  const resume=clone(localDoc.resume),newResumeId=uniqueId('resume',usedResumes,idFactory),docId=uniqueId('doc',usedDocs,idFactory),baseTitle=String(resume.title||localDoc.name||'CV').replace(/\s*·\s*copia recuperada(?:\s*\d+)?$/i,'').trim()||'CV';
  resume.id=newResumeId;resume.title=`${baseTitle} · copia recuperada`;resume.updatedAt=stamp;resume.createdAt=Number(resume.createdAt)||stamp;resume.careerPack=standaloneCareerPack();
  next.documents.push({id:docId,name:resume.title,resume,updatedAt:stamp});next.currentId=docId;
  return{state:next,currentId:docId,resumeId:newResumeId,mode,replaced:false};
}
