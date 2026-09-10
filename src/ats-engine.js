import {matchResumeToJob,canonicalSkills} from './job-engine.js?v=48';
import {sectionById} from './section-catalog.js?v=48';

const ACTION=/^(lider|cre|diseñ|desarroll|implement|aument|redu|optimiz|gestion|coordin|analiz|automat|constru|dirig|mejor|negoci|launch|built|led|improv|develop|implement|design|reduce|increase|automat|manage|coordinate|deliver|drive|created|grew|saved|achieved|owned|shipped|scaled|resolved|improved)/i;
const METRIC=/\b\d+(?:[.,]\d+)?\s*(?:%|x|k|m|mil|mill[oó]n(?:es)?|usuarios?|clientes?|equipos?|d[ií]as?|horas?|€|\$|usd|eur|mxn|s|ms)?\b/i;
const FIRST_PERSON=/\b(yo|mi|me|mío|mía|i|my|me)\b/i;
const CLICHE=/\b(proactivo|dinámico|trabajador|apasionado|perfeccionista|team player|hard worker|go getter|results driven|detail oriented)\b/i;
const TRACKING=/[?&](utm_|gclid|fbclid|mc_cid|mc_eid)/i;
const SAFE_TEMPLATES=new Set(['nexus','atlas','mono','classic','technical','academic','executive']);
const MID_TEMPLATES=new Set(['pulse','compact','editorial']);
const HIGH_TEMPLATES=new Set(['sidebar','creative']);
const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean);
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const clean=s=>String(s||'').trim();

export function resumePlainText(r){
  const parts=[r.basics?.fullName,r.basics?.headline,r.basics?.email,r.basics?.phone,r.basics?.location,r.basics?.linkedin,r.basics?.website,r.summary];
  (r.experience||[]).forEach(e=>parts.push(e.title,e.company,e.location,e.startDate,e.endDate,...(e.bullets||[]).map(b=>b.text)));
  (r.education||[]).forEach(e=>parts.push(e.degree,e.institution,e.startDate,e.endDate,e.details));
  (r.skillGroups||[]).forEach(g=>parts.push(g.name,...(g.skills||[])));
  (r.projects||[]).forEach(p=>parts.push(p.name,p.role,p.description,...(p.bullets||[]).map(b=>b.text)));
  (r.certifications||[]).forEach(c=>parts.push(c.name,c.issuer,c.date));
  (r.languages||[]).forEach(l=>parts.push(l.language,l.level));
  (r.achievements||[]).forEach(a=>parts.push(a.title,a.description));
  for(const items of Object.values(r.genericSections||{})) (items||[]).forEach(it=>parts.push(it.title,it.subtitle,it.location,it.startDate,it.endDate,it.description,...(it.bullets||[]).map(b=>b.text||b)));
  (r.customSections||[]).forEach(s=>(s.items||[]).forEach(it=>parts.push(s.title,it.title,it.subtitle,it.description,...(it.bullets||[]).map(b=>b.text||b))));
  return parts.filter(Boolean).join(' ');
}

function bulletsOf(r){return (r.experience||[]).flatMap(e=>(e.bullets||[]).map(b=>({...b,where:e.title||e.company||'Experiencia'}))).filter(b=>clean(b.text))}
function allLinks(r){return [r.basics?.linkedin,r.basics?.website].filter(Boolean)}
function overlapDates(exps){
  const ranges=exps.map(e=>({s:year(e.startDate),f:e.current?new Date().getFullYear():year(e.endDate)})).filter(x=>x.s&&x.f).sort((a,b)=>a.s-b.s);let overlaps=0;
  for(let i=1;i<ranges.length;i++) if(ranges[i].s<ranges[i-1].f-1) overlaps++;return overlaps;
}
function year(v){const m=String(v||'').match(/(19|20)\d{2}/);return m?Number(m[0]):null}
function sectionHasContent(r,id){
  if(id==='summary')return !!clean(r.summary);if(id==='experience')return (r.experience||[]).length>0;if(id==='education')return (r.education||[]).length>0;if(id==='skills')return (r.skillGroups||[]).some(g=>(g.skills||[]).length);if(id==='projects')return (r.projects||[]).length>0;if(id==='certifications')return (r.certifications||[]).length>0;if(id==='languages')return (r.languages||[]).length>0;if(id==='achievements')return (r.achievements||[]).length>0;if(id.startsWith('custom:'))return (r.customSections||[]).some(s=>`custom:${s.id}`===id&&(s.items||[]).length);return (r.genericSections?.[id]||[]).length>0;
}

