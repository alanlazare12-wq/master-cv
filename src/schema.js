import {CORE_ORDER} from './section-catalog.js?v=48';

export const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const arr = v => Array.isArray(v) ? v : [];
const text=(v,max=12000)=>['string','number','boolean'].includes(typeof v)?String(v).slice(0,max):'';
const textList=(v,maxItems=300,maxLen=300)=>arr(v).slice(0,maxItems).map(x=>text(x,maxLen).trim()).filter(Boolean);
const SAFE_ID=/^[A-Za-z0-9_-]{1,80}$/;
const SAFE_SECTION=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
const PHOTO_DATA_RE=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const cleanPhotoDataUrl=value=>{const v=typeof value==='string'?value:'';return v.length<=180000&&PHOTO_DATA_RE.test(v)?v:''};
export const safeId=(value,prefix='id')=>SAFE_ID.test(String(value||''))?String(value):uid(prefix);
const uniqueId=(value,prefix,seen)=>{let id=safeId(value,prefix);while(seen.has(id))id=uid(prefix);seen.add(id);return id};
const generic = (type,title='') => ({id:uid(type),type,title:text(title,300),subtitle:'',location:'',startDate:'',endDate:'',url:'',description:'',bullets:[]});
const cleanGeneric=(it,type,id)=>({id,type,title:text(it?.title,500),subtitle:text(it?.subtitle,500),location:text(it?.location,500),startDate:text(it?.startDate,100),endDate:text(it?.endDate,100),url:text(it?.url,2000),description:text(it?.description,12000),bullets:arr(it?.bullets).slice(0,500).map(b=>text(typeof b==='string'?b:b?.text,12000)).filter(Boolean)});
const cleanSectionToken=(value,customMap=new Map())=>{
  const s=String(value||'');
  if(s.startsWith('custom:')){
    const old=s.slice(7);if(!customMap.has(old))return null;const mapped=customMap.get(old);
    return SAFE_ID.test(mapped)?`custom:${mapped}`:null;
  }
  return SAFE_SECTION.test(s)?s:null;
};
const cleanSectionTitles=(raw,customMap=new Map())=>{const out={};const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};for(const [key,val] of Object.entries(src)){const safe=cleanSectionToken(key,customMap);if(safe)out[safe]=text(val,300)}return out};
const cleanAudit=a=>{
  if(!a||typeof a!=='object')return null;
  return {
    fileName:String(a.fileName||'').slice(0,260),
    detectedSections:arr(a.detectedSections).map(x=>String(x).slice(0,80)).slice(0,40),
    importConfidence:Number.isFinite(+a.importConfidence)?Math.max(0,Math.min(100,+a.importConfidence)):0,
    extractedCharacters:Number.isFinite(+a.extractedCharacters)?Math.max(0,+a.extractedCharacters):0,
    warnings:arr(a.warnings).map(x=>String(x).slice(0,500)).slice(0,40),
    evidence:arr(a.evidence).slice(0,100).map(e=>({field:String(e?.field||'').slice(0,100),detected:!!e?.detected,weight:Number.isFinite(+e?.weight)?Math.max(0,Math.min(100,+e.weight)):0})),
    sourceText:String(a.sourceText||a.rawText||'').slice(0,4000),
    format:String(a.format||'').slice(0,30),
    pages:Number.isFinite(+a.pages)?Math.max(0,+a.pages):null,
    extractionEngine:String(a.extractionEngine||'').slice(0,80)
  };
};
const cleanVersion=(v,prefix)=>{
  if(!v||typeof v!=='object')return null;
  const raw=v.resume&&typeof v.resume==='object'&&!Array.isArray(v.resume)?structuredClone(v.resume):{};delete raw.versions;delete raw.autoVersions;const resume=normalizeResume(raw);resume.versions=[];resume.autoVersions=[];return {id:safeId(v.id,prefix),date:Number.isFinite(+v.date)?+v.date:Date.now(),resume};
};
const clampNum=(value,min,max,fallback)=>Number.isFinite(+value)?Math.max(min,Math.min(max,+value)):fallback;
const PROFILE_SETTING_KEYS=['templateId','templateFamily','templateRisk','layout','font','accent','paper','density','fontScale','lineHeight','margin','showIcons','showPhoto','photoShape','photoPosition','photoSize','photoZoom','photoX','photoY','headerStyle','headingStyle','dividerStyle','contactStyle','sectionOrder','sectionTitles','hiddenSections','sectionColumns','pageBreakHints','activeDesignVariant','designVariants','studioPackId','pageStrategy','resumeMode','forgeRecipeId','forgeRecipeName','forgeRecipeVersion'];
const cleanDesignSnapshot=(raw,defaults)=>{
  const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  return {
    templateId:SAFE_ID.test(String(v.templateId||''))?String(v.templateId):defaults.templateId,
    templateFamily:SAFE_SECTION.test(String(v.templateFamily||''))?String(v.templateFamily):defaults.templateFamily,
    templateRisk:['low','medium','high'].includes(v.templateRisk)?v.templateRisk:defaults.templateRisk,
    layout:['single','dual'].includes(v.layout)?v.layout:defaults.layout,
    font:text(v.font||defaults.font,80)||defaults.font,
    accent:/^#[0-9a-f]{6}$/i.test(String(v.accent||''))?String(v.accent):defaults.accent,
    paper:['a4','letter'].includes(v.paper)?v.paper:defaults.paper,
    density:['airy','comfortable','compact'].includes(v.density)?v.density:defaults.density,
    fontScale:clampNum(v.fontScale,.85,1.12,defaults.fontScale),
    lineHeight:['compact','normal','relaxed'].includes(v.lineHeight)?v.lineHeight:defaults.lineHeight,
    margin:['wide','normal','narrow'].includes(v.margin)?v.margin:defaults.margin,
    showIcons:typeof v.showIcons==='boolean'?v.showIcons:defaults.showIcons,
    showPhoto:typeof v.showPhoto==='boolean'?v.showPhoto:defaults.showPhoto,
    photoShape:['circle','rounded','square'].includes(v.photoShape)?v.photoShape:defaults.photoShape,
    photoPosition:['left','right','center','sidebar'].includes(v.photoPosition)?v.photoPosition:defaults.photoPosition,
    photoSize:['small','medium','large'].includes(v.photoSize)?v.photoSize:defaults.photoSize,
    photoZoom:clampNum(v.photoZoom,1,2.5,defaults.photoZoom||1),photoX:clampNum(v.photoX,-50,50,defaults.photoX||0),photoY:clampNum(v.photoY,-50,50,defaults.photoY||0)
  };
};
const cleanProfileSettings=(raw,defaults,customMap)=>{
  const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const out={};
  const order=arr(v.sectionOrder).map(x=>cleanSectionToken(x,customMap)).filter(Boolean),hidden=arr(v.hiddenSections).map(x=>cleanSectionToken(x,customMap)).filter(Boolean),breaks=arr(v.pageBreakHints).map(x=>cleanSectionToken(x,customMap)).filter(Boolean),cols={},sectionTitles=cleanSectionTitles(v.sectionTitles,customMap);
  for(const [key,val] of Object.entries(v.sectionColumns&&typeof v.sectionColumns==='object'&&!Array.isArray(v.sectionColumns)?v.sectionColumns:{})){const safe=cleanSectionToken(key,customMap);if(safe)cols[safe]=['main','side','auto'].includes(val)?val:'auto'}
  const variants={};for(const key of ['ats','presentation'])if(v.designVariants?.[key]&&typeof v.designVariants[key]==='object'&&!Array.isArray(v.designVariants[key]))variants[key]=cleanDesignSnapshot(v.designVariants[key],defaults);
  const normalized={
    templateId:SAFE_ID.test(String(v.templateId||''))?String(v.templateId):defaults.templateId,templateFamily:SAFE_SECTION.test(String(v.templateFamily||''))?String(v.templateFamily):defaults.templateFamily,
    templateRisk:['low','medium','high'].includes(v.templateRisk)?v.templateRisk:defaults.templateRisk,layout:['single','dual'].includes(v.layout)?v.layout:defaults.layout,font:text(v.font||defaults.font,80)||defaults.font,
    accent:/^#[0-9a-f]{6}$/i.test(String(v.accent||''))?String(v.accent):defaults.accent,paper:['a4','letter'].includes(v.paper)?v.paper:defaults.paper,density:['airy','comfortable','compact'].includes(v.density)?v.density:defaults.density,
    fontScale:clampNum(v.fontScale,.85,1.12,defaults.fontScale),lineHeight:['compact','normal','relaxed'].includes(v.lineHeight)?v.lineHeight:defaults.lineHeight,margin:['wide','normal','narrow'].includes(v.margin)?v.margin:defaults.margin,
    showIcons:typeof v.showIcons==='boolean'?v.showIcons:defaults.showIcons,showPhoto:typeof v.showPhoto==='boolean'?v.showPhoto:defaults.showPhoto,photoShape:['circle','rounded','square'].includes(v.photoShape)?v.photoShape:defaults.photoShape,photoPosition:['left','right','center','sidebar'].includes(v.photoPosition)?v.photoPosition:defaults.photoPosition,photoSize:['small','medium','large'].includes(v.photoSize)?v.photoSize:defaults.photoSize,photoZoom:clampNum(v.photoZoom,1,2.5,defaults.photoZoom||1),photoX:clampNum(v.photoX,-50,50,defaults.photoX||0),photoY:clampNum(v.photoY,-50,50,defaults.photoY||0),headerStyle:['line','band','minimal','centered'].includes(v.headerStyle)?v.headerStyle:defaults.headerStyle,headingStyle:['line','caps','pill','plain'].includes(v.headingStyle)?v.headingStyle:defaults.headingStyle,
    dividerStyle:['solid','light','none'].includes(v.dividerStyle)?v.dividerStyle:defaults.dividerStyle,contactStyle:['inline','stacked'].includes(v.contactStyle)?v.contactStyle:defaults.contactStyle,
    sectionOrder:order.length?[...new Set(order)]:[...defaults.sectionOrder],sectionTitles,hiddenSections:[...new Set(hidden)],sectionColumns:cols,pageBreakHints:[...new Set(breaks)],activeDesignVariant:['ats','presentation'].includes(v.activeDesignVariant)?v.activeDesignVariant:defaults.activeDesignVariant,
    designVariants:variants,studioPackId:SAFE_ID.test(String(v.studioPackId||''))?String(v.studioPackId):defaults.studioPackId,pageStrategy:['auto','one','two'].includes(v.pageStrategy)?v.pageStrategy:defaults.pageStrategy,
    resumeMode:SAFE_ID.test(String(v.resumeMode||''))?String(v.resumeMode):'',forgeRecipeId:SAFE_ID.test(String(v.forgeRecipeId||''))?String(v.forgeRecipeId):'',forgeRecipeName:text(v.forgeRecipeName,200),forgeRecipeVersion:clampNum(v.forgeRecipeVersion,0,999,0)
  };
  for(const key of PROFILE_SETTING_KEYS)if(Object.prototype.hasOwnProperty.call(v,key))out[key]=normalized[key];
  return out;
};
const cleanGatePolicy=(raw,defaults)=>{const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return{minAts:clampNum(v.minAts,0,100,defaults.minAts),minJobMatch:clampNum(v.minJobMatch,0,100,defaults.minJobMatch),maxPages:Math.round(clampNum(v.maxPages,1,5,defaults.maxPages)),minWriting:clampNum(v.minWriting,0,100,defaults.minWriting)}};
const cleanTestThresholds=(raw,gate)=>{const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return{minAts:clampNum(v.minAts,0,100,gate.minAts),minJobMatch:clampNum(v.minJobMatch,0,100,gate.minJobMatch),maxPages:Math.round(clampNum(v.maxPages,1,5,gate.maxPages)),expectedRisk:['any','not-high'].includes(v.expectedRisk)?v.expectedRisk:'not-high'}};
const cleanReleaseGate=(raw)=>{const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},m=v.metrics&&typeof v.metrics==='object'&&!Array.isArray(v.metrics)?v.metrics:{};return{status:['READY','REVIEW','BLOCKED'].includes(v.status)?v.status:'REVIEW',score:clampNum(v.score,0,100,0),metrics:{ats:clampNum(m.ats,0,100,0),jobMatch:m.jobMatch==null?null:clampNum(m.jobMatch,0,100,0),pages:Math.round(clampNum(m.pages,0,20,0)),writing:clampNum(m.writing,0,100,0),visualRisk:['low','medium','high'].includes(m.visualRisk)?m.visualRisk:'high',integrity:clampNum(m.integrity,0,100,0)}}};

