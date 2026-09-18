import {uid,normalizeResume} from './schema.js?v=48';
const clone=value=>structuredClone(value);

export function chatGptResumeSnapshot(resume){
  const r=clone(resume||{}),basics={...(r.basics||{})};delete basics.photo;
  return{id:String(r.id||"").slice(0,120),title:String(r.title||"").slice(0,500),locale:clone(r.locale||{}),basics,summary:String(r.summary||""),experience:clone(r.experience||[]),education:clone(r.education||[]),skillGroups:clone(r.skillGroups||[]),projects:clone(r.projects||[]),certifications:clone(r.certifications||[]),languages:clone(r.languages||[]),achievements:clone(r.achievements||[]),target:clone(r.target||null),settings:{templateId:r.settings?.templateId||"",layout:r.settings?.layout||"",density:r.settings?.density||"",paper:r.settings?.paper||"",font:r.settings?.font||"",accent:r.settings?.accent||"",fontScale:Number(r.settings?.fontScale)||1,lineHeight:r.settings?.lineHeight||"",margin:r.settings?.margin||"",showIcons:!!r.settings?.showIcons,showPhoto:!!r.settings?.showPhoto,photoShape:r.settings?.photoShape||"",photoPosition:r.settings?.photoPosition||"",photoSize:r.settings?.photoSize||"",headerStyle:r.settings?.headerStyle||"",headingStyle:r.settings?.headingStyle||"",dividerStyle:r.settings?.dividerStyle||"",contactStyle:r.settings?.contactStyle||"",pageStrategy:r.settings?.pageStrategy||""},updatedAt:Number(r.updatedAt)||0};
}

