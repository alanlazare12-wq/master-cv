import {analyzeResume} from './ats-engine.js?v=48';
import {matchResumeToJob} from './job-engine.js?v=48';
import {templateAudit,buildPagePlan} from './local-pro.js?v=48';
import {writingCoach,exportIntegrityAudit,factFingerprint,pageQuality} from './local-premium.js?v=48';

const clone=o=>structuredClone(o);
const uid=(p='wb')=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const arr=v=>Array.isArray(v)?v:[];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function digest(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

export const WORKBENCH_VERSION=1;
export const PROFILE_LIMIT=40;
export const TEST_CASE_LIMIT=40;
export const RELEASE_HISTORY_LIMIT=30;

const SETTINGS_KEYS=[
  'templateId','templateFamily','templateRisk','layout','font','accent','paper','density','fontScale','lineHeight','margin','showIcons',
  'headerStyle','headingStyle','dividerStyle','contactStyle','sectionOrder','hiddenSections','sectionColumns','pageBreakHints','activeDesignVariant',
  'designVariants','studioPackId','pageStrategy','resumeMode','forgeRecipeId','forgeRecipeName'
];

export function ensureWorkbench(resume){
  const current=resume.workbench&&typeof resume.workbench==='object'?resume.workbench:{};
  if(resume.workbench!==current)resume.workbench=current;
  current.version=WORKBENCH_VERSION;
  current.releaseProfiles=arr(current.releaseProfiles).slice(0,PROFILE_LIMIT);
  current.activeProfileId=current.activeProfileId||null;
  current.testCases=arr(current.testCases).slice(0,TEST_CASE_LIMIT);
  current.releaseHistory=arr(current.releaseHistory).slice(0,RELEASE_HISTORY_LIMIT);
  const gp=current.gatePolicy&&typeof current.gatePolicy==='object'&&!Array.isArray(current.gatePolicy)?current.gatePolicy:{};
  current.gatePolicy={minAts:clamp(Number.isFinite(+gp.minAts)?+gp.minAts:75,0,100),minJobMatch:clamp(Number.isFinite(+gp.minJobMatch)?+gp.minJobMatch:55,0,100),maxPages:clamp(Math.round(Number.isFinite(+gp.maxPages)?+gp.maxPages:2),1,5),minWriting:clamp(Number.isFinite(+gp.minWriting)?+gp.minWriting:60,0,100)};
  return current;
}

function settingsSnapshot(resume){
  const s=resume.settings||{},out={};
  for(const key of SETTINGS_KEYS) if(key in s) out[key]=clone(s[key]);
  return out;
}

export function captureReleaseProfile(resume,name='Perfil de release',purpose='general'){
  const wb=ensureWorkbench(resume),now=Date.now();
  const profile={
    id:uid('profile'),name:String(name||'Perfil de release').trim().slice(0,80)||'Perfil de release',purpose:String(purpose||'general').trim().slice(0,80)||'general',
    createdAt:now,updatedAt:now,target:resume.target?clone(resume.target):null,settings:settingsSnapshot(resume)
  };
  wb.releaseProfiles=[profile,...wb.releaseProfiles].slice(0,PROFILE_LIMIT);wb.activeProfileId=profile.id;return profile;
}

export function applyReleaseProfile(resume,profile){
  if(!profile||typeof profile!=='object')throw new Error('Perfil inválido');
  const before=factFingerprint(resume),wb=ensureWorkbench(resume);
  const ps=profile.settings&&typeof profile.settings==='object'&&!Array.isArray(profile.settings)?profile.settings:{};resume.settings={...(resume.settings||{}),...clone(ps)};resume.target=profile.target?clone(profile.target):null;wb.activeProfileId=profile.id||null;
  if(factFingerprint(resume)!==before)throw new Error('El perfil intentó alterar hechos del CV');
  return resume;
}

export function deleteReleaseProfile(resume,id){
  const wb=ensureWorkbench(resume);wb.releaseProfiles=wb.releaseProfiles.filter(p=>p.id!==id);if(wb.activeProfileId===id)wb.activeProfileId=null;return true;
}

export function createTestCase(resume,{name='Caso de prueba',minAts,minJobMatch,maxPages,expectedRisk='not-high'}={}){
  const wb=ensureWorkbench(resume);if(!resume.target)throw new Error('Analiza una vacante antes de guardar un caso');
  const tc={
    id:uid('test'),name:String(name||'Caso de prueba').trim().slice(0,100)||'Caso de prueba',createdAt:Date.now(),target:clone(resume.target),
    thresholds:{minAts:Number.isFinite(+minAts)?clamp(+minAts,0,100):wb.gatePolicy.minAts,minJobMatch:Number.isFinite(+minJobMatch)?clamp(+minJobMatch,0,100):wb.gatePolicy.minJobMatch,maxPages:Number.isFinite(+maxPages)?clamp(Math.round(+maxPages),1,5):wb.gatePolicy.maxPages,expectedRisk}
  };
  wb.testCases=[tc,...wb.testCases].slice(0,TEST_CASE_LIMIT);return tc;
}

export function deleteTestCase(resume,id){const wb=ensureWorkbench(resume);wb.testCases=wb.testCases.filter(t=>t.id!==id);return true}

export function runTestCase(resume,testCase){
  const r=clone(resume);r.target=clone(testCase.target);const a=analyzeResume(r,r.target),m=matchResumeToJob(r,r.target),plan=buildPagePlan(r),visual=templateAudit(r),th=testCase.thresholds||{};
  const checks=[
    {id:'ats',label:'ATS',value:a.score,threshold:th.minAts??75,pass:a.score>=(th.minAts??75)},
    {id:'match',label:'Job Match',value:m.score,threshold:th.minJobMatch??55,pass:m.score>=(th.minJobMatch??55)},
    {id:'pages',label:'Páginas',value:plan.pages.length,threshold:th.maxPages??2,pass:plan.pages.length<=(th.maxPages??2)},
    {id:'risk',label:'Riesgo visual',value:visual.risk,threshold:th.expectedRisk||'not-high',pass:(th.expectedRisk||'not-high')==='any'||visual.risk!=='high'}
  ];
  return{id:testCase.id,name:testCase.name,pass:checks.every(c=>c.pass),checks,ats:a.score,jobMatch:m.score,pages:plan.pages.length,visualRisk:visual.risk};
}

export function runTestSuite(resume,testCases=null){
  const cases=testCases||ensureWorkbench(resume).testCases,results=cases.map(t=>runTestCase(resume,t));return{total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,pass:results.length>0&&results.every(r=>r.pass),results};
}

function stage(id,label,score,status,detail){return{id,label,score:score==null?null:clamp(Math.round(score),0,100),status,detail}}
function statusFor(score,pass=80,warn=65){return score>=pass?'pass':score>=warn?'warn':'block'}

export function runReleaseGate(resume,policyOverride={}){
  const wb=ensureWorkbench(resume),policy={...wb.gatePolicy,...policyOverride};
  const ats=analyzeResume(resume,resume.target),integrity=exportIntegrityAudit(resume),coach=writingCoach(resume),quality=pageQuality(resume),visual=templateAudit(resume),plan=buildPagePlan(resume);
  const match=resume.target?matchResumeToJob(resume,resume.target):null;
  const basics=resume.basics||{},complete=[basics.fullName,basics.email,resume.summary,(resume.experience||[]).length,(resume.skillGroups||[]).flatMap(g=>g.skills||[]).length].filter(Boolean).length;
  const completeness=Math.round(complete/5*100);
  const pageScore=plan.pages.length<=policy.maxPages&&!quality.pages.some(p=>p.pressure==='high')?100:plan.pages.length<=policy.maxPages+1?70:40;
  const writingScore=coach.items.length?coach.average:70;
  const visualScore=visual.risk==='low'?100:visual.risk==='medium'?78:45;
  const matchScore=match?match.score:null;
  const stages=[
    stage('content','Completitud',completeness,statusFor(completeness,80,60),`${complete}/5 señales esenciales presentes`),
    stage('ats','ATS',ats.score,ats.score>=policy.minAts?'pass':ats.score>=policy.minAts-10?'warn':'block',`mínimo configurado ${policy.minAts}`),
    stage('match','Job Match',matchScore,!match?'info':match.score>=policy.minJobMatch?'pass':match.score>=policy.minJobMatch-10?'warn':'block',match?`mínimo ${policy.minJobMatch}`:'Sin vacante objetivo: no bloquea'),
    stage('integrity','Integridad de exportación',integrity.score,integrity.sameFacts&&integrity.sameText?'pass':'block',integrity.sameFacts&&integrity.sameText?'ATS y presentación conservan hechos':'Diferencia entre variantes'),
    stage('writing','Redacción',writingScore,writingScore>=policy.minWriting?'pass':writingScore>=policy.minWriting-10?'warn':'block',`${coach.needsWork.length} bullet(s) con oportunidades`),
    stage('layout','Composición',pageScore,pageScore>=90?'pass':pageScore>=65?'warn':'block',`${plan.pages.length} página(s), máximo ${policy.maxPages}`),
    stage('visual','Riesgo visual',visualScore,visual.risk==='high'?'block':visual.risk==='medium'?'warn':'pass',`${visual.template} · ${visual.risk}`)
  ];
  const weights={content:.12,ats:.2,match:.12,integrity:.2,writing:.12,layout:.12,visual:.12};
  const scoredStages=stages.filter(s=>s.status!=='info'),weightTotal=scoredStages.reduce((n,s)=>n+(weights[s.id]||0),0)||1;
  const score=Math.round(scoredStages.reduce((n,s)=>n+s.score*(weights[s.id]||0),0)/weightTotal);
  const blocks=stages.filter(s=>s.status==='block'),warnings=stages.filter(s=>s.status==='warn');
  const status=blocks.length?'BLOCKED':warnings.length?'REVIEW':'READY';
  return{status,score,ready:status==='READY',stages,blocks,warnings,policy,metrics:{ats:ats.score,jobMatch:match?.score??null,pages:plan.pages.length,writing:writingScore,visualRisk:visual.risk,integrity:integrity.score}};
}

export function recordRelease(resume,label='Release'){
  const wb=ensureWorkbench(resume),gate=runReleaseGate(resume),factHash=digest(factFingerprint(resume)),designHash=digest(JSON.stringify(settingsSnapshot(resume))),targetHash=digest(JSON.stringify(resume.target||null)),releaseHash=digest(`${factHash}|${designHash}|${targetHash}`),record={id:uid('release'),label:String(label||'Release').trim().slice(0,100)||'Release',createdAt:Date.now(),profileId:wb.activeProfileId||null,targetRole:resume.target?.role||'',templateId:resume.settings?.templateId||'',gate:{status:gate.status,score:gate.score,metrics:clone(gate.metrics)},factHash,designHash,targetHash,releaseHash};
  wb.releaseHistory=[record,...wb.releaseHistory].slice(0,RELEASE_HISTORY_LIMIT);return record;
}

export function compareReleaseRecords(a,b){
  if(!a||!b)return null;const ma=a.gate?.metrics||{},mb=b.gate?.metrics||{};const delta=(x,y)=>typeof x==='number'&&typeof y==='number'?x-y:null;
  return{score:delta(a.gate?.score,b.gate?.score),ats:delta(ma.ats,mb.ats),jobMatch:delta(ma.jobMatch,mb.jobMatch),pages:delta(ma.pages,mb.pages),writing:delta(ma.writing,mb.writing),sameFacts:(a.factHash||a.factFingerprint)===(b.factHash||b.factFingerprint),sameDesign:a.designHash&&b.designHash?a.designHash===b.designHash:null,sameRelease:a.releaseHash&&b.releaseHash?a.releaseHash===b.releaseHash:null};
}

export function workbenchSummary(resume){
  const wb=ensureWorkbench(resume),gate=runReleaseGate(resume),suite=runTestSuite(resume);return{profiles:wb.releaseProfiles.length,tests:wb.testCases.length,releases:wb.releaseHistory.length,gateStatus:gate.status,gateScore:gate.score,testPassRate:suite.total?Math.round(suite.passed/suite.total*100):null};
}