export function analyzeResume(r,job=null){
  const text=resumePlainText(r),wordCount=words(text).length,summaryWords=words(r.summary).length,bullets=bulletsOf(r),quantified=bullets.filter(b=>METRIC.test(b.text)),action=bullets.filter(b=>ACTION.test(b.text.trim())),skillList=[...new Set((r.skillGroups||[]).flatMap(g=>g.skills||[]).filter(Boolean))],skillCount=skillList.length;
  const contextualSkills=[...new Set((r.experience||[]).flatMap(e=>(e.bullets||[]).flatMap(b=>canonicalSkills(b.text))).concat((r.projects||[]).flatMap(p=>canonicalSkills([p.description,...(p.bullets||[]).map(b=>b.text)].join(' ')))))];
  const contactOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.basics?.email||'')&&String(r.basics?.phone||'').replace(/\D/g,'').length>=8;
  const template=r.settings?.templateId||'ats-ink';
  const family=(r.settings?.templateFamily||String(template).split('-')[0]||'ats');
  const declared=r.settings?.templateRisk||(['creative'].includes(family)?'high':['sidebar','editorial','compact','bold'].includes(family)?'medium':'low');
  const risk=declared==='high'?'high':(declared==='medium'||r.settings?.layout==='dual'||r.settings?.showPhoto)?'medium':'low';
  const avgBullet=bullets.length?bullets.reduce((n,b)=>n+words(b.text).length,0)/bullets.length:0;
  const match=matchResumeToJob(r,job||r.target);
  const checks=buildChecks({r,text,wordCount,summaryWords,bullets,quantified,action,skillCount,skillList,contextualSkills,contactOk,template,risk,avgBullet,match});
  const grouped={};for(const c of checks){grouped[c.category]??=[];grouped[c.category].push(c)}
  const categoryScore=category=>{const xs=grouped[category]||[];if(!xs.length)return 100;const max=xs.reduce((n,x)=>n+x.weight,0),got=xs.reduce((n,x)=>n+(x.pass?x.weight:x.partial?x.weight*.55:0),0);return clamp(got/Math.max(max,1)*100)};
  const scores={parsability:categoryScore('parsability'),content:categoryScore('content'),impact:categoryScore('impact'),readability:categoryScore('readability'),consistency:categoryScore('consistency'),jobMatch:match.score};
  const weights=match.score==null?{parsability:.28,content:.27,impact:.20,readability:.15,consistency:.10}:{parsability:.23,content:.20,impact:.17,readability:.10,consistency:.05,jobMatch:.25};
  const score=clamp(Object.entries(weights).reduce((n,[k,w])=>n+(scores[k]??0)*w,0));
  const recommendations=checks.filter(c=>!c.pass).sort((a,b)=>b.priority-a.priority||b.weight-a.weight).slice(0,12);
  return {score,confidence:clamp(76+Math.min(14,bullets.length*1.5)+(match.score!=null?7:0))/100,scores,checks,recommendations,match,metrics:{checks:checks.length,passed:checks.filter(x=>x.pass).length,wordCount,summaryWords,bullets:bullets.length,quantified:quantified.length,actionVerbs:action.length,skillCount,contextualSkills:contextualSkills.length,avgBulletWords:Math.round(avgBullet),templateRisk:risk}};
}

