import {analyzeResume} from './ats-engine.js?v=48';
import {matchResumeToJob} from './job-engine.js?v=48';
import {templateById,applyTemplateToResume} from './personal-templates.js?v=48';
import {snapshotResume,MAX_AUTO_VERSIONS} from './storage.js?v=48';

const DESIGN_KEYS=['templateId','templateFamily','templateRisk','layout','font','accent','paper','density','fontScale','lineHeight','margin','showIcons','showPhoto','photoShape','photoPosition','photoSize'];
const copy=o=>structuredClone(o);
export const DESIGN_VARIANTS=['ats','presentation'];

export const STUDIO_PACKS=[
  {id:'universal',name:'Universal',industry:'General',ats:'ats-ink',presentation:'modern-navy',note:'Par conservador y versátil para la mayoría de perfiles.'},
  {id:'software',name:'Software & IT',industry:'Tecnología',ats:'developer-ink',presentation:'engineering-cobalt',note:'Jerarquía técnica, stack y logros de ingeniería.'},
  {id:'data',name:'Data & AI',industry:'Datos',ats:'data-ink',presentation:'data-violet',note:'Proyectos, métricas, herramientas y resultados analíticos.'},
  {id:'product',name:'Producto & UX',industry:'Producto',ats:'product-ink',presentation:'product-terracotta',note:'Impacto de producto, research y portfolio.'},
  {id:'executive',name:'Executive',industry:'Liderazgo',ats:'executive-ink',presentation:'executive-burgundy',note:'Autoridad, liderazgo y resultados de negocio.'},
  {id:'finance',name:'Finanzas',industry:'Finanzas',ats:'finance-ink',presentation:'finance-navy',note:'Lectura conservadora y métricas financieras.'},
  {id:'consulting',name:'Consultoría',industry:'Consultoría',ats:'consulting-ink',presentation:'consulting-cobalt',note:'Resultados, clientes, estructura y densidad.'},
  {id:'legal',name:'Legal',industry:'Legal',ats:'legal-ink',presentation:'legal-burgundy',note:'Formato tradicional con una variante elegante.'},
  {id:'healthcare',name:'Healthcare',industry:'Salud',ats:'healthcare-ink',presentation:'healthcare-emerald',note:'Claridad clínica y credenciales visibles.'},
  {id:'sales',name:'Sales & Growth',industry:'Ventas',ats:'sales-ink',presentation:'sales-cobalt',note:'Cuotas, revenue, pipeline y crecimiento.'},
  {id:'marketing',name:'Marketing',industry:'Marketing',ats:'marketing-ink',presentation:'marketing-plum',note:'Campañas, canales, marca y resultados.'},
  {id:'academic',name:'Académico',industry:'Academia',ats:'academic-ink',presentation:'editorial-navy',note:'Investigación, publicaciones y docencia.'},
  {id:'cybersecurity',name:'Cybersecurity',industry:'Seguridad',ats:'cybersecurity-ink',presentation:'cybersecurity-cobalt',note:'Incidentes, controles, cloud, compliance y resultados.'},
  {id:'cloud',name:'Cloud & DevOps',industry:'Infraestructura',ats:'cloud-ink',presentation:'cloud-emerald',note:'Plataformas, reliability, automatización y escala.'},
  {id:'education',name:'Educación',industry:'Educación',ats:'education-ink',presentation:'education-navy',note:'Docencia, programas, resultados y formación.'},
  {id:'nonprofit',name:'Nonprofit',industry:'Impacto social',ats:'nonprofit-ink',presentation:'nonprofit-emerald',note:'Misión, impacto, programas y stakeholders.'}
];

export function captureDesign(resume){const out={};for(const k of DESIGN_KEYS)out[k]=copy(resume.settings?.[k]);return out}
export function applyDesignSnapshot(resume,design){for(const k of DESIGN_KEYS)if(design?.[k]!==undefined)resume.settings[k]=copy(design[k]);return resume}
export function ensureDesignVariants(resume){
  resume.settings.designVariants=resume.settings.designVariants||{};
  resume.settings.activeDesignVariant=resume.settings.activeDesignVariant||'presentation';
  if(!resume.settings.designVariants.presentation)resume.settings.designVariants.presentation=captureDesign(resume);
  if(!resume.settings.designVariants.ats){const temp=copy(resume);applyTemplateToResume(temp,'ats-ink');temp.settings.layout='single';temp.settings.font='Arial';temp.settings.density='comfortable';temp.settings.margin='normal';temp.settings.fontScale=1;temp.settings.lineHeight='normal';temp.settings.showPhoto=false;resume.settings.designVariants.ats=captureDesign(temp)}
  return resume.settings.designVariants;
}
export function saveActiveDesignVariant(resume){ensureDesignVariants(resume);resume.settings.designVariants[resume.settings.activeDesignVariant]=captureDesign(resume);return resume}
export function switchDesignVariant(resume,variant){if(!DESIGN_VARIANTS.includes(variant))return resume;ensureDesignVariants(resume);saveActiveDesignVariant(resume);resume.settings.activeDesignVariant=variant;applyDesignSnapshot(resume,resume.settings.designVariants[variant]);return resume}
export function applyStudioPack(resume,packId){
  const pack=STUDIO_PACKS.find(x=>x.id===packId)||STUDIO_PACKS[0];
  const original=copy(resume),ats=copy(original),presentation=copy(original);
  applyTemplateToResume(ats,pack.ats);ats.settings.layout='single';ats.settings.density='comfortable';ats.settings.margin='normal';ats.settings.fontScale=1;ats.settings.lineHeight='normal';ats.settings.showPhoto=false;
  applyTemplateToResume(presentation,pack.presentation);
  resume.settings.designVariants={ats:captureDesign(ats),presentation:captureDesign(presentation)};
  resume.settings.activeDesignVariant='presentation';resume.settings.studioPackId=pack.id;applyDesignSnapshot(resume,resume.settings.designVariants.presentation);return pack;
}
export function designVariantSummary(resume){ensureDesignVariants(resume);return Object.fromEntries(DESIGN_VARIANTS.map(v=>{const d=resume.settings.designVariants[v],t=templateById(d.templateId);return[v,{template:t.name,risk:t.risk,layout:d.layout,font:d.font}]}))}