export async function syncChatGptBridge(payload,{signal}={}){
  const response=await fetch('/api/mcp-bridge/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  const body=await response.json();if(!response.ok)throw new Error(body.error||`Error ${response.status}`);return body;
}

export async function disableChatGptBridge(){
  const response=await fetch('/api/mcp-bridge/disable',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const body=await response.json();if(!response.ok)throw new Error(body.error||`Error ${response.status}`);return body;
}

export async function getChatGptBridgeState(){
  const [statusRes,pendingRes]=await Promise.all([fetch('/api/mcp-bridge/status'),fetch('/api/mcp-bridge/pending')]);
  const status=await statusRes.json(),pendingBody=await pendingRes.json();
  if(!statusRes.ok)throw new Error(status.error||`Error ${statusRes.status}`);if(!pendingRes.ok)throw new Error(pendingBody.error||`Error ${pendingRes.status}`);
  return{status,pending:Array.isArray(pendingBody.pending)?pendingBody.pending:[]};
}

export async function resolveChatGptBridgeProposal(id,resolution){
  const response=await fetch('/api/mcp-bridge/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,resolution})});
  const body=await response.json();if(!response.ok)throw new Error(body.error||`Error ${response.status}`);return body;
}

export function bridgeProposalSuggestion(item){return{kind:item?.kind||'',before:String(item?.before||''),after:String(item?.after||''),reason:String(item?.reason||'Propuesta desde ChatGPT Web'),bulletId:String(item?.bulletId||''),experienceId:''}}

export function formatBridgeProposalValue(value){
  if(value===null||value===undefined)return '—';
  if(typeof value==='string')return value;
  try{return JSON.stringify(value,null,2)}catch{return String(value)}
}

export function proposalLocationLabel(resume,item){
  const r=resume||{};if(!item)return'CV actual';
  const path=String(item.path||''),kind=String(item.kind||''),itemId=String(item.itemId||item.bulletId||''),parentId=String(item.parentId||item.experienceId||'');
  if(item.resumeId&&r.id&&String(item.resumeId)!==String(r.id))return'Otro CV · abre el CV correspondiente';
  if(kind==='summary'||path==='summary')return'Perfil profesional → Resumen';
  const findExperience=()=>{let ex=parentId?(r.experience||[]).find(x=>String(x?.id||'')===parentId):null;if(!ex&&itemId)ex=(r.experience||[]).find(x=>(x?.bullets||[]).some(b=>String(b?.id||'')===itemId));return ex};
  if(kind==='bullet'||path==='experience.bullets'){
    const ex=findExperience(),idx=ex?.bullets?.findIndex(b=>String(b?.id||'')===itemId)??-1,company=ex?.company||'Empresa sin nombre',role=ex?.title||'Experiencia';
    return`Experiencia profesional → ${company} → ${role}${idx>=0?` → Logro ${idx+1}`:' → Logro / responsabilidad'}`;
  }
  if(path==='projects.bullets'){
    const project=(r.projects||[]).find(x=>String(x?.id||'')===parentId),idx=project?.bullets?.findIndex(b=>String(b?.id||'')===itemId)??-1;
    return`Proyectos → ${project?.name||'Proyecto'}${idx>=0?` → Logro ${idx+1}`:' → Logro / detalle'}`;
  }
  if(kind!=='edit')return'CV actual';
  const fieldLabels={fullName:'Nombre completo',headline:'Título profesional',email:'Email',phone:'Teléfono',location:'Ubicación',linkedin:'LinkedIn',website:'Sitio / portafolio',role:'Puesto objetivo',templateId:'Plantilla',layout:'Layout',density:'Densidad',paper:'Papel',font:'Tipografía',accent:'Color',fontScale:'Escala tipográfica',lineHeight:'Interlineado',margin:'Márgenes',showIcons:'Iconos',showPhoto:'Foto',photoShape:'Forma de foto',photoPosition:'Posición de foto',photoSize:'Tamaño de foto',headerStyle:'Cabecera',headingStyle:'Títulos',dividerStyle:'Divisores',contactStyle:'Contacto',pageStrategy:'Estrategia de páginas'};
  const field=path.split('.').at(-1)||path;
  if(path.startsWith('basics.'))return`Información personal → ${fieldLabels[field]||field}`;
  if(path.startsWith('target.'))return`Vacante objetivo → ${fieldLabels[field]||field}`;
  if(path.startsWith('settings.'))return`Diseño y plantilla → ${fieldLabels[field]||field}`;
  const collectionLabels={experience:'Experiencia profesional',education:'Educación',skillGroups:'Habilidades',projects:'Proyectos',certifications:'Certificaciones',languages:'Idiomas',achievements:'Logros'};
  if(collectionLabels[path]){
    const collection=Array.isArray(r[path])?r[path]:[],live=collection.find(x=>String(x?.id||'')===itemId),candidate=live||item.after||item.before||{};
    const name=path==='experience'?[candidate.company,candidate.title].filter(Boolean).join(' → '):path==='education'?[candidate.institution,candidate.degree].filter(Boolean).join(' → '):path==='skillGroups'?candidate.name:path==='projects'?candidate.name:path==='certifications'?candidate.name:path==='languages'?candidate.language:candidate.title;
    return`${collectionLabels[path]}${name?` → ${name}`:''}`;
  }
  return`CV → ${path||'Edición estructurada'}`;
}

export function applyBridgeEditProposal(resume,item){
  if(!resume||item?.kind!=='edit')throw new Error('Propuesta estructurada inválida.');
  const op=String(item.op||''),path=String(item.path||''),itemId=String(item.itemId||''),parentId=String(item.parentId||'');
  if(op==='set'){
    const parts=path.split('.');let cursor=resume;
    for(let i=0;i<parts.length-1;i++){const key=parts[i];if(!cursor[key]||typeof cursor[key]!=='object'||Array.isArray(cursor[key]))cursor[key]={};cursor=cursor[key]}
    cursor[parts.at(-1)]=structuredClone(item.after);
  }else if(op==='upsert'||op==='delete'){
    if(path==='experience.bullets'||path==='projects.bullets'){
      const parentCollection=path.startsWith('experience')?'experience':'projects',parent=(resume[parentCollection]||[]).find(x=>x.id===parentId);
      if(!parent)throw new Error('El elemento padre ya no existe.');if(!Array.isArray(parent.bullets))parent.bullets=[];
      const index=parent.bullets.findIndex(x=>String(x?.id||'')===itemId);
      if(op==='delete'){if(index<0)throw new Error('El bullet ya no existe.');parent.bullets.splice(index,1)}
      else{const next=structuredClone(item.after||{});next.id=itemId||next.id||uid('b');if(index>=0)parent.bullets[index]=next;else parent.bullets.push(next)}
    }else{
      if(!Array.isArray(resume[path]))throw new Error('Colección editable no encontrada.');const collection=resume[path],index=collection.findIndex(x=>String(x?.id||'')===itemId);
      if(op==='delete'){if(index<0)throw new Error('El elemento ya no existe.');collection.splice(index,1)}
      else{const prefixes={experience:'exp',education:'edu',skillGroups:'skills',projects:'proj',certifications:'cert',languages:'lang',achievements:'ach'};const next=structuredClone(item.after||{});next.id=itemId||next.id||uid(prefixes[path]||'item');if(index>=0)collection[index]=next;else collection.push(next)}
    }
  }else throw new Error('Operación de edición no soportada.');
  const normalized=normalizeResume(structuredClone(resume));for(const key of Object.keys(resume))delete resume[key];Object.assign(resume,normalized);return true;
}

export function praxisNodeConnectionGuide(status={}){
  const masterCvMcpEndpoint=String(status.mcpEndpoint||'http://127.0.0.1:4173/mcp');
  const praxisNodeDefaultMcpEndpoint=String(status.praxisNodeDefaultMcpEndpoint||'http://127.0.0.1:47321/mcp');
  const defaultTunnelProfile=String(status.praxisNodeTunnelProfile||'praxisnode');
  return{masterCvMcpEndpoint,praxisNodeDefaultMcpEndpoint,defaultTunnelProfile,defaultDetected:status.praxisNodeDefaultDetected===true,detectionScope:String(status.praxisNodeDetectionScope||'default-instance-local-mcp-only'),secondaryInstanceNote:'Las instancias secundarias de PraxisNode usan su propio endpoint MCP y perfil de túnel.'};
}