const cleanTarget=t=>{
  if(!t||typeof t!=='object'||Array.isArray(t))return null;
  const reqIds=new Set();
  const requirements=arr(t.requirements).slice(0,500).map((raw,index)=>{
    const q=typeof raw==='string'?{concept:raw}:raw;if(!q||typeof q!=='object'||Array.isArray(q))return null;
    const concept=text(q.concept,300).trim();if(!concept)return null;
    const type=['skill','experience','education','term'].includes(q.type)?q.type:'term';
    const importance=['required','preferred','context'].includes(q.importance)?q.importance:'context';
    const id=uniqueId(q.id||`req_${index}`,'req',reqIds),confidence=Number.isFinite(+q.confidence)?Math.max(0,Math.min(1,+q.confidence)):0;
    const item={id,type,concept,importance,evidence:text(q.evidence,1200),confidence,line:Number.isFinite(+q.line)?Math.max(0,Math.floor(+q.line)):index};
    if(type==='experience'&&Number.isFinite(+q.value))item.value=Math.max(0,Math.min(100,+q.value));
    if(typeof q.matched==='boolean')item.matched=q.matched;
    if(['matched','partial','missing'].includes(q.status))item.status=q.status;
    return item;
  }).filter(Boolean);
  const body=text(t.text??t.raw,250000);
  return{role:text(t.role,300),company:text(t.company,300),text:body,raw:text(t.raw??body,250000),requirements,skills:[...new Set(textList(t.skills,300,160))].slice(0,300),parsedAt:Number.isFinite(+t.parsedAt)?+t.parsedAt:Date.now()};
};


