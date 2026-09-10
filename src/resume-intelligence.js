import {normalizeResume} from './schema.js?v=48';
import {analyzeResume} from './ats-engine.js?v=48';
import {matchResumeToJob,canonicalSkills} from './job-engine.js?v=48';
import {writingCoach,pageQuality} from './local-premium.js?v=48';
import {evidenceSummary} from './evidence.js?v=48';
import {estimatePages} from './studio-engine.js?v=48';

const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean);
const metric=/\b\d+(?:[.,]\d+)?\s*(?:%|x|k|m|mil|mill[oó]n(?:es)?|usuarios?|clientes?|equipos?|d[ií]as?|horas?|minutos?|semanas?|meses?|a[nñ]os?)(?=\s|[.,;:)]|$)/i;
const placeholder=/\b(?:example\.com|example|lorem|ipsum|tu correo|correo@|123[- ]?456|000[- ]?000|nombre completo|company name|empresa ejemplo)\b/i;
const badUrl=v=>{if(!v)return false;try{const u=new URL(/^https?:\/\//i.test(v)?v:`https://${v}`);return !u.hostname.includes('.')}catch{return true}};
const roleFamily=text=>{const value=String(text||'');const roles=[['designer',/\b(?:product designer|ux designer|ui designer|diseñador(?:a)? (?:de producto|ux|ui))\b/i],['developer',/\b(?:desarrollador(?:a)?|developer|software engineer|ingeniero(?:a)? de software|full[ -]?stack|front[ -]?end|back[ -]?end)\b/i],['data',/\b(?:data engineer|data analyst|data scientist|ingeniero(?:a)? de datos|analista de datos|científico(?:a)? de datos)\b/i],['product',/\b(?:product manager|product owner|gerente de producto)\b/i],['project',/\b(?:project manager|gerente de proyecto|jefe de proyecto)\b/i],['qa',/\b(?:qa engineer|quality assurance|software tester|ingeniero(?:a)? de calidad)\b/i],['devops',/\b(?:devops|site reliability engineer|sre|cloud engineer)\b/i]];return roles.find(([,rx])=>rx.test(value))?.[0]||''};
const roleLabel={designer:'diseño de producto/UX',developer:'desarrollo de software',data:'datos',product:'gestión de producto',project:'gestión de proyectos',qa:'QA/calidad',devops:'DevOps/cloud'};

export function impactQuestions(resume,{limit=12}={}){
  const out=[];
  for(const exp of resume?.experience||[]){
    for(const bullet of exp.bullets||[]){
      const text=String(bullet?.text||'').trim();if(!text||metric.test(text))continue;
      const skills=canonicalSkills(text).slice(0,3),subject=skills.length?skills.join(', '):'este trabajo';
      let question=`¿Qué resultado concreto produjo ${subject} en ${exp.company||exp.title||'esta experiencia'}?`;
      if(/migr|moderniz/i.test(text))question='¿Cuántos sistemas, módulos o usuarios estuvieron involucrados en esta migración y qué mejoró después?';
      else if(/optimiz|rendimiento|performance|sql|procedim/i.test(text))question='¿Puedes medir la mejora: tiempo de respuesta, consultas, procesos, incidencias o ahorro de tiempo?';
      else if(/docker|deploy|desplieg|ci\/?cd|devops/i.test(text))question='¿Qué cambió en despliegues: frecuencia, tiempo, errores, ambientes o cantidad de servicios?';
      else if(/desarroll|implement|cre[ée]|aplicaci/i.test(text))question='¿Cuántos módulos, aplicaciones, usuarios o procesos cubrió esta solución y qué problema resolvió?';
      out.push({experienceId:exp.id,bulletId:bullet.id,company:exp.company||'',title:exp.title||'',text,question,skills});
      if(out.length>=limit)return out;
    }
  }
  return out;
}

export function interviewQuestions(resume,{limit=12}={}){
  const out=[],seen=new Set(),add=(question,context='')=>{const q=String(question||'').trim();if(!q||seen.has(q)||out.length>=limit)return;seen.add(q);out.push({question:q,context})};
  for(const exp of resume?.experience||[]){
    add(`Cuéntame sobre tu trabajo como ${exp.title||'profesional'} en ${exp.company||'esta empresa'}: ¿qué problema principal resolvías y cuál era tu responsabilidad directa?`,exp.company||'Experiencia');
    for(const bullet of (exp.bullets||[]).slice(0,3)){const text=String(bullet?.text||''),skills=canonicalSkills(text);if(skills.length)add(`Describe un caso concreto en el que utilizaste ${skills.slice(0,2).join(' y ')}. ¿Qué decisión técnica tomaste y por qué?`,exp.company||'Experiencia');if(/migr|moderniz/i.test(text))add('Explícame una migración de sistema legado de principio a fin: riesgos, estrategia, validación y resultado.',exp.company||'Experiencia');if(/docker|deploy|ci\/?cd/i.test(text))add('¿Cómo estructuraste el despliegue con Docker y qué problemas operativos resolvió?',exp.company||'Experiencia');if(/sql|procedim|base de datos/i.test(text))add('Dame un ejemplo de una consulta, procedimiento o problema de SQL que hayas optimizado y cómo verificaste la mejora.',exp.company||'Experiencia')}
  }
  if(resume?.target){const match=matchResumeToJob(resume,resume.target);for(const req of match.matched.filter(x=>x.importance==='required').slice(0,4))add(`La vacante considera ${req.concept} un requisito. ¿Qué ejemplo de tu CV demuestra mejor tu dominio y qué aprendiste de ese caso?`,'Vacante objetivo')}
  return out.slice(0,limit);
}

export function exportChecklist(resume){
  const r=resume||{},b=r.basics||{},ats=analyzeResume(r,r.target),pages=estimatePages(r),impact=impactQuestions(r,{limit:99}),totalBullets=(r.experience||[]).flatMap(e=>e.bullets||[]).filter(b=>String(b?.text||'').trim()).length,quantifiedBullets=Math.max(0,totalBullets-impact.length),impactCoverage=totalBullets?quantifiedBullets/totalBullets:0,items=[];
  const add=(id,label,pass,detail,severity='warn')=>items.push({id,label,pass:!!pass,detail,severity:pass?'pass':severity});
  add('name','Nombre completo',words(b.fullName).length>=2,'Usa nombre y apellido.','block');
  add('email','Correo válido',/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email||''),'Revisa el correo antes de enviar.','block');
  add('phone','Teléfono',String(b.phone||'').replace(/\D/g,'').length>=8,'Incluye un teléfono de contacto válido.','warn');
  add('headline','Titular profesional',words(b.headline).length>=2,'Haz visible el rol objetivo y especialidad.','warn');
  add('summary','Perfil profesional',words(r.summary).length>=25&&words(r.summary).length<=110,`${words(r.summary).length} palabras; recomendado 25–110.`,'warn');
  const headlineRole=roleFamily(b.headline),summaryRole=roleFamily(r.summary),roleConsistent=!headlineRole||!summaryRole||headlineRole===summaryRole;add('role-consistency','Coherencia de rol',roleConsistent,roleConsistent?'Titular y perfil no presentan roles profesionales contradictorios.':`El titular apunta a ${roleLabel[headlineRole]||headlineRole}, pero el perfil se describe como ${roleLabel[summaryRole]||summaryRole}. Revisa el texto antes de enviar.`,'block');
  add('experience','Experiencia',Array.isArray(r.experience)&&r.experience.length>0,'Incluye al menos una experiencia relevante.','block');
  add('skills','Skills visibles',(r.skillGroups||[]).flatMap(g=>g.skills||[]).length>=5,'Muestra al menos 5 skills relevantes.','warn');
  add('placeholder','Sin placeholders',!placeholder.test(JSON.stringify({b,summary:r.summary,experience:r.experience})),'Se detectó texto con apariencia de ejemplo/placeholder.','block');
  add('links','Enlaces válidos',![b.linkedin,b.website].filter(Boolean).some(badUrl),'LinkedIn/portafolio deben ser enlaces válidos.','warn');
  add('pages','Paginación',pages.pages<=2,`${pages.pages} página(s) estimada(s).`,'warn');
  add('ats','ATS mínimo',ats.score>=75,`ATS ${ats.score}/100; recomendado ≥75.`,'warn');
  add('impact','Impacto demostrable',totalBullets>0&&quantifiedBullets>=1&&impactCoverage>=.30,totalBullets?`${quantifiedBullets}/${totalBullets} bullet(s) contienen señales cuantificables; recomendado ≥30%.`:'No hay bullets para evaluar impacto.','warn');
  const blocks=items.filter(x=>!x.pass&&x.severity==='block').length,warnings=items.filter(x=>!x.pass&&x.severity==='warn').length;
  return{items,blocks,warnings,ready:blocks===0,score:clamp(items.reduce((n,x)=>n+(x.pass?1:x.severity==='warn'?.45:0),0)/items.length*100)};
}

export function cvScore(resume){
  const ats=analyzeResume(resume,resume?.target),coach=writingCoach(resume),pages=pageQuality(resume),ev=evidenceSummary(resume),match=resume?.target?matchResumeToJob(resume,resume.target):null,check=exportChecklist(resume);
  const supported=(ev.verified||0)+(ev.careerFacts||0),evidence=ev.total?Math.min(100,35+supported/Math.max(1,ev.total)*65):55;
  const layout=pages.pages?.some?.(p=>p.pressure==='high')?55:pages.balance>=80?95:Math.max(65,pages.balance||70);
  const writing=coach.items.length?coach.average:70;
  const components={ats:ats.score,content:ats.scores.content,impact:ats.scores.impact,writing,layout,evidence,preflight:check.score,jobMatch:match?.score??null};
  const weights={ats:.20,content:.14,impact:.16,writing:.14,layout:.10,evidence:.08,preflight:.10,jobMatch:.08};
  const active=Object.entries(components).filter(([,v])=>typeof v==='number'),total=active.reduce((n,[k])=>n+(weights[k]||0),0)||1;
  const score=clamp(active.reduce((n,[k,v])=>n+v*(weights[k]||0),0)/total);
  return{score,components,grade:score>=94?'Excelente':score>=88?'Muy fuerte':score>=80?'Competitivo':score>=70?'Mejorable':'Requiere trabajo',checklist:check};
}

export function printFitProfile(resume){
  const est=estimatePages(resume),bullets=(resume?.experience||[]).reduce((n,e)=>n+(e.bullets||[]).filter(b=>String(b?.text||'').trim()).length,0),entries=(resume?.experience||[]).length+(resume?.education||[]).length+(resume?.projects||[]).length+(resume?.certifications||[]).length+(resume?.languages||[]).length,visible=(resume?.settings?.sectionOrder||[]).filter(x=>!(resume?.settings?.hiddenSections||[]).includes(x)).length;
  const load=est.words+bullets*10+entries*8+visible*20,ratio=load/535;
  const level=ratio<=.72?'light':ratio<=1.10?'medium':'strong';
  return{level,load,ratio:+ratio.toFixed(2),words:est.words,pages:est.pages};
}

export function professionalFilename(resume,ext='pdf'){
  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  const name=clean(resume?.basics?.fullName||resume?.title||'CV'),role=clean(resume?.target?.role||resume?.basics?.headline||'CV').split('_').slice(0,5).join('_');
  const includeRole=role&&role.toLowerCase()!=='cv'&&role.toLowerCase()!==name.toLowerCase();return`${name}${includeRole?`_${role}`:''}_CV.${String(ext||'pdf').replace(/[^a-z0-9]/gi,'').toLowerCase()||'pdf'}`;
}

export function mergeResumeContent(base,incoming){
  const out=normalizeResume(structuredClone(base||{})),src=normalizeResume(structuredClone(incoming||{}));
  out.basics=out.basics||{};
  for(const key of ['fullName','headline','email','phone','location','linkedin','website'])if(!String(out.basics[key]||'').trim()&&String(src.basics?.[key]||'').trim())out.basics[key]=src.basics[key];
  if(!String(out.summary||'').trim())out.summary=src.summary;
  const normKey=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const fillBlank=(dest,source,keys)=>{for(const key of keys)if(!String(dest?.[key]??'').trim()&&String(source?.[key]??'').trim())dest[key]=source[key]};
  const mergeBullets=(dest,source)=>{dest.bullets=Array.isArray(dest.bullets)?dest.bullets:[];const seen=new Set(dest.bullets.map(b=>normKey(b?.text)));for(const bullet of source?.bullets||[]){const fp=normKey(bullet?.text);if(fp&&!seen.has(fp)){dest.bullets.push(structuredClone(bullet));seen.add(fp)}}};
  const mergeCollection=(key,fingerprint,onMatch)=>{const dest=Array.isArray(out[key])?out[key]:[],byFingerprint=new Map();for(const item of dest){const fp=fingerprint(item);if(fp&&!byFingerprint.has(fp))byFingerprint.set(fp,item)}for(const item of src[key]||[]){const fp=fingerprint(item),existing=fp?byFingerprint.get(fp):null;if(existing){onMatch?.(existing,item);continue}if(fp){const copy=structuredClone(item);dest.push(copy);byFingerprint.set(fp,copy)}}out[key]=dest};
  mergeCollection('experience',x=>normKey([x.company,x.title,x.startDate].join('|')),(dest,item)=>{fillBlank(dest,item,['location','endDate']);mergeBullets(dest,item)});
  mergeCollection('education',x=>normKey([x.institution,x.degree,x.startDate].join('|')),(dest,item)=>fillBlank(dest,item,['endDate','details']));
  mergeCollection('projects',x=>normKey([x.name,x.role].join('|')),(dest,item)=>{fillBlank(dest,item,['description','url','startDate','endDate']);mergeBullets(dest,item)});
  mergeCollection('certifications',x=>normKey([x.name,x.issuer].join('|')),(dest,item)=>fillBlank(dest,item,['date','url']));
  mergeCollection('languages',x=>normKey(x.language),(dest,item)=>fillBlank(dest,item,['level']));
  mergeCollection('achievements',x=>normKey([x.title,x.description].join('|')),(dest,item)=>fillBlank(dest,item,['date']));
  const groups=new Map((out.skillGroups||[]).map(g=>[normKey(g.name)||'habilidades',g]));
  for(const g of src.skillGroups||[]){const key=normKey(g.name)||'habilidades',existing=groups.get(key);if(existing){existing.skills=Array.isArray(existing.skills)?existing.skills:[];const have=new Set(existing.skills.map(normKey));for(const skill of g.skills||[]){const fp=normKey(skill);if(fp&&!have.has(fp)){existing.skills.push(skill);have.add(fp)}}}else{const copy=structuredClone(g);out.skillGroups.push(copy);groups.set(key,copy)}}
  const evidence=Array.isArray(out.evidenceVault)?out.evidenceVault:[],seenEvidence=new Set(evidence.map(e=>normKey([e?.type,e?.anchor,e?.title,e?.text,e?.quote,e?.fileName,e?.page].join('|'))));
  for(const item of src.evidenceVault||[]){const fp=normKey([item?.type,item?.anchor,item?.title,item?.text,item?.quote,item?.fileName,item?.page].join('|'));if(fp&&!seenEvidence.has(fp)){evidence.push(structuredClone(item));seenEvidence.add(fp)}}
  out.evidenceVault=evidence.slice(-500);
  return normalizeResume(out);
}
