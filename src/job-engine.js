import {sectionVisible} from './section-catalog.js?v=48';

const ONTOLOGY={
  javascript:['javascript','js'],typescript:['typescript','ts'],react:['react.js','reactjs','react'], 'react native':['react native'],vue:['vue.js','vuejs','vue'],angular:['angular'],
  node:['node.js','nodejs','node'],python:['python'],java:['java'],csharp:['c#','c sharp','.net','dotnet'],cpp:['c++'],go:['golang','go language'],rust:['rust'],php:['php'],ruby:['ruby'],
  html:['html','html5'],css:['css','css3'],sass:['sass','scss'],tailwind:['tailwind','tailwindcss'],
  sql:['sql'],postgresql:['postgresql','postgres'],mysql:['mysql'],mongodb:['mongodb','mongo db'],redis:['redis'],oracle:['oracle database','oracle db'],
  aws:['amazon web services','aws'],azure:['microsoft azure','azure'],gcp:['google cloud platform','google cloud','gcp'],docker:['docker'],kubernetes:['kubernetes','k8s'],terraform:['terraform'],ansible:['ansible'],
  git:['git'],github:['github'],gitlab:['gitlab'],jenkins:['jenkins'],cicd:['ci/cd','continuous integration','continuous delivery','continuous deployment'],
  figma:['figma'],sketch:['sketch'],adobe:['adobe creative cloud','adobe xd','photoshop','illustrator'],
  'ux research':['ux research','user research'], 'product design':['product design'], 'design systems':['design systems','design system'], accessibility:['accessibility','accesibilidad','wcag'],
  tableau:['tableau'],powerbi:['power bi','powerbi'],excel:['excel','microsoft excel'],looker:['looker'],
  spark:['apache spark','spark'],pandas:['pandas'],numpy:['numpy'],tensorflow:['tensorflow'],pytorch:['pytorch'],scikitlearn:['scikit-learn','sklearn'],
  fastapi:['fastapi'],django:['django'],flask:['flask'],spring:['spring boot','spring'],graphql:['graphql'],rest:['rest api','restful api','restful','rest'],grpc:['grpc'],
  agile:['agile','scrum'],jira:['jira'],confluence:['confluence'],salesforce:['salesforce'],sap:['sap'],linux:['linux'],
  cybersecurity:['cybersecurity','cyber security','seguridad informática','ciberseguridad'],siem:['siem'],splunk:['splunk'],soc:['security operations center','soc'],
  seo:['seo','search engine optimization'],sem:['sem','search engine marketing'],ga4:['google analytics 4','ga4'],hubspot:['hubspot'],marketo:['marketo'],
  crm:['crm','customer relationship management'],b2b:['b2b'],b2c:['b2c'],sales:['sales','ventas'],marketing:['marketing','mercadotecnia'],
  leadership:['leadership','liderazgo'],communication:['communication','comunicación'],stakeholders:['stakeholder management','stakeholders','gestión de stakeholders'],
  projectmanagement:['project management','gestión de proyectos'],productmanagement:['product management','gestión de producto'],roadmap:['roadmap','product roadmap'],
  english:['english','inglés'],spanish:['spanish','español'],french:['french','francés'],german:['german','alemán']
};
const REQUIRED=/\b(required|must|mandatory|minimum|essential|requisito|requerido|obligatorio|imprescindible|mínimo|indispensable|necesario)\b/i;
const PREFERRED=/\b(preferred|nice to have|desirable|plus|valorable|deseable|preferible|idealmente|bonus)\b/i;
const SIGNAL=/\b(experience|skills?|knowledge|proficien|familiar|años?|experiencia|conocimiento|dominio|manejo|capacidad|certific|degree|licenciatura|ingenier|grado|responsabilit|responsabilidades)\b/i;
const STOP=new Set('about above after again against all also am an and any are as at be because been before being below between both but by can did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with you your yours yourself yourselves para como con una uno unos unas del las los que por sus este esta entre desde sobre será debe experiencia años nivel buscamos nuestro nuestra trabajo equipo capacidad conocimiento dominio manejo deseable requerido requisitos responsabilidad responsabilidades'.split(' '));

export const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9+#. ]+/g,' ').replace(/\s+/g,' ').trim();
const rx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function canonicalSkills(text){
  const n=norm(text),found=[];
  for(const [canonical,aliases] of Object.entries(ONTOLOGY)){
    if(aliases.some(a=>{const x=norm(a);return new RegExp(`(^|[^a-z0-9])${rx(x)}([^a-z0-9]|$)`,'i').test(n)})) found.push(canonical);
  }
  const unique=[...new Set(found)];
  return unique.filter(skill=>!unique.some(other=>other!==skill && other.startsWith(skill+' ')));
}

