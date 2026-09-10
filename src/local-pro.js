import {templateById,applyTemplateToResume} from './personal-templates.js?v=48';
import {estimatePages} from './studio-engine.js?v=48';
import {analyzeResume} from './ats-engine.js?v=48';

const clone=o=>structuredClone(o);
const coreFacts=r=>({basics:clone(r.basics),summary:r.summary,experience:clone(r.experience),education:clone(r.education),skillGroups:clone(r.skillGroups),projects:clone(r.projects),certifications:clone(r.certifications),languages:clone(r.languages),genericSections:clone(r.genericSections),customSections:clone(r.customSections)});

export const RESUME_MODES=[
  {id:'ats-application',name:'ATS Application',description:'Una columna, estructura estándar y evidencia primero.',template:'ats-ink',layout:'single',order:['summary','experience','skills','education','projects','certifications','languages']},
  {id:'recruiter',name:'Recruiter',description:'Lectura humana rápida con logros y skills visibles arriba.',template:'modern-navy',layout:'single',order:['summary','skills','experience','projects','education','certifications','languages']},
  {id:'executive',name:'Executive',description:'Liderazgo, impacto y trayectoria antes que detalle técnico.',template:'executive-burgundy',layout:'single',order:['summary','achievements','experience','skills','education','certifications','languages']},
  {id:'portfolio',name:'Portfolio',description:'Proyectos y presencia visual para networking o portafolio.',template:'product-cobalt',layout:'dual',order:['summary','projects','experience','skills','education','certifications','languages']},
  {id:'academic',name:'Academic',description:'Educación, publicaciones e investigación en primer plano.',template:'academic-navy',layout:'single',order:['summary','education','publications','conferences','experience','skills','certifications','languages']},
  {id:'one-page',name:'One-page',description:'Composición compacta para perfiles que deben caber en una página.',template:'compact-ink',layout:'single',order:['summary','experience','skills','education','projects','certifications','languages']}
];

export function applyResumeMode(resume,modeId){
  const m=RESUME_MODES.find(x=>x.id===modeId)||RESUME_MODES[0],facts=JSON.stringify(coreFacts(resume));
  applyTemplateToResume(resume,m.template);resume.settings.layout=m.layout;resume.settings.resumeMode=m.id;
  const existing=resume.settings.sectionOrder||[];const ordered=[...m.order.filter(x=>existing.includes(x)),...existing.filter(x=>!m.order.includes(x))];resume.settings.sectionOrder=ordered;
  if(m.id==='one-page')Object.assign(resume.settings,{density:'compact',margin:'narrow',fontScale:.9,lineHeight:'compact'});
  if(m.id==='portfolio')Object.assign(resume.settings,{density:'comfortable',margin:'normal',fontScale:1,lineHeight:'normal'});
  if(JSON.stringify(coreFacts(resume))!==facts)throw new Error('Resume mode changed facts');
  return m;
}

export function ensureLayoutComposer(resume){
  const s=resume.settings||(resume.settings={});s.sectionColumns=s.sectionColumns||{};s.pageBreakHints=Array.isArray(s.pageBreakHints)?s.pageBreakHints:[];s.pageStrategy=s.pageStrategy||'auto';s.resumeMode=s.resumeMode||'';return s;
}
export function assignSectionColumn(resume,sectionId,column){ensureLayoutComposer(resume);if(!['main','side','auto'].includes(column))return false;if(column==='auto')delete resume.settings.sectionColumns[sectionId];else resume.settings.sectionColumns[sectionId]=column;return true}
export function togglePageBreak(resume,sectionId){ensureLayoutComposer(resume);const set=new Set(resume.settings.pageBreakHints);set.has(sectionId)?set.delete(sectionId):set.add(sectionId);resume.settings.pageBreakHints=[...set];return set.has(sectionId)}
export function setPageStrategy(resume,strategy){ensureLayoutComposer(resume);resume.settings.pageStrategy=['auto','one','two'].includes(strategy)?strategy:'auto';if(strategy==='one')Object.assign(resume.settings,{density:'compact',margin:'narrow',fontScale:Math.min(.94,resume.settings.fontScale||1),lineHeight:'compact'});return resume.settings.pageStrategy}