function buildChecks(c){
  const {r,text,wordCount,summaryWords,bullets,quantified,action,skillCount,contextualSkills,contactOk,risk,avgBullet,match}=c;
  const out=[];const add=(id,category,title,pass,message,{priority=5,weight=4,partial=false,example='',actionTarget=''}={})=>out.push({id,category,title,pass,partial:!pass&&partial,message,priority,weight,example,actionTarget});
  const exp=r.experience||[],edu=r.education||[],links=allLinks(r),emptyVisible=(r.settings?.sectionOrder||[]).filter(id=>!(r.settings?.hiddenSections||[]).includes(id)&&!sectionHasContent(r,id));

  // 1-7 Parsabilidad
  add('contact','parsability','Datos de contacto',contactOk,contactOk?'Correo y teléfono son legibles.':'Añade un correo válido y un teléfono con al menos 8 dígitos.',{priority:10,weight:7,actionTarget:'basics'});
  add('name','parsability','Nombre identificable',clean(r.basics?.fullName).length>=4,'El nombre completo debe aparecer como texto seleccionable.',{priority:9,weight:5,actionTarget:'basics'});
  add('standard-headings','parsability','Secciones reconocibles',true,'El documento usa encabezados semánticos y nombres de sección reconocibles.',{weight:4});
  add('template-risk','parsability','Riesgo de plantilla',risk==='low',risk==='low'?'La plantilla mantiene una lectura lineal y conservadora.':risk==='medium'?'La plantilla es usable, pero conviene revisar la Vista ATS.':'La plantilla prioriza composición visual; usa Vista ATS y prueba la exportación.',{priority:risk==='high'?9:6,weight:7,partial:risk==='medium',actionTarget:'templates'});
  add('links','parsability','Enlaces limpios',links.every(x=>!TRACKING.test(x)),links.some(x=>TRACKING.test(x))?'Elimina parámetros de seguimiento de tus enlaces.':'No se detectaron parámetros de tracking.',{weight:3,actionTarget:'basics'});
  add('empty-sections','parsability','Sin secciones vacías',emptyVisible.length===0,emptyVisible.length?`Hay ${emptyVisible.length} sección(es) visible(s) sin contenido.`:'No hay secciones vacías visibles.',{priority:5,weight:3,actionTarget:'editor'});
  add('special-chars','parsability','Texto estable',!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text),'Evita caracteres invisibles o de control que pueden romper extracción.',{weight:3});

  // 8-15 Contenido
  add('headline','content','Título profesional',clean(r.basics?.headline).length>=4,'Usa un título específico y alineado al puesto objetivo.',{priority:8,weight:5,actionTarget:'basics'});
  add('summary-present','content','Perfil profesional',summaryWords>=20,`Tu perfil tiene ${summaryWords} palabras; añade especialidad, experiencia y propuesta de valor.`,{priority:7,weight:5,actionTarget:'summary'});
  add('summary-length','content','Longitud del perfil',summaryWords>=25&&summaryWords<=90,`El perfil tiene ${summaryWords} palabras; 25–90 suele ser un rango útil para mantener foco.`,{weight:4,partial:summaryWords>=15&&summaryWords<=110,actionTarget:'summary'});
  add('experience','content','Experiencia estructurada',exp.length>0,'Incluye al menos una experiencia con empresa, cargo, fechas y resultados.',{priority:10,weight:7,actionTarget:'experience'});
  add('experience-completeness','content','Experiencias completas',exp.length>0&&exp.every(e=>clean(e.title)&&clean(e.company)&&clean(e.startDate)),exp.some(e=>!clean(e.title)||!clean(e.company)||!clean(e.startDate))?'Completa cargo, empresa y fecha de inicio en todas las experiencias.':'Las experiencias principales tienen los campos esenciales.',{priority:8,weight:5,actionTarget:'experience'});
  add('education','content','Educación',edu.length>0&&edu.every(e=>clean(e.degree)&&clean(e.institution)),edu.length?'Completa título e institución en educación.':'Añade formación académica cuando sea relevante.',{weight:4,partial:edu.length>0,actionTarget:'education'});
  add('skills','content','Habilidades relevantes',skillCount>=6&&skillCount<=24,`Se detectaron ${skillCount} habilidades; prioriza entre 6 y 24 realmente relevantes.`,{priority:6,weight:5,partial:skillCount>=3,actionTarget:'skills'});
  add('context-skills','content','Skills con evidencia',contextualSkills.length>=Math.min(4,Math.max(1,Math.ceil(skillCount*.25))),`${contextualSkills.length} skills aparecen dentro de logros o proyectos. Lleva las más importantes a contexto real.`,{priority:7,weight:6,partial:contextualSkills.length>0,actionTarget:'experience'});

  // 16-20 Impacto
  add('bullet-volume','impact','Logros suficientes',bullets.length>=3,`Se detectaron ${bullets.length} bullets de experiencia; intenta incluir 2–5 por puesto relevante.`,{priority:7,weight:5,partial:bullets.length>=1,actionTarget:'experience'});
  add('quantified','impact','Resultados cuantificados',bullets.length>0&&quantified.length/Math.max(1,bullets.length)>=.35,`${quantified.length} de ${bullets.length} bullets contienen cifras o magnitudes. Usa métricas sólo cuando sean reales.`,{priority:9,weight:7,partial:quantified.length>0,actionTarget:'experience'});
  add('action-verbs','impact','Verbos de acción',bullets.length>0&&action.length/Math.max(1,bullets.length)>=.6,`${action.length} de ${bullets.length} bullets comienzan con verbos de acción claros.`,{priority:6,weight:5,partial:action.length>0,actionTarget:'experience'});
  add('bullet-specificity','impact','Bullets con suficiente detalle',bullets.length>0&&bullets.filter(b=>words(b.text).length>=8).length/Math.max(1,bullets.length)>=.75,'Evita bullets demasiado vagos; describe acción, alcance y resultado.',{weight:4,partial:bullets.some(b=>words(b.text).length>=8),actionTarget:'experience'});
  add('cliches','impact','Sin clichés vacíos',!CLICHE.test(text),CLICHE.test(text)?'Se detectó lenguaje genérico. Sustitúyelo por evidencia concreta.':'El contenido evita clichés profesionales evidentes.',{weight:3,actionTarget:'summary'});

  // 21-24 Legibilidad
  add('word-count','readability','Extensión total',wordCount>=150&&wordCount<=950,`El CV contiene ${wordCount} palabras. Ajusta la extensión al seniority y relevancia.`,{weight:5,partial:wordCount>=100&&wordCount<=1100});
  add('bullet-length','readability','Bullets escaneables',!avgBullet||(avgBullet>=8&&avgBullet<=30),`Promedio de ${Math.round(avgBullet)} palabras por bullet; procura que cada punto sea rápido de escanear.`,{weight:4,partial:avgBullet>=6&&avgBullet<=36,actionTarget:'experience'});
  add('first-person','readability','Redacción directa',!FIRST_PERSON.test(r.summary||''),FIRST_PERSON.test(r.summary||'')?'Evita primera persona repetitiva en el perfil; usa lenguaje profesional directo.':'El perfil usa redacción concisa.',{weight:3,actionTarget:'summary'});
  add('repetition','readability','Baja repetición',repeatRatio(text)<.09,'Varía verbos y expresiones para evitar sensación de texto repetitivo.',{weight:4,partial:repeatRatio(text)<.14});

  // 25-27 Consistencia / target
  const dateStrings=exp.flatMap(e=>[e.startDate,e.endDate]).filter(Boolean);
  add('dates','consistency','Fechas consistentes',dateStrings.every(x=>/(19|20)\d{2}/.test(String(x))),dateStrings.some(x=>!/(19|20)\d{2}/.test(String(x)))?'Usa años o mes/año de forma consistente en todas las experiencias.':'Las fechas usan un patrón reconocible.',{weight:5,actionTarget:'experience'});
  add('chronology','consistency','Cronología coherente',overlapDates(exp)<=1,overlapDates(exp)>1?'Se detectaron varias superposiciones de fechas; revisa si son correctas.':'La cronología no presenta conflictos llamativos.',{weight:4,partial:overlapDates(exp)===1,actionTarget:'experience'});
  add('target-match','consistency','Alineación con vacante',match.score==null||match.score>=65,match.score==null?'Añade una vacante objetivo para activar el análisis de requisitos.':`Compatibilidad estimada ${match.score}%. Revisa requisitos faltantes y añade evidencia sólo si es verdadera.`,{priority:match.score!=null&&match.score<50?10:8,weight:7,partial:match.score!=null&&match.score>=45,actionTarget:'target'});

  return out;
}