function extractFallbackTerms(line){
  const n=norm(line);
  const words=n.match(/[a-z][a-z0-9+#.]{2,}/g)||[];
  return [...new Set(words.filter(w=>!STOP.has(w) && !/^\d+$/.test(w) && !['required','preferred','minimum','years','anos'].includes(w)))].slice(0,8);
}

export function parseJobDescription(text,meta={}){
  const raw=String(text||'').trim();
  const lines=raw.split(/\n|[•▪◦]/).map(x=>x.trim()).filter(Boolean);
  const requirements=[],seen=new Set();
  lines.forEach((line,idx)=>{
    const importance=REQUIRED.test(line)?'required':PREFERRED.test(line)?'preferred':'context';
    const skills=canonicalSkills(line);
    skills.forEach(skill=>{
      const key=`skill:${skill}`;if(seen.has(key))return;seen.add(key);
      requirements.push({id:key,type:'skill',concept:skill,importance:importance==='context'?(SIGNAL.test(line)?'required':'context'):importance,evidence:line,confidence:importance==='required'?0.97:importance==='preferred'?0.91:0.78,line:idx});
    });
    const years=line.match(/\b(\d{1,2})\s*\+?\s*(?:years?|años?)\b/i);
    if(years){const key='experience_years';if(!seen.has(key)){seen.add(key);requirements.push({id:key,type:'experience',concept:`${years[1]}+ años de experiencia`,value:Number(years[1]),importance:importance==='preferred'?'preferred':'required',evidence:line,confidence:0.92,line:idx})}}
    if(/\b(bachelor|master|degree|licenciatura|ingenier[ií]a|maestr[ií]a|grado|doctorado|phd)\b/i.test(line)){
      const key='education';if(!seen.has(key)){seen.add(key);requirements.push({id:key,type:'education',concept:'formación académica',importance:importance==='context'?'preferred':importance,evidence:line,confidence:0.82,line:idx})}
    }
    if(!skills.length && (REQUIRED.test(line)||PREFERRED.test(line))){
      extractFallbackTerms(line).slice(0,3).forEach(term=>{const key=`term:${term}`;if(seen.has(key))return;seen.add(key);requirements.push({id:key,type:'term',concept:term,importance,evidence:line,confidence:0.58,line:idx})});
    }
  });
  return {role:meta.role||'',company:meta.company||'',text:raw,requirements,skills:canonicalSkills(raw),parsedAt:Date.now()};
}

export function resumeSkillEvidence(resume){
  const evidence=new Map();
  const add=(skill,where,text,depth=1)=>{if(!evidence.has(skill))evidence.set(skill,[]);evidence.get(skill).push({where,text,depth})};
  if(sectionVisible(resume,'skills'))(resume.skillGroups||[]).forEach(g=>(g.skills||[]).forEach(s=>canonicalSkills(s).forEach(k=>add(k,`Habilidades · ${g.name}`,s,0.55))));
  if(sectionVisible(resume,'experience'))(resume.experience||[]).forEach(e=>[e.title,e.company,...(e.bullets||[]).map(b=>b.text)].filter(Boolean).forEach(t=>canonicalSkills(t).forEach(k=>add(k,`Experiencia · ${e.title||e.company}`,t,1))));
  if(sectionVisible(resume,'projects'))(resume.projects||[]).forEach(p=>[p.name,p.role,p.description,...(p.bullets||[]).map(b=>b.text)].filter(Boolean).forEach(t=>canonicalSkills(t).forEach(k=>add(k,`Proyecto · ${p.name}`,t,.95))));
  if(sectionVisible(resume,'certifications'))(resume.certifications||[]).forEach(c=>[c.name,c.issuer].filter(Boolean).forEach(t=>canonicalSkills(t).forEach(k=>add(k,`Certificación · ${c.name}`,t,.8))));
  if(sectionVisible(resume,'languages'))(resume.languages||[]).forEach(l=>[l.language,l.level].filter(Boolean).forEach(t=>canonicalSkills(t).forEach(k=>add(k,`Idioma · ${l.language}`,t,1))));
  if(sectionVisible(resume,'achievements'))(resume.achievements||[]).forEach(a=>[a.title,a.description].filter(Boolean).forEach(t=>canonicalSkills(t).forEach(k=>add(k,`Logro · ${a.title}`,t,.8))));
  if(sectionVisible(resume,'summary'))canonicalSkills(resume.summary||'').forEach(k=>add(k,'Perfil',resume.summary,.75));
  for(const [key,items] of Object.entries(resume.genericSections||{}))if(sectionVisible(resume,key))(items||[]).forEach(it=>[it.title,it.subtitle,it.description,...(it.bullets||[])].filter(Boolean).forEach(t=>canonicalSkills(typeof t==='string'?t:t.text).forEach(k=>add(k,`Sección · ${key}`,String(t?.text||t),.8))));
  (resume.customSections||[]).forEach(section=>{if(sectionVisible(resume,'custom:'+section.id))(section.items||[]).forEach(it=>[it.title,it.subtitle,it.description,...(it.bullets||[])].filter(Boolean).forEach(t=>canonicalSkills(typeof t==='string'?t:t.text).forEach(k=>add(k,`Sección · ${section.title||'Personalizada'}`,String(t?.text||t),.8))))});
  return evidence;
}

function plainResumeText(resume){
  const xs=[resume.basics?.headline];
  if(sectionVisible(resume,'summary'))xs.push(resume.summary);
  if(sectionVisible(resume,'experience'))(resume.experience||[]).forEach(e=>xs.push(e.title,e.company,...(e.bullets||[]).map(b=>b.text)));
  if(sectionVisible(resume,'education'))(resume.education||[]).forEach(e=>xs.push(e.degree,e.institution,e.details));
  if(sectionVisible(resume,'skills'))(resume.skillGroups||[]).forEach(g=>xs.push(g.name,...(g.skills||[])));
  if(sectionVisible(resume,'projects'))(resume.projects||[]).forEach(p=>xs.push(p.name,p.role,p.startDate,p.endDate,p.url,p.description,...(p.bullets||[]).map(b=>b.text)));
  if(sectionVisible(resume,'certifications'))(resume.certifications||[]).forEach(c=>xs.push(c.name,c.issuer,c.date,c.url));
  if(sectionVisible(resume,'languages'))(resume.languages||[]).forEach(l=>xs.push(l.language,l.level));
  if(sectionVisible(resume,'achievements'))(resume.achievements||[]).forEach(a=>xs.push(a.title,a.description,a.date));
  for(const [id,items] of Object.entries(resume.genericSections||{}))if(sectionVisible(resume,id))(items||[]).forEach(it=>xs.push(it.title,it.subtitle,it.location,it.startDate,it.endDate,it.url,it.description,...(it.bullets||[]).map(b=>typeof b==='string'?b:b?.text)));
  (resume.customSections||[]).forEach(s=>{if(sectionVisible(resume,'custom:'+s.id))(s.items||[]).forEach(it=>xs.push(s.title,it.title,it.subtitle,it.location,it.startDate,it.endDate,it.url,it.description,...(it.bullets||[]).map(b=>typeof b==='string'?b:b?.text)))});
  return norm(xs.filter(Boolean).join(' '));
}

export function matchResumeToJob(resume,job){
  if(!job?.requirements?.length)return{score:null,matched:[],partial:[],missing:[],requirements:[],coverage:{required:null,preferred:null}};
  const evidence=resumeSkillEvidence(resume),text=plainResumeText(resume),out=[];let earned=0,total=0,reqEarned=0,reqTotal=0,prefEarned=0,prefTotal=0;
  for(const req of job.requirements){
    const weight=req.importance==='required'?3:req.importance==='preferred'?1.5:.45;total+=weight;if(req.importance==='required')reqTotal+=weight;if(req.importance==='preferred')prefTotal+=weight;
    let status='missing',ev=[],quality=0;
    if(req.type==='skill'){
      ev=evidence.get(req.concept)||[];quality=Math.max(0,...ev.map(x=>x.depth||0));status=quality>=.9?'matched':quality>=.5?'partial':'missing';
    }else if(req.type==='experience'){
      const years=estimateYears(sectionVisible(resume,'experience')?(resume.experience||[]):[]);quality=years>=req.value?1:(years>=Math.max(1,req.value-1) ? .55 : 0);status=quality===1?'matched':quality>0?'partial':'missing';ev=[{where:'Experiencia',text:`≈ ${years.toFixed(1)} años detectados`,depth:quality}];
    }else if(req.type==='education'){
      quality=sectionVisible(resume,'education')&&(resume.education||[]).length?1:0;status=quality?'matched':'missing';
    }else if(req.type==='term'){
      const present=new RegExp(`(^| )${rx(norm(req.concept))}( |$)`).test(text);quality=present?.7:0;status=present?'partial':'missing';
    }
    const credit=quality>=.9?1:quality>=.5?.55:0;earned+=weight*credit;if(req.importance==='required')reqEarned+=weight*credit;if(req.importance==='preferred')prefEarned+=weight*credit;
    out.push({...req,status,evidenceFound:ev,quality});
  }
  const score=Math.round(earned/Math.max(total,1)*100);
  return {score,requirements:out,matched:out.filter(x=>x.status==='matched'),partial:out.filter(x=>x.status==='partial'),missing:out.filter(x=>x.status==='missing'),coverage:{required:reqTotal?Math.round(reqEarned/reqTotal*100):null,preferred:prefTotal?Math.round(prefEarned/prefTotal*100):null}};
}

function estimateYears(exps){
  const ranges=[];
  for(const e of exps){
    const s=yearMonth(e.startDate),f=e.current?new Date():yearMonth(e.endDate);if(!s||!f||f<s)continue;
    ranges.push([s.getFullYear()*12+s.getMonth(),f.getFullYear()*12+f.getMonth()]);
  }
  ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let months=0,start=null,end=null;
  for(const [s,f] of ranges){if(start==null){start=s;end=f;continue}if(s<=end){end=Math.max(end,f);continue}months+=Math.max(0,end-start);start=s;end=f}
  if(start!=null)months+=Math.max(0,end-start);
  return months/12;
}
function yearMonth(s){const m=String(s||'').match(/(19|20)\d{2}(?:[-/.](\d{1,2}))?/);return m?new Date(Number(m[0].slice(0,4)),Math.max(0,Number(m[2]||1)-1),1):null}