const sectionWordMap=resume=>{
  const txt=v=>String(v||'').trim().split(/\s+/).filter(Boolean).length, bullet=xs=>(xs||[]).reduce((n,b)=>n+txt(typeof b==='string'?b:b.text),0),m={};
  m.summary=txt(resume.summary);m.experience=(resume.experience||[]).reduce((n,e)=>n+txt(`${e.title} ${e.company} ${e.location}`)+bullet(e.bullets),0);m.education=(resume.education||[]).reduce((n,e)=>n+txt(`${e.degree} ${e.institution} ${e.details}`),0);m.skills=(resume.skillGroups||[]).reduce((n,g)=>n+txt(g.name)+(g.skills||[]).reduce((a,x)=>a+txt(x),0),0);m.projects=(resume.projects||[]).reduce((n,p)=>n+txt(`${p.name} ${p.role} ${p.description}`)+bullet(p.bullets),0);m.certifications=(resume.certifications||[]).reduce((n,c)=>n+txt(`${c.name} ${c.issuer}`),0);m.languages=(resume.languages||[]).reduce((n,l)=>n+txt(`${l.language} ${l.level}`),0);for(const [id,items] of Object.entries(resume.genericSections||{}))m[id]=(items||[]).reduce((n,it)=>n+txt(`${it.title} ${it.subtitle} ${it.description}`)+bullet(it.bullets),0);for(const s of resume.customSections||[])m[`custom:${s.id}`]=(s.items||[]).reduce((n,it)=>n+txt(`${it.title} ${it.subtitle} ${it.description}`)+bullet(it.bullets),0);return m;
};
export function buildPagePlan(resume){
  ensureLayoutComposer(resume);const estimate=estimatePages(resume),map=sectionWordMap(resume),hidden=new Set(resume.settings.hiddenSections||[]),order=(resume.settings.sectionOrder||[]).filter(id=>!hidden.has(id)&&map[id]>0),breaks=new Set(resume.settings.pageBreakHints),capacity=Math.max(1,estimate.capacity),pages=[{number:1,sections:[],words:0}];let page=pages[0];
  const nextPage=()=>{page={number:pages.length+1,sections:[],words:0};pages.push(page);return page};
  const addChunk=(id,words,column,continuation=false)=>{page.sections.push({id,words,column,continuation});page.words+=words};
  for(const id of order){
    let remaining=map[id]||0,continuation=false;const column=resume.settings.sectionColumns?.[id]||'auto';
    if(breaks.has(id)&&page.sections.length)nextPage();
    while(remaining>0){
      let room=Math.max(0,capacity-page.words);
      if(page.sections.length&&room===0){nextPage();room=capacity}
      if(page.sections.length&&remaining>room&&room<Math.min(80,Math.round(capacity*.12))){nextPage();room=capacity}
      const chunk=Math.min(remaining,Math.max(1,room||capacity));addChunk(id,chunk,column,continuation);remaining-=chunk;continuation=true;if(remaining>0)nextPage();
    }
  }
  if(resume.settings.pageStrategy==='two'&&pages.length===1&&order.length>2){const all=pages[0].sections,total=pages[0].words;let sum=0,cut=1;for(let i=0;i<all.length-1;i++){sum+=all[i].words;if(sum>=total/2){cut=i+1;break}}return{...estimate,pages:[{number:1,sections:all.slice(0,cut),words:all.slice(0,cut).reduce((n,x)=>n+x.words,0)},{number:2,sections:all.slice(cut),words:all.slice(cut).reduce((n,x)=>n+x.words,0)}],forced:true,targetPages:2}}
  return{...estimate,pages,forced:false,targetPages:resume.settings.pageStrategy==='one'?1:resume.settings.pageStrategy==='two'?2:null};
}

export function templateAudit(resume){const t=templateById(resume.settings.templateId),a=analyzeResume(resume,resume.target),issues=[];if(resume.settings.layout==='dual')issues.push('El layout de dos columnas merece revisar la Vista ATS.');if(resume.settings.showPhoto)issues.push('La foto se usa sólo para la versión humana; para portales ATS conviene una variante sin foto.');if((resume.settings.pageBreakHints||[]).length>2)issues.push('Hay varios saltos manuales; verifica que no dejen espacios grandes.');if((resume.settings.fontScale||1)<.9)issues.push('La tipografía está muy reducida.');if(resume.settings.margin==='narrow')issues.push('Márgenes estrechos: comprueba la impresión física.');return{template:t.name,risk:a.metrics.templateRisk,score:a.score,issues,recommendation:a.metrics.templateRisk==='low'?'Adecuada para envío ATS con revisión final.':'Usa la variante ATS sincronizada para portales sensibles.'}}

export function importReview(resume,meta={}){const missing=[];if(!resume.basics?.fullName)missing.push('Nombre');if(!resume.basics?.email)missing.push('Email');if(!(resume.experience||[]).length)missing.push('Experiencia');if(!(resume.skillGroups||[]).some(g=>(g.skills||[]).length))missing.push('Habilidades');const counts={experience:(resume.experience||[]).length,education:(resume.education||[]).length,skills:(resume.skillGroups||[]).flatMap(x=>x.skills||[]).length,projects:(resume.projects||[]).length};let confidence=Number(meta.importConfidence||resume.sourceAudit?.importConfidence||0);if(!confidence)confidence=Math.max(35,100-missing.length*15);return{confidence,missing,counts,engine:meta.extractionEngine||resume.sourceAudit?.extractionEngine||'local',ready:missing.length<=1}}
