import {cloneResume,uid,normalizeResume} from './schema.js?v=48';
import {canonicalSkills,norm} from './job-engine.js?v=48';

const clone=v=>structuredClone(v);
const FACT_KEYS=['experience','education','skillGroups','projects','certifications','languages','achievements','genericSections','customSections'];

export function ensureCareerPack(resume){
  const cp=resume.careerPack&&typeof resume.careerPack==='object'&&!Array.isArray(resume.careerPack)?resume.careerPack:{};
  resume.careerPack={
    role:['master','variant','standalone'].includes(cp.role)?cp.role:'standalone',
    masterResumeId:String(cp.masterResumeId||''),
    masterTitle:String(cp.masterTitle||'').slice(0,300),
    variantLabel:String(cp.variantLabel||'').slice(0,300),
    masterRevision:Number.isFinite(+cp.masterRevision)?+cp.masterRevision:0,
    linkedAt:Number.isFinite(+cp.linkedAt)?+cp.linkedAt:null,
    lastSyncedAt:Number.isFinite(+cp.lastSyncedAt)?+cp.lastSyncedAt:null
  };
  return resume.careerPack;
}

export function markAsMaster(resume){
  const cp=ensureCareerPack(resume),already=cp.role==='master';cp.role='master';cp.masterResumeId=resume.id;cp.masterTitle=resume.title||'CV Maestro';cp.variantLabel='';if(!already||!cp.masterRevision)cp.masterRevision=Math.max(Date.now(),Number(cp.masterRevision||0)+1);cp.linkedAt=cp.linkedAt||Date.now();cp.lastSyncedAt=cp.lastSyncedAt||Date.now();return cp;
}

const compactHash=value=>{const text=String(value??'');let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return `${text.length}:${(h>>>0).toString(36)}`};
export function careerSharedFingerprint(resume){
  const basics={...(resume?.basics||{})};delete basics.headline;const photo=String(basics.photo||'');basics.photo=photo?compactHash(photo):'';
  const audit=resume?.sourceAudit&&typeof resume.sourceAudit==='object'?resume.sourceAudit:{};const sourceAudit={format:audit.format||'',fileName:audit.fileName||'',importedAt:audit.importedAt||null,engine:audit.engine||''};
  const evidenceVault=(resume?.evidenceVault||[]).map(e=>[e?.id||'',e?.updatedAt||0,e?.verified===true,e?.anchor||'',compactHash(e?.quote||e?.text||'')]);
  const shared={basics,locale:resume?.locale||{},sourceAudit,evidenceVault};for(const key of FACT_KEYS)shared[key]=resume?.[key]||[];return JSON.stringify(shared);
}

export function touchMaster(resume){const cp=ensureCareerPack(resume);if(cp.role==='master')cp.masterRevision=Math.max(Date.now(),Number(cp.masterRevision||0)+1);return cp.masterRevision}

export function createVariantFromMaster(master,{label='',target=null}={}){
  markAsMaster(master);
  const variant=cloneResume(master);variant.id=uid('resume');variant.title=String(label||`${master.title||'CV Maestro'} · variante`).slice(0,500);variant.target=target?clone(target):clone(master.target);
  variant.careerPack={role:'variant',masterResumeId:master.id,masterTitle:master.title||'CV Maestro',variantLabel:variant.title,masterRevision:master.careerPack.masterRevision||master.updatedAt||Date.now(),linkedAt:Date.now(),lastSyncedAt:Date.now()};
  return normalizeResume(variant);
}

export function createTargetedVariantFromMaster(master,{label='',target=null}={}){
  const variant=createVariantFromMaster(master,{label:label||target?.role||'Variante objetivo',target});
  if(!target?.requirements?.length)return variant;
  const reqSkills=new Map(target.requirements.filter(r=>r.type==='skill').map(r=>[r.concept,r.importance==='required'?3:r.importance==='preferred'?2:1]));
  const relevance=text=>{const skills=canonicalSkills(text),n=norm(text);let score=0;for(const [skill,w] of reqSkills){if(skills.includes(skill)||n.includes(norm(skill)))score+=w}return score};
  variant.skillGroups=(variant.skillGroups||[]).map((g,i)=>({...g,__i:i,__score:relevance([g.name,...(g.skills||[])].join(' '))})).sort((a,b)=>b.__score-a.__score||a.__i-b.__i).map(({__i,__score,...g})=>g);
  variant.experience=(variant.experience||[]).map(exp=>({...exp,bullets:[...(exp.bullets||[])].map((b,i)=>({...b,__i:i,__score:relevance(b.text)})).sort((a,b)=>b.__score-a.__score||a.__i-b.__i).map(({__i,__score,...b})=>b)}));
  if(target.role){const original=String(variant.basics?.headline||'').trim();variant.basics.headline=original.toLowerCase().includes(String(target.role).toLowerCase())?original:`${target.role}${original?` | ${original}`:''}`.slice(0,240)}
  variant.careerPack.variantLabel=variant.title;variant.updatedAt=Date.now();return normalizeResume(variant);
}

export function linkedVariants(documents,masterResumeId){return (documents||[]).filter(d=>d?.resume?.careerPack?.role==='variant'&&d.resume.careerPack.masterResumeId===masterResumeId)}
export function findMaster(documents,variant){const id=variant?.careerPack?.masterResumeId;return (documents||[]).find(d=>d?.resume?.id===id)?.resume||null}

export function variantSyncStatus(variant,master){
  if(!variant||!master)return{linked:false,outdated:false};const cp=ensureCareerPack(variant),mp=ensureCareerPack(master);
  const revision=mp.masterRevision||master.updatedAt||0;return{linked:cp.role==='variant'&&cp.masterResumeId===master.id,outdated:(cp.masterRevision||0)<revision,masterRevision:revision,lastSyncedAt:cp.lastSyncedAt||null};
}

export function syncVariantFromMaster(variant,master){
  if(!variant||!master)throw new Error('CV Maestro no disponible');
  const cp=ensureCareerPack(variant),masterCp=ensureCareerPack(master);if(masterCp.role!=='master')markAsMaster(master);if(cp.role!=='variant'||cp.masterResumeId!==master.id)throw new Error('La variante no pertenece a este CV Maestro');
  const keep={title:variant.title,headline:variant.basics?.headline||'',summary:variant.summary,target:clone(variant.target),settings:clone(variant.settings),workbench:clone(variant.workbench),versions:variant.versions,autoVersions:variant.autoVersions,createdAt:variant.createdAt,careerProfile:clone(variant.careerProfile),reviewThreads:clone(variant.reviewThreads),collaboration:clone(variant.collaboration)};
  const masterBasics=clone(master.basics||{});masterBasics.headline=keep.headline;
  variant.basics=masterBasics;
  for(const key of FACT_KEYS)variant[key]=clone(master[key]);
  variant.locale=clone(master.locale);variant.sourceAudit=clone(master.sourceAudit);variant.evidenceVault=clone(master.evidenceVault||[]);
  variant.title=keep.title;variant.summary=keep.summary;variant.target=keep.target;variant.settings=keep.settings;variant.workbench=keep.workbench;variant.versions=keep.versions;variant.autoVersions=keep.autoVersions;variant.createdAt=keep.createdAt;variant.careerProfile=keep.careerProfile;variant.reviewThreads=keep.reviewThreads;variant.collaboration=keep.collaboration;
  variant.careerPack={...cp,masterTitle:master.title||'CV Maestro',masterRevision:masterCp.masterRevision||master.updatedAt||Date.now(),lastSyncedAt:Date.now()};variant.updatedAt=Date.now();return variant;
}
