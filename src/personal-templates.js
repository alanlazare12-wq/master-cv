import {renderResumeHtml as renderBase} from './template-engine-base.js?v=48';

export const PALETTES={
  ink:{label:'Ink',colors:['#111827','#1f2937','#4b5563']},
  slate:{label:'Slate',colors:['#334155','#1e293b','#64748b']},
  emerald:{label:'Emerald',colors:['#0f766e','#134e4a','#0d9488']},
  forest:{label:'Forest',colors:['#166534','#14532d','#15803d']},
  navy:{label:'Navy',colors:['#1e3a5f','#0f2742','#355c7d']},
  cobalt:{label:'Cobalt',colors:['#1d4ed8','#1e40af','#2563eb']},
  violet:{label:'Violet',colors:['#6d28d9','#4c1d95','#7c3aed']},
  plum:{label:'Plum',colors:['#7e22ce','#581c87','#9333ea']},
  terracotta:{label:'Terracotta',colors:['#b45309','#92400e','#c2410c']},
  burgundy:{label:'Burgundy',colors:['#881337','#701a2d','#9f1239']},
  teal:{label:'Teal',colors:['#0f766e','#115e59','#14b8a6']},
  amber:{label:'Amber',colors:['#b45309','#92400e','#f59e0b']}
};