function repeatRatio(text){const ws=words(text.toLowerCase()).filter(w=>w.length>4);if(ws.length<20)return 0;const f={};ws.forEach(w=>f[w]=(f[w]||0)+1);const excess=Object.values(f).reduce((n,c)=>n+Math.max(0,c-4),0);return excess/ws.length}

export function atsTextView(r){
  const lines=[];const push=(...xs)=>xs.filter(x=>clean(x)).forEach(x=>lines.push(clean(x)));const head=t=>{if(lines.length&&lines.at(-1)!=='')lines.push('');lines.push(String(t).toUpperCase())};
  push(r.basics?.fullName,r.basics?.headline,[r.basics?.email,r.basics?.phone,r.basics?.location].filter(Boolean).join(' | '),[r.basics?.linkedin,r.basics?.website].filter(Boolean).join(' | '));
  const hidden=new Set(r.settings?.hiddenSections||[]),order=r.settings?.sectionOrder||[],titles=r.settings?.sectionTitles||{};
  const title=(id,fallback)=>Object.prototype.hasOwnProperty.call(titles,id)?String(titles[id]??''):fallback;
  for(const id of order){
    if(hidden.has(id))continue;
    if(id==='summary'&&clean(r.summary)){title('summary','Perfil profesional')&&head(title('summary','Perfil profesional'));push(r.summary)}
    else if(id==='experience'&&(r.experience||[]).length){title('experience','Experiencia profesional')&&head(title('experience','Experiencia profesional'));for(const e of r.experience){push(`${e.title||''}${e.company?` — ${e.company}`:''}`,[e.startDate,e.current?'Actualidad':e.endDate].filter(Boolean).join(' – '),e.location);(e.bullets||[]).filter(b=>clean(b.text)).forEach(b=>push(`- ${b.text}`))}}
    else if(id==='education'&&(r.education||[]).length){title('education','Educación')&&head(title('education','Educación'));for(const e of r.education)push(`${e.degree||''}${e.institution?` — ${e.institution}`:''}`,[e.startDate,e.endDate].filter(Boolean).join(' – '),e.details)}
    else if(id==='skills'&&(r.skillGroups||[]).length){title('skills','Habilidades')&&head(title('skills','Habilidades'));for(const g of r.skillGroups)if((g.skills||[]).length)push(`${g.name}: ${(g.skills||[]).join(', ')}`)}
    else if(id==='projects'&&(r.projects||[]).length){title('projects','Proyectos')&&head(title('projects','Proyectos'));for(const p of r.projects){push(`${p.name||''}${p.role?` — ${p.role}`:''}`,p.description);(p.bullets||[]).forEach(b=>push(`- ${b.text}`))}}
    else if(id==='certifications'&&(r.certifications||[]).length){title('certifications','Certificaciones')&&head(title('certifications','Certificaciones'));for(const c of r.certifications)push([c.name,c.issuer,c.date].filter(Boolean).join(' — '))}
    else if(id==='languages'&&(r.languages||[]).length){title('languages','Idiomas')&&head(title('languages','Idiomas'));for(const l of r.languages)push([l.language,l.level].filter(Boolean).join(' — '))}
    else if(id==='achievements'&&(r.achievements||[]).length){title('achievements','Logros')&&head(title('achievements','Logros'));for(const a of r.achievements)push([a.title,a.description].filter(Boolean).join(' — '))}
    else if(id.startsWith('custom:')){const cs=(r.customSections||[]).find(s=>`custom:${s.id}`===id);if(cs){title(id,cs.title)&&head(title(id,cs.title));for(const it of cs.items||[])genericLines(it,push)}}
    else {const items=r.genericSections?.[id]||[];if(items.length){title(id,sectionById(id)?.label||id)&&head(title(id,sectionById(id)?.label||id));for(const it of items)genericLines(it,push)}}
  }
  return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function genericLines(it,push){push([it.title,it.subtitle].filter(Boolean).join(' — '),[it.startDate,it.endDate].filter(Boolean).join(' – '),it.location,it.description);(it.bullets||[]).forEach(b=>push(`- ${typeof b==='string'?b:b.text||''}`))}
