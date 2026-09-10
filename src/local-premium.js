import {atsTextView,analyzeResume} from './ats-engine.js?v=48';
import {matchResumeToJob} from './job-engine.js?v=48';
import {ensureDesignVariants,switchDesignVariant} from './studio-pro.js?v=48';
import {buildPagePlan,templateAudit} from './local-pro.js?v=48';

const clone=o=>structuredClone(o);
const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean);
const uniq=xs=>[...new Set(xs)];
const ACTION=/^(lider|diseñ|desarroll|implement|cre|aument|redu|optimiz|gestion|coordin|analiz|constru|lanz|dirig|automatiz|mejor|negoci|alcanz|resolv|led|built|created|designed|developed|implemented|improved|reduced|increased|managed|launched|optimized|automated)/i;

export const TEMPLATE_COLLECTIONS=[
  {id:'ats',name:'ATS Essentials',query:['ats','technical','developer','finance','legal','government']},
  {id:'tech',name:'Tech & Data',query:['developer','engineering','data','cybersecurity','cloud','architecture']},
  {id:'business',name:'Business',query:['executive','corporate','consulting','finance','sales','operations']},
  {id:'people',name:'People & Service',query:['hr','education','healthcare','hospitality','nonprofit']},
  {id:'creative',name:'Creative & Portfolio',query:['creative','editorial','product','marketing','minimal','bold']}
];

export function factSnapshot(r){const basics=clone(r.basics||{});delete basics.photo;return {
  basics,summary:r.summary,experience:clone(r.experience),education:clone(r.education),skillGroups:clone(r.skillGroups),projects:clone(r.projects),certifications:clone(r.certifications),languages:clone(r.languages),achievements:clone(r.achievements),genericSections:clone(r.genericSections),customSections:clone(r.customSections)
}}
export function factFingerprint(r){return JSON.stringify(factSnapshot(r))}

export function writingCoach(resume){
  const items=[];
  for(const exp of resume.experience||[])for(const b of exp.bullets||[]){
    const text=String(b.text||'').trim();if(!text)continue;
    const wc=words(text).length,hasMetric=/\b\d+(?:[.,]\d+)?\s*(?:%|x|k|mil|mill[oó]n|usuarios|clientes|equipos|d[ií]as|horas|ms|s)?\b/i.test(text),hasAction=ACTION.test(text);
    const issues=[];if(!hasAction)issues.push('Empieza con un verbo de acción específico.');if(!hasMetric)issues.push('Si existe una cifra real, añade alcance o resultado cuantificable.');if(wc<6)issues.push('Añade contexto: qué hiciste, para quién y con qué resultado.');if(wc>34)issues.push('El bullet es largo; considera dividir o eliminar contexto secundario.');
    const score=Math.max(0,100-(hasAction?0:22)-(hasMetric?0:18)-(wc<6?25:0)-(wc>34?15:0));
    items.push({experienceId:exp.id,bulletId:b.id,company:exp.company,title:exp.title,text,score,issues,skeleton:'[Verbo de acción] + [qué hiciste] + [alcance/contexto] + [resultado real, si existe].'});
  }
  const average=items.length?Math.round(items.reduce((n,x)=>n+x.score,0)/items.length):0;
  return{average,items:items.sort((a,b)=>a.score-b.score),needsWork:items.filter(x=>x.issues.length)};
}

export function snapshotDiff(current,previous){
  if(!previous)return null;
  const curSkills=uniq((current.skillGroups||[]).flatMap(g=>g.skills||[])),oldSkills=uniq((previous.skillGroups||[]).flatMap(g=>g.skills||[]));
  const curBullets=(current.experience||[]).reduce((n,e)=>n+(e.bullets||[]).length,0),oldBullets=(previous.experience||[]).reduce((n,e)=>n+(e.bullets||[]).length,0);
  const curA=analyzeResume(current,current.target),oldA=analyzeResume(previous,previous.target);
  return{
    ats:{before:oldA.score,after:curA.score,delta:curA.score-oldA.score},
    jobMatch:{before:previous.target?matchResumeToJob(previous,previous.target).score:null,after:current.target?matchResumeToJob(current,current.target).score:null},
    content:{summaryChanged:String(current.summary||'')!==String(previous.summary||''),experienceDelta:(current.experience||[]).length-(previous.experience||[]).length,bulletDelta:curBullets-oldBullets,skillsAdded:curSkills.filter(x=>!oldSkills.includes(x)),skillsRemoved:oldSkills.filter(x=>!curSkills.includes(x))},
    design:{templateChanged:current.settings?.templateId!==previous.settings?.templateId,layoutChanged:current.settings?.layout!==previous.settings?.layout,fontChanged:current.settings?.font!==previous.settings?.font,marginChanged:current.settings?.margin!==previous.settings?.margin}
  };
}

export function exportIntegrityAudit(resume){
  const original=clone(resume);ensureDesignVariants(original);
  const factsBefore=factFingerprint(original),atsResume=clone(original),presentationResume=clone(original);
  switchDesignVariant(atsResume,'ats');switchDesignVariant(presentationResume,'presentation');
  const atsFacts=factFingerprint(atsResume),presentationFacts=factFingerprint(presentationResume);
  const atsText=atsTextView(atsResume).replace(/\s+/g,' ').trim(),presentationText=atsTextView(presentationResume).replace(/\s+/g,' ').trim();
  const sameFacts=factsBefore===atsFacts&&factsBefore===presentationFacts;
  const sameText=atsText===presentationText;
  const visualAudit=templateAudit(resume),plan=buildPagePlan(resume);
  const issues=[];if(!sameFacts)issues.push('Las variantes ATS y presentación no conservan exactamente los mismos hechos.');if(!sameText)issues.push('La Vista ATS cambia entre variantes de diseño.');if(visualAudit.risk==='high')issues.push('La plantilla actual tiene riesgo visual alto; revisa la Vista ATS antes de enviarla.');if(plan.pages.length>2)issues.push(`El plan estima ${plan.pages.length} páginas; revisa longitud para la vacante objetivo.`);
  return{score:Math.max(0,100-(sameFacts?0:45)-(sameText?0:35)-(visualAudit.risk==='high'?12:visualAudit.risk==='medium'?5:0)-(plan.pages.length>2?8:0)),sameFacts,sameText,visualRisk:visualAudit.risk,pages:plan.pages.length,issues};
}

export function pageQuality(resume){
  const plan=buildPagePlan(resume),a=analyzeResume(resume,resume.target);const pages=plan.pages.map(p=>({number:p.number,words:p.words,sections:p.sections.length,pressure:p.words>650?'high':p.words>520?'medium':'normal'}));
  const balance=pages.length<=1?100:Math.max(0,100-Math.round((Math.max(...pages.map(x=>x.words))-Math.min(...pages.map(x=>x.words)))/8));
  return{pages,balance,ats:a.score,recommendation:pages.some(x=>x.pressure==='high')?'Una página está muy cargada; mueve o reduce secciones secundarias.':balance<70?'Las páginas están desbalanceadas; revisa saltos manuales.':'La composición multipágina está razonablemente equilibrada.'};
}