const cleanCareerPack=(raw,resumeId,title)=>{
  const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const role=['master','variant','standalone'].includes(v.role)?v.role:'standalone';
  return{role,masterResumeId:role==='master'?resumeId:text(v.masterResumeId,100),masterTitle:text(v.masterTitle||title,300),variantLabel:text(v.variantLabel,300),masterRevision:Number.isFinite(+v.masterRevision)?Math.max(0,+v.masterRevision):0,linkedAt:Number.isFinite(+v.linkedAt)?+v.linkedAt:null,lastSyncedAt:Number.isFinite(+v.lastSyncedAt)?+v.lastSyncedAt:null};
};
const cleanEvidenceItem=(v,id)=>({id,type:text(v?.type||'achievement',80),title:text(v?.title||v?.anchor||'Evidencia',300),text:text(v?.text??v?.quote,12000),tags:textList(v?.tags,100,120),anchor:text(v?.anchor,200),quote:text(v?.quote??v?.text,1800),sourceKind:text(v?.sourceKind,80),fileName:text(v?.fileName,260),page:Number.isFinite(+v?.page)&&+v.page>0?Math.floor(+v.page):null,confidence:Number.isFinite(+v?.confidence)?Math.max(0,Math.min(100,+v.confidence)):0,verified:v?.verified===true,createdAt:Number.isFinite(+v?.createdAt)?+v.createdAt:Date.now(),updatedAt:Number.isFinite(+v?.updatedAt)?+v.updatedAt:Date.now()});