export const TEMPLATE_FAMILIES=[
  {id:'ats',label:'ATS Essential',category:'ATS',risk:'low',layout:'single',font:'Arial',density:'comfortable',margin:'normal',style:'clean',tags:['ATS','General']},
  {id:'classic',label:'Clásica',category:'Profesional',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'normal',style:'classic',tags:['Tradicional','General']},
  {id:'modern',label:'Moderna',category:'Moderna',risk:'low',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'modern',tags:['Moderna','General']},
  {id:'executive',label:'Ejecutiva',category:'Ejecutiva',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'normal',style:'executive',tags:['Liderazgo','Senior']},
  {id:'technical',label:'Técnica',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'comfortable',margin:'normal',style:'technical',tags:['Tecnología','Ingeniería']},
  {id:'academic',label:'Académica',category:'Académica',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'normal',style:'academic',tags:['Investigación','Docencia']},
  {id:'compact',label:'Compacta',category:'Profesional',risk:'medium',layout:'single',font:'Arial',density:'compact',margin:'narrow',style:'compact',tags:['1 página','Densa']},
  {id:'sidebar',label:'Sidebar',category:'Visual',risk:'medium',layout:'dual',font:'Inter',density:'comfortable',margin:'normal',style:'sidebar',tags:['2 columnas','Visual']},
  {id:'editorial',label:'Editorial',category:'Visual',risk:'medium',layout:'single',font:'Georgia',density:'comfortable',margin:'wide',style:'editorial',tags:['Editorial','Portfolio']},
  {id:'creative',label:'Creativa',category:'Creativa',risk:'high',layout:'dual',font:'Inter',density:'comfortable',margin:'normal',style:'creative',tags:['Creativa','Portfolio']},
  {id:'minimal',label:'Minimalista',category:'Moderna',risk:'low',layout:'single',font:'Inter',density:'airy',margin:'wide',style:'minimal',tags:['Minimal','General']},
  {id:'bold',label:'Impacto',category:'Creativa',risk:'medium',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'bold',tags:['Impacto','Personal brand']},
  {id:'corporate',label:'Corporate',category:'Profesional',risk:'low',layout:'single',font:'Arial',density:'comfortable',margin:'normal',style:'corporate',tags:['Corporativo','Operaciones']},
  {id:'consulting',label:'Consultoría',category:'Profesional',risk:'low',layout:'single',font:'Georgia',density:'compact',margin:'normal',style:'consulting',tags:['Consultoría','Estrategia']},
  {id:'finance',label:'Finanzas',category:'Profesional',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'normal',style:'finance',tags:['Finanzas','Banca']},
  {id:'legal',label:'Legal',category:'Profesional',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'wide',style:'legal',tags:['Legal','Gobierno']},
  {id:'healthcare',label:'Healthcare',category:'Profesional',risk:'low',layout:'single',font:'Arial',density:'comfortable',margin:'normal',style:'healthcare',tags:['Salud','Clínico']},
  {id:'developer',label:'Developer',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'developer',tags:['Software','Datos']},
  {id:'product',label:'Producto',category:'Moderna',risk:'low',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'product',tags:['Producto','UX']},
  {id:'data',label:'Data & AI',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'data',tags:['Datos','IA']},
  {id:'engineering',label:'Engineering',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'comfortable',margin:'normal',style:'engineering',tags:['Ingeniería','Sistemas']},
  {id:'marketing',label:'Marketing',category:'Moderna',risk:'medium',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'marketing',tags:['Marketing','Brand']},
  {id:'sales',label:'Sales & Growth',category:'Profesional',risk:'low',layout:'single',font:'Arial',density:'comfortable',margin:'normal',style:'sales',tags:['Ventas','Growth']},
  {id:'operations',label:'Operations',category:'Profesional',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'operations',tags:['Operaciones','Supply']},
  {id:'cybersecurity',label:'Cybersecurity',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'cybersecurity',tags:['Seguridad','SOC','Cloud']},
  {id:'cloud',label:'Cloud & DevOps',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'cloud',tags:['Cloud','DevOps','SRE']},
  {id:'architecture',label:'Architecture',category:'Profesional',risk:'medium',layout:'single',font:'Inter',density:'comfortable',margin:'wide',style:'architecture',tags:['Arquitectura','Diseño','Portfolio']},
  {id:'hr',label:'People & HR',category:'Profesional',risk:'low',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'hr',tags:['RRHH','People','Talent']},
  {id:'education',label:'Educación',category:'Académica',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'normal',style:'education',tags:['Educación','Docencia','Formación']},
  {id:'government',label:'Gobierno',category:'Profesional',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'wide',style:'government',tags:['Gobierno','Política pública','Administración']},
  {id:'nonprofit',label:'Nonprofit',category:'Profesional',risk:'low',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'nonprofit',tags:['ONG','Impacto','Social']},
  {id:'hospitality',label:'Hospitality',category:'Moderna',risk:'low',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'hospitality',tags:['Hospitality','Servicio','Turismo']},
  {id:'aerospace',label:'Aerospace',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'aerospace',tags:['Aeroespacial','Ingeniería','Defense']},
  {id:'automotive',label:'Automotive',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'automotive',tags:['Automotriz','Manufactura','Calidad']},
  {id:'manufacturing',label:'Manufacturing',category:'Profesional',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'manufacturing',tags:['Manufactura','Lean','Calidad']},
  {id:'logistics',label:'Logística',category:'Profesional',risk:'low',layout:'single',font:'Arial',density:'compact',margin:'normal',style:'logistics',tags:['Logística','Supply Chain','Operaciones']},
  {id:'retail',label:'Retail',category:'Moderna',risk:'low',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'retail',tags:['Retail','Comercial','Operaciones']},
  {id:'realestate',label:'Real Estate',category:'Profesional',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'normal',style:'realestate',tags:['Real Estate','Inmobiliario','Ventas']},
  {id:'energy',label:'Energy',category:'Técnica',risk:'low',layout:'single',font:'Arial',density:'comfortable',margin:'normal',style:'energy',tags:['Energía','Industrial','Sostenibilidad']},
  {id:'science',label:'Science & Research',category:'Académica',risk:'low',layout:'single',font:'Georgia',density:'comfortable',margin:'normal',style:'science',tags:['Ciencia','Research','Laboratorio']},
  {id:'portrait-modern',label:'Retrato Moderno',category:'Con foto',risk:'medium',layout:'single',font:'Inter',density:'comfortable',margin:'normal',style:'portrait-modern',photo:true,photoPosition:'left',photoShape:'circle',photoSize:'medium',tags:['Foto','Retrato','Moderna']},
  {id:'portrait-sidebar',label:'Retrato Sidebar',category:'Con foto',risk:'medium',layout:'dual',font:'Inter',density:'comfortable',margin:'normal',style:'portrait-sidebar',photo:true,photoPosition:'sidebar',photoShape:'rounded',photoSize:'large',tags:['Foto','2 columnas','Portfolio']},
  {id:'portrait-executive',label:'Retrato Ejecutivo',category:'Con foto',risk:'medium',layout:'single',font:'Georgia',density:'comfortable',margin:'wide',style:'portrait-executive',photo:true,photoPosition:'right',photoShape:'rounded',photoSize:'medium',tags:['Foto','Ejecutivo','Liderazgo']},
  {id:'portrait-creative',label:'Retrato Creativo',category:'Con foto',risk:'high',layout:'dual',font:'Inter',density:'airy',margin:'normal',style:'portrait-creative',photo:true,photoPosition:'left',photoShape:'circle',photoSize:'large',tags:['Foto','Creativa','Personal brand']}
];