const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
const bulletWords=xs=>(xs||[]).reduce((n,b)=>n+words(typeof b==='string'?b:b.text),0);
export function compositionReport(resume){
  const sections=[];
  sections.push({id:'summary',label:'Perfil',words:words(resume.summary)});
  sections.push({id:'experience',label:'Experiencia',words:(resume.experience||[]).reduce((n,e)=>n+words(`${e.title} ${e.company} ${e.location}`)+bulletWords(e.bullets),0)});
  sections.push({id:'education',label:'Educación',words:(resume.education||[]).reduce((n,e)=>n+words(`${e.degree} ${e.institution} ${e.details}`),0)});
  sections.push({id:'skills',label:'Habilidades',words:(resume.skillGroups||[]).reduce((n,g)=>n+words(g.name)+(g.skills||[]).reduce((m,x)=>m+words(x),0),0)});
  sections.push({id:'projects',label:'Proyectos',words:(resume.projects||[]).reduce((n,p)=>n+words(`${p.name} ${p.role} ${p.description}`)+bulletWords(p.bullets),0)});
  sections.push({id:'certifications',label:'Certificaciones',words:(resume.certifications||[]).reduce((n,c)=>n+words(`${c.name} ${c.issuer}`),0)});
  sections.push({id:'languages',label:'Idiomas',words:(resume.languages||[]).reduce((n,l)=>n+words(`${l.language} ${l.level}`),0)});
  for(const [id,items] of Object.entries(resume.genericSections||{}))sections.push({id,label:id,words:(items||[]).reduce((n,it)=>n+words(`${it.title} ${it.subtitle} ${it.description}`)+bulletWords(it.bullets),0)});
  for(const s of resume.customSections||[])sections.push({id:`custom:${s.id}`,label:s.title||'Personalizada',words:(s.items||[]).reduce((n,it)=>n+words(`${it.title} ${it.subtitle} ${it.description}`)+bulletWords(it.bullets),0)});
  const visible=sections.filter(s=>!(resume.settings.hiddenSections||[]).includes(s.id)&&s.words>0);const total=visible.reduce((n,s)=>n+s.words,0)||1;
  visible.forEach(s=>{s.share=Math.round(s.words/total*100);s.pressure=s.share>=42?'high':s.share>=28?'medium':'normal'});
  visible.sort((a,b)=>b.words-a.words);
  const tips=[];const exp=visible.find(x=>x.id==='experience');const sum=visible.find(x=>x.id==='summary');
  if(sum?.words>90)tips.push('El perfil profesional es largo; intenta mantenerlo entre 35 y 90 palabras.');
  if(exp?.share>55)tips.push('Experiencia ocupa más de la mitad del documento; prioriza los logros más relevantes para la vacante.');
  if(total>760)tips.push('El contenido supera 760 palabras; revisa si cada detalle aporta evidencia o relevancia.');
  if(total<180)tips.push('El CV todavía es muy breve; puede faltar evidencia profesional o contexto.');
  return{totalWords:total,sections:visible,tips};
}

export function compareVersion(current,versionResume){
  if(!versionResume)return null;const cur=analyzeResume(current,current.target),old=analyzeResume(versionResume,versionResume.target);
  const curMatch=current.target?matchResumeToJob(current,current.target).score:null,oldMatch=versionResume.target?matchResumeToJob(versionResume,versionResume.target).score:null;
  return{ats:{before:old.score,after:cur.score,delta:cur.score-old.score},jobMatch:{before:oldMatch,after:curMatch,delta:curMatch!=null&&oldMatch!=null?curMatch-oldMatch:null},summaryChanged:String(current.summary||'')!==String(versionResume.summary||''),experienceDelta:(current.experience||[]).length-(versionResume.experience||[]).length,skillsDelta:(current.skillGroups||[]).flatMap(x=>x.skills||[]).length-(versionResume.skillGroups||[]).flatMap(x=>x.skills||[]).length};
}

export function maybeAutoSnapshot(resume,now=Date.now(),interval=10*60*1000,max=MAX_AUTO_VERSIONS){
  resume.autoVersions=resume.autoVersions||[];const last=resume.autoVersions.at(-1)?.date||0;if(now-last<interval)return false;
  resume.autoVersions.push({id:`auto_${now}`,date:now,resume:snapshotResume(resume)});if(resume.autoVersions.length>max)resume.autoVersions.splice(0,resume.autoVersions.length-max);return true;
}