export const defaultResume = () => ({
  schemaVersion: 9,
  id: uid('resume'),
  title: 'CV maestro',
  locale: {language:'es',country:'MX'},
  basics: {
    fullName:'Ana García López', headline:'Senior Product Designer', email:'ana.garcia@email.com', phone:'+52 55 1234 5678',
    location:'Ciudad de México, México', linkedin:'linkedin.com/in/anagarcia', website:'anagarcia.design', photo:''
  },
  summary:'Product Designer con 6 años de experiencia creando productos digitales simples, accesibles y centrados en las personas. Especializada en convertir problemas complejos en experiencias claras que mejoran métricas de negocio y adopción.',
  experience:[{
    id:uid('exp'), company:'Nébula Labs', title:'Senior Product Designer', location:'Ciudad de México', startDate:'2022', endDate:'', current:true,
    bullets:[
      {id:uid('b'),text:'Lideré el rediseño del onboarding, aumentando la activación un 28%.'},
      {id:uid('b'),text:'Creé y documenté un design system adoptado por 4 equipos de producto.'},
      {id:uid('b'),text:'Coordiné research continuo con producto e ingeniería para priorizar mejoras de mayor impacto.'}
    ]
  }],
  education:[{id:uid('edu'),institution:'Universidad de Madrid',degree:'Grado en Diseño Digital',startDate:'2014',endDate:'2018',details:''}],
  skillGroups:[{id:uid('skills'),name:'Diseño y producto',skills:['Product Design','UX Research','Figma','Prototipado','Design Systems','Accesibilidad']}],
  projects:[], certifications:[], languages:[{id:uid('lang'),language:'Español',level:'Nativo'}], achievements:[],
  genericSections:{},
  customSections:[],
  settings:{
    templateId:'ats-ink',templateFamily:'ats',templateRisk:'low',layout:'single',font:'Arial',accent:'#111827',paper:'a4',density:'comfortable',fontScale:1,lineHeight:'normal',
    margin:'normal',showIcons:true,showPhoto:false,photoShape:'circle',photoPosition:'left',photoSize:'medium',photoZoom:1,photoX:0,photoY:0,headerStyle:'line',headingStyle:'line',dividerStyle:'light',contactStyle:'inline',sectionOrder:[...CORE_ORDER],sectionTitles:{},hiddenSections:[],sectionColumns:{},pageBreakHints:[],activeDesignVariant:'presentation',designVariants:{},studioPackId:'universal',pageStrategy:'auto',resumeMode:''
  },
  target:null,
  sourceAudit:null,
  careerProfile:{targetRoles:[],seniority:'',industries:[],workModes:[],locationPreference:'',pitch:''},
  evidenceVault:[],
  reviewThreads:[],
  collaboration:{visibility:'workspace',lastReviewedAt:null,reviewStatus:'draft'},
  careerPack:{role:'standalone',masterResumeId:'',masterTitle:'',variantLabel:'',masterRevision:0,linkedAt:null,lastSyncedAt:null},
  versions:[],autoVersions:[],
  workbench:{version:1,releaseProfiles:[],activeProfileId:null,testCases:[],releaseHistory:[],gatePolicy:{minAts:75,minJobMatch:55,maxPages:2,minWriting:60}},
  createdAt:Date.now(), updatedAt:Date.now()
});