const paletteEntries=Object.entries(PALETTES);
export const PERSONAL_TEMPLATES=TEMPLATE_FAMILIES.flatMap(f=>paletteEntries.map(([pid,p])=>({
  id:`${f.id}-${pid}`,name:`${f.label} ${p.label}`,category:f.category,risk:f.risk,family:f.id,layout:f.layout,font:f.font,style:f.style,
  accent:p.colors[0],accent2:p.colors[1],mutedAccent:p.colors[2],density:f.density,margin:f.margin,
  fontScale:['compact','developer','consulting','data','operations'].includes(f.id) ? .94 : 1,
  lineHeight:['minimal','editorial'].includes(f.id)?'relaxed':f.id==='compact'?'compact':'normal',tags:[...f.tags,p.label],
  photoFriendly:!!f.photo,photoPosition:f.photoPosition||'left',photoShape:f.photoShape||'circle',photoSize:f.photoSize||'medium',
  description:f.risk==='low'?'Diseño conservador con lectura lineal y alta compatibilidad.':f.risk==='medium'?'Más composición visual; revisa siempre la Vista ATS.':'Diseño expresivo para uso humano, portfolio o networking.'
})));

export const TEMPLATE_CATEGORIES=['Todas','ATS','Profesional','Moderna','Ejecutiva','Técnica','Académica','Visual','Creativa','Con foto'];
export const templateById=id=>PERSONAL_TEMPLATES.find(t=>t.id===id)||PERSONAL_TEMPLATES[0];
export const atsRecommended=()=>PERSONAL_TEMPLATES.filter(t=>t.risk==='low'&&t.layout==='single');

export function applyTemplateToResume(resume,id,{preserveOverrides=false}={}){
  const t=templateById(id),old={...resume.settings};delete resume.settings.forgeRecipeId;delete resume.settings.forgeRecipeName;delete resume.settings.forgeRecipeVersion;resume.settings.templateId=t.id;resume.settings.templateFamily=t.family;resume.settings.templateRisk=t.risk;
  if(!preserveOverrides)Object.assign(resume.settings,{layout:t.layout,font:t.font,accent:t.accent,density:t.density,margin:t.margin,fontScale:t.fontScale,lineHeight:t.lineHeight,showPhoto:!!t.photoFriendly,photoPosition:t.photoPosition||resume.settings.photoPosition||'left',photoShape:t.photoShape||resume.settings.photoShape||'circle',photoSize:t.photoSize||resume.settings.photoSize||'medium'});
  else Object.assign(resume.settings,{layout:old.layout||t.layout,font:old.font||t.font,accent:old.accent||t.accent});
  return resume;
}
export function resetTemplateDesign(resume){return applyTemplateToResume(resume,resume.settings.templateId)}
export function applyDesignProfile(resume,profile){
  if(profile==='ats'){if(templateById(resume.settings.templateId).risk!=='low')applyTemplateToResume(resume,'ats-ink');Object.assign(resume.settings,{layout:'single',font:'Arial',density:'comfortable',margin:'normal',fontScale:1,lineHeight:'normal',showIcons:false,showPhoto:false})}
  if(profile==='onepage')Object.assign(resume.settings,{density:'compact',margin:'narrow',fontScale:.91,lineHeight:'compact'});
  if(profile==='presentation')Object.assign(resume.settings,{density:'airy',margin:'wide',fontScale:1.02,lineHeight:'relaxed'});
  return resume;
}
export function renderResumeHtml(resume,options={}){return renderBase(resume,options)}