export function makeGenericItem(type,title=''){return generic(type,title)}
export function makeCustomSection(title='Sección personalizada'){
  return {id:uid('custom'),title,icon:'＋',items:[generic('custom-item')]};
}

export function normalizeResume(r){
  const d=defaultResume(); if(!r||typeof r!=='object') return d;
  const ids=new Set(),resumeId=uniqueId(r.id,'resume',ids),customMap=new Map();
  const customSections=arr(r.customSections).slice(0,200).map(s=>{
    const old=String(s?.id||''),id=uniqueId(old,'custom',ids);if(!customMap.has(old))customMap.set(old,id);
    return {id,title:text(s?.title,500),icon:text(s?.icon,16),items:arr(s?.items).slice(0,500).map(it=>cleanGeneric(it,'custom-item',uniqueId(it?.id,'custom-item',ids)))};
  });
  const rawOrder=arr(r.settings?.sectionOrder).map(x=>cleanSectionToken(x,customMap)).filter(Boolean);
  for(const s of customSections){const token=`custom:${s.id}`;if(!rawOrder.includes(token))rawOrder.push(token)}
  const hidden=arr(r.settings?.hiddenSections).map(x=>cleanSectionToken(x,customMap)).filter(Boolean);
  const pageBreakHints=arr(r.settings?.pageBreakHints).map(x=>cleanSectionToken(x,customMap)).filter(Boolean);
  const sectionColumns={};
  for(const [key,val] of Object.entries(r.settings?.sectionColumns||{})){
    const safe=cleanSectionToken(key,customMap);if(safe)sectionColumns[safe]=['main','side','auto'].includes(val)?val:'auto';
  }
  const genericSections={};
  for(const [key,items] of Object.entries(r.genericSections||{})){
    const safe=cleanSectionToken(key,customMap);if(!safe||safe.startsWith('custom:'))continue;
    genericSections[safe]=arr(items).slice(0,500).map(it=>cleanGeneric(it,safe,uniqueId(it?.id,safe,ids)));
  }
  const rawSettings=r.settings&&typeof r.settings==='object'&&!Array.isArray(r.settings)?r.settings:{};
  const designVariants={};for(const key of ['ats','presentation']){const v=rawSettings.designVariants?.[key];if(v&&typeof v==='object'&&!Array.isArray(v))designVariants[key]=cleanDesignSnapshot(v,d.settings)}
  const wb=r.workbench&&typeof r.workbench==='object'&&!Array.isArray(r.workbench)?r.workbench:{},profileMap=new Map(),gatePolicy=cleanGatePolicy(wb.gatePolicy,d.workbench.gatePolicy);
  const releaseProfiles=arr(wb.releaseProfiles).slice(0,40).map(p=>{if(!p||typeof p!=='object'||Array.isArray(p))return null;const old=String(p.id||''),id=uniqueId(old,'profile',ids);if(!profileMap.has(old))profileMap.set(old,id);return{id,name:text(p.name||'Perfil de release',100)||'Perfil de release',purpose:text(p.purpose||'general',100)||'general',createdAt:Number.isFinite(+p.createdAt)?+p.createdAt:Date.now(),updatedAt:Number.isFinite(+p.updatedAt)?+p.updatedAt:Date.now(),target:cleanTarget(p.target),settings:cleanProfileSettings(p.settings,d.settings,customMap)}}).filter(Boolean);
  const activeProfileId=profileMap.get(String(wb.activeProfileId||''))||null;
  const testCases=arr(wb.testCases).slice(0,40).map(t=>{if(!t||typeof t!=='object'||Array.isArray(t))return null;const target=cleanTarget(t.target);if(!target)return null;return{id:uniqueId(t.id,'test',ids),name:text(t.name||'Caso de prueba',120)||'Caso de prueba',createdAt:Number.isFinite(+t.createdAt)?+t.createdAt:Date.now(),target,thresholds:cleanTestThresholds(t.thresholds,gatePolicy)}}).filter(Boolean);
  const releaseHistory=arr(wb.releaseHistory).slice(0,30).map(x=>{if(!x||typeof x!=='object'||Array.isArray(x))return null;return{id:uniqueId(x.id,'release',ids),label:text(x.label||'Release',120)||'Release',createdAt:Number.isFinite(+x.createdAt)?+x.createdAt:Date.now(),profileId:profileMap.get(String(x.profileId||''))||null,targetRole:text(x.targetRole,300),templateId:SAFE_ID.test(String(x.templateId||''))?String(x.templateId):'',gate:cleanReleaseGate(x.gate),factHash:text(x.factHash||x.factFingerprint,200)}}).filter(Boolean);
  const merged={
    schemaVersion:9,id:resumeId,title:text(r.title??d.title,500),summary:text(r.summary,30000),
    basics:{fullName:text(r.basics?.fullName??d.basics.fullName,500),headline:text(r.basics?.headline??d.basics.headline,500),email:text(r.basics?.email??d.basics.email,500),phone:text(r.basics?.phone??d.basics.phone,200),location:text(r.basics?.location??d.basics.location,500),linkedin:text(r.basics?.linkedin??d.basics.linkedin,2000),website:text(r.basics?.website??d.basics.website,2000),photo:cleanPhotoDataUrl(r.basics?.photo)}, locale:{language:text(r.locale?.language??d.locale.language,30),country:text(r.locale?.country??d.locale.country,30)}, target:cleanTarget(r.target),
    experience:arr(r.experience).slice(0,500).map(e=>({id:uniqueId(e?.id,'exp',ids),company:text(e?.company,500),title:text(e?.title,500),location:text(e?.location,500),startDate:text(e?.startDate,100),endDate:text(e?.endDate,100),current:!!e?.current,bullets:arr(e?.bullets).slice(0,1000).map(b=>({id:uniqueId(typeof b==='object'&&b?b.id:'','b',ids),text:text(typeof b==='string'?b:b?.text,12000)})).filter(b=>b.text)})),
    education:arr(r.education).slice(0,500).map(e=>({id:uniqueId(e?.id,'edu',ids),institution:text(e?.institution,500),degree:text(e?.degree,500),startDate:text(e?.startDate,100),endDate:text(e?.endDate,100),details:text(e?.details,12000)})),
    skillGroups:arr(r.skillGroups).slice(0,300).map(g=>({id:uniqueId(g?.id,'skills',ids),name:text(g?.name,500),skills:textList(g?.skills,500,300)})),
    projects:arr(r.projects).slice(0,500).map(p=>({id:uniqueId(p?.id,'proj',ids),name:text(p?.name,500),role:text(p?.role,500),description:text(p?.description,12000),url:text(p?.url,2000),startDate:text(p?.startDate,100),endDate:text(p?.endDate,100),bullets:arr(p?.bullets).slice(0,1000).map(b=>({id:uniqueId(typeof b==='object'&&b?b.id:'','b',ids),text:text(typeof b==='string'?b:b?.text,12000)})).filter(b=>b.text)})),
    certifications:arr(r.certifications).slice(0,500).map(c=>({id:uniqueId(c?.id,'cert',ids),name:text(c?.name,500),issuer:text(c?.issuer,500),date:text(c?.date,100),url:text(c?.url,2000)})),
    languages:arr(r.languages).slice(0,300).map(l=>({id:uniqueId(l?.id,'lang',ids),language:text(l?.language,300),level:text(l?.level,300)})),
    achievements:arr(r.achievements).slice(0,500).map(a=>({id:uniqueId(a?.id,'ach',ids),title:text(a?.title,500),description:text(a?.description,12000),date:text(a?.date,100)})),
    genericSections,
    customSections,
    settings:{...d.settings,templateId:SAFE_ID.test(String(rawSettings.templateId||''))?String(rawSettings.templateId):d.settings.templateId,templateFamily:SAFE_SECTION.test(String(rawSettings.templateFamily||''))?String(rawSettings.templateFamily):d.settings.templateFamily,templateRisk:['low','medium','high'].includes(rawSettings.templateRisk)?rawSettings.templateRisk:d.settings.templateRisk,layout:['single','dual'].includes(rawSettings.layout)?rawSettings.layout:d.settings.layout,font:typeof rawSettings.font==='string'?rawSettings.font.slice(0,80):d.settings.font,accent:/^#[0-9a-f]{6}$/i.test(String(rawSettings.accent||''))?String(rawSettings.accent):d.settings.accent,paper:['a4','letter'].includes(rawSettings.paper)?rawSettings.paper:d.settings.paper,density:['airy','comfortable','compact'].includes(rawSettings.density)?rawSettings.density:d.settings.density,fontScale:Number.isFinite(+rawSettings.fontScale)?Math.max(.85,Math.min(1.12,+rawSettings.fontScale)):d.settings.fontScale,lineHeight:['compact','normal','relaxed'].includes(rawSettings.lineHeight)?rawSettings.lineHeight:d.settings.lineHeight,margin:['wide','normal','narrow'].includes(rawSettings.margin)?rawSettings.margin:d.settings.margin,showIcons:typeof rawSettings.showIcons==='boolean'?rawSettings.showIcons:d.settings.showIcons,showPhoto:typeof rawSettings.showPhoto==='boolean'?rawSettings.showPhoto:d.settings.showPhoto,photoShape:['circle','rounded','square'].includes(rawSettings.photoShape)?rawSettings.photoShape:d.settings.photoShape,photoPosition:['left','right','center','sidebar'].includes(rawSettings.photoPosition)?rawSettings.photoPosition:d.settings.photoPosition,photoSize:['small','medium','large'].includes(rawSettings.photoSize)?rawSettings.photoSize:d.settings.photoSize,headerStyle:['line','band','minimal','centered'].includes(rawSettings.headerStyle)?rawSettings.headerStyle:d.settings.headerStyle,headingStyle:['line','caps','pill','plain'].includes(rawSettings.headingStyle)?rawSettings.headingStyle:d.settings.headingStyle,dividerStyle:['solid','light','none'].includes(rawSettings.dividerStyle)?rawSettings.dividerStyle:d.settings.dividerStyle,contactStyle:['inline','stacked'].includes(rawSettings.contactStyle)?rawSettings.contactStyle:d.settings.contactStyle,photoZoom:clampNum(rawSettings.photoZoom,1,2.5,d.settings.photoZoom),photoX:clampNum(rawSettings.photoX,-50,50,d.settings.photoX),photoY:clampNum(rawSettings.photoY,-50,50,d.settings.photoY),forgeRecipeId:SAFE_ID.test(String(rawSettings.forgeRecipeId||''))?String(rawSettings.forgeRecipeId):'',forgeRecipeName:text(rawSettings.forgeRecipeName,200),forgeRecipeVersion:clampNum(rawSettings.forgeRecipeVersion,0,999,0),activeDesignVariant:['ats','presentation'].includes(rawSettings.activeDesignVariant)?rawSettings.activeDesignVariant:d.settings.activeDesignVariant,designVariants,studioPackId:SAFE_ID.test(String(rawSettings.studioPackId||''))?String(rawSettings.studioPackId):d.settings.studioPackId,pageStrategy:['auto','one','two'].includes(rawSettings.pageStrategy)?rawSettings.pageStrategy:d.settings.pageStrategy,resumeMode:SAFE_ID.test(String(rawSettings.resumeMode||''))?String(rawSettings.resumeMode):'',sectionOrder:rawOrder.length?[...new Set(rawOrder)]:[...d.settings.sectionOrder],sectionTitles:cleanSectionTitles(rawSettings.sectionTitles,customMap),hiddenSections:[...new Set(hidden)],sectionColumns,pageBreakHints:[...new Set(pageBreakHints)]},
    sourceAudit:cleanAudit(r.sourceAudit),
    careerProfile:{...d.careerProfile,targetRoles:textList(r.careerProfile?.targetRoles,100,160),industries:textList(r.careerProfile?.industries,100,160),workModes:textList(r.careerProfile?.workModes,30,80),seniority:text(r.careerProfile?.seniority,100),locationPreference:text(r.careerProfile?.locationPreference,200),pitch:text(r.careerProfile?.pitch,4000)},
    evidenceVault:arr(r.evidenceVault).slice(0,500).map(v=>cleanEvidenceItem(v,uniqueId(v?.id,'vault',ids))),
    reviewThreads:arr(r.reviewThreads).slice(0,500).map(t=>({id:uniqueId(t?.id,'review',ids),anchor:text(t?.anchor||'general',200),comment:text(t?.comment,12000),status:t?.status==='resolved'?'resolved':'open',author:text(t?.author||'Reviewer',200),createdAt:Number.isFinite(+t?.createdAt)?+t.createdAt:Date.now(),resolvedAt:Number.isFinite(+t?.resolvedAt)?+t.resolvedAt:null})),
    collaboration:{visibility:text(r.collaboration?.visibility??d.collaboration.visibility,80),lastReviewedAt:Number.isFinite(+r.collaboration?.lastReviewedAt)?+r.collaboration.lastReviewedAt:null,reviewStatus:text(r.collaboration?.reviewStatus??d.collaboration.reviewStatus,80)},
    careerPack:cleanCareerPack(r.careerPack,resumeId,text(r.title??d.title,500)),
    versions:arr(r.versions).slice(-24).map(v=>cleanVersion(v,'ver')).filter(Boolean).map(v=>({...v,id:uniqueId(v.id,'ver',ids)})),
    autoVersions:arr(r.autoVersions).slice(-12).map(v=>cleanVersion(v,'auto')).filter(Boolean).map(v=>({...v,id:uniqueId(v.id,'auto',ids)})),
    workbench:{version:1,releaseProfiles,activeProfileId,testCases,releaseHistory,gatePolicy},
    createdAt:Number.isFinite(+r.createdAt)?+r.createdAt:d.createdAt,updatedAt:Number.isFinite(+r.updatedAt)?+r.updatedAt:d.updatedAt
  };
  return merged;
}

export function migrateLegacy(legacy){
  if(legacy?.schemaVersion===9) return normalizeResume(legacy);
  if(legacy?.schemaVersion===8) return normalizeResume({...legacy,schemaVersion:9});
  if(legacy?.schemaVersion===7) return normalizeResume({...legacy,schemaVersion:9});
  if(legacy?.schemaVersion===6) return normalizeResume({...legacy,schemaVersion:9});
  if(legacy?.schemaVersion===5) return normalizeResume({...legacy,schemaVersion:9});
  if(legacy?.schemaVersion===4) return normalizeResume({...legacy,schemaVersion:9});
  if(legacy?.schemaVersion===3) return normalizeResume({...legacy,schemaVersion:9});
  const r=defaultResume(); if(!legacy) return r;
  if(legacy.schemaVersion===2){return normalizeResume({...legacy,schemaVersion:9,genericSections:{},customSections:[]})}
  r.basics={...r.basics,fullName:legacy.name||r.basics.fullName,headline:legacy.role||legacy.jobTitle||r.basics.headline,location:legacy.location||'',email:legacy.email||'',phone:legacy.phone||'',linkedin:legacy.link||'',website:''};
  r.summary=legacy.summary||'';
  r.experience=[{id:uid('exp'),company:legacy.company||'',title:legacy.jobTitle||legacy.role||'',location:legacy.jobLocation||'',startDate:(legacy.period||'').match(/\b(19|20)\d{2}\b/)?.[0]||'',endDate:'',current:/actual|present/i.test(legacy.period||''),bullets:(legacy.achievements||'').split('\n').filter(Boolean).map(text=>({id:uid('b'),text}))}];
  const edu=(legacy.education||'').split('·').map(x=>x.trim());
  r.education=legacy.education?[{id:uid('edu'),degree:edu[0]||legacy.education,institution:edu[1]||'',startDate:'',endDate:edu.find(x=>/^\d{4}$/.test(x))||'',details:''}]:[];
  r.skillGroups=[{id:uid('skills'),name:'Habilidades',skills:(legacy.skills||'').split(',').map(x=>x.trim()).filter(Boolean)}];
  return normalizeResume(r);
}

export function cloneResume(r){
  const copy=normalizeResume(structuredClone(r)); copy.id=uid('resume');copy.title=`${r.title||'CV'} · copia`;copy.versions=[];copy.autoVersions=[];copy.careerPack={role:'standalone',masterResumeId:'',masterTitle:'',variantLabel:'',masterRevision:0,linkedAt:null,lastSyncedAt:null};copy.createdAt=Date.now();copy.updatedAt=Date.now();return copy;
}
