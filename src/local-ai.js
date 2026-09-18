import {factFingerprint} from './local-premium.js?v=48';

const clone=o=>structuredClone(o);
const NUMBER_WORDS={un:1,uno:1,una:1,one:1,dos:2,two:2,tres:3,three:3,cuatro:4,four:4,cinco:5,five:5,seis:6,six:6,siete:7,seven:7,ocho:8,eight:8,nueve:9,nine:9,diez:10,ten:10,once:11,eleven:11,doce:12,twelve:12,trece:13,thirteen:13,catorce:14,fourteen:14,quince:15,fifteen:15,dieciseis:16,sixteen:16,diecisiete:17,seventeen:17,dieciocho:18,eighteen:18,diecinueve:19,nineteen:19,veinte:20,twenty:20,treinta:30,thirty:30,cuarenta:40,forty:40,cincuenta:50,fifty:50,sesenta:60,sixty:60,setenta:70,seventy:70,ochenta:80,eighty:80,noventa:90,ninety:90,cien:100,ciento:100,hundred:100};
const TECH_VERSION_RX=/\b(visual studio|spring boot|sql server|node\.?js|angular|typescript|javascript|python|java|react|vue|ionic|jquery|php|docker|powerbuilder)\b[\s(]*(?:v(?:ersion)?\.?\s*)?(\d+(?:[.,]\d+)?(?:\s*(?:\/|[-–—])\s*\d+(?:[.,]\d+)?)*)/giu;
function technicalVersionSpans(value){
  const text=fold(value),out=[];
  for(const m of text.matchAll(TECH_VERSION_RX)){
    const start=m.index||0,end=start+m[0].length;
    const versions=[...m[2].matchAll(/\d+(?:[.,]\d+)?/g)].map(x=>x[0].replace(',','.'));
    out.push({start,end,label:m[1].replace(/\s+/g,' '),versions});
  }
  return out;
}
const inTechnicalVersionSpan=(spans,index)=>spans.some(s=>index>=s.start&&index<s.end);
function technicalVersionClaims(value){
  const byLabel=new Map();
  for(const span of technicalVersionSpans(value)){
    const versions=byLabel.get(span.label)||new Set();
    for(const v of span.versions)versions.add(v);
    byLabel.set(span.label,versions);
  }
  return byLabel;
}
function unsupportedTechnicalVersions(source,after){
  const known=technicalVersionClaims(source),out=[];
  for(const [label,versions] of technicalVersionClaims(after)){
    const allowed=known.get(label)||new Set();
    for(const version of versions)if(!allowed.has(version))out.push(label+' '+version);
  }
  return [...new Set(out)];
}
function nums(value){
  const text=fold(value),out=[],versionSpans=technicalVersionSpans(text);
  const re=/(?<![\p{L}\p{N}])(?:[$€£¥₹]\s*)?[+-]?\d+(?:[.,]\d+)?(?:%|x|k|m)?\b/giu;
  for(const m of text.matchAll(re)){
    const token=m[0],plain=/^\d+(?:[.,]\d+)?$/.test(token.trim());
    if(plain&&inTechnicalVersionSpan(versionSpans,m.index||0))continue;
    out.push(token.replace(/[$€£¥₹]/g,'').replace(/\s+/g,'').replace(',','.').toLowerCase());
  }
  for(const word of text.match(/[a-z]+/g)||[])if(NUMBER_WORDS[word]!=null&&!['un','una'].includes(word))out.push(String(NUMBER_WORDS[word]));
  return out;
}
const set=x=>new Set(x);
const textOfResume=r=>{const basics={...(r.basics||{})};delete basics.photo;return JSON.stringify({basics,summary:r.summary,experience:r.experience,education:r.education,skillGroups:r.skillGroups,projects:r.projects,certifications:r.certifications,languages:r.languages,achievements:r.achievements,genericSections:r.genericSections,customSections:r.customSections})};
function factualEvidenceText(r){
  const lines=[];
  const add=v=>{if(typeof v==='string'&&v.trim())lines.push(v.trim())};
  const basics={...(r?.basics||{})};delete basics.photo;Object.values(basics).forEach(add);add(r?.summary);
  for(const e of r?.experience||[]){add(e.company);add(e.title);add(e.location);add(e.startDate);add(e.endDate);for(const b of e.bullets||[])add(b.text)}
  for(const e of r?.education||[]){add(e.institution);add(e.degree);add(e.startDate);add(e.endDate);add(e.details)}
  for(const g of r?.skillGroups||[]){add(g.name);for(const skill of g.skills||[])add(skill)}
  for(const p of r?.projects||[]){add(p.name);add(p.role);add(p.description);add(p.startDate);add(p.endDate);for(const b of p.bullets||[])add(b.text)}
  for(const c of r?.certifications||[]){add(c.name);add(c.issuer);add(c.date)}
  for(const l of r?.languages||[]){add(l.language);add(l.level)}
  for(const a of r?.achievements||[]){add(a.title);add(a.description);add(a.date)}
  for(const [section,items] of Object.entries(r?.genericSections||{})){add(section);for(const it of items||[]){add(it.title);add(it.subtitle);add(it.location);add(it.startDate);add(it.endDate);add(it.url);add(it.description);for(const b of it.bullets||[])add(typeof b==='string'?b:b?.text)}}
  for(const section of r?.customSections||[]){add(section.title);for(const it of section.items||[]){add(it.title);add(it.subtitle);add(it.location);add(it.startDate);add(it.endDate);add(it.url);add(it.description);for(const b of it.bullets||[])add(typeof b==='string'?b:b?.text)}}
  return lines.join('\n');
}
const STOP=new Set('a al algo ante bajo con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era es esa ese eso esta este esto fue ha hacia hasta la las lo los mas más mi muy ni no o para pero por porque que se si sin sobre su sus te tu un una unas uno unos y ya the a an and or but for from in into of on to with as at by is are was were be been being this that these those during'.split(/\s+/));
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function stem(w){
  let s=fold(w).replace(/[^a-z0-9+#.-]/g,'').replace(/^[.-]+|[.-]+$/g,'');
  if(s.length>8)s=s.replace(/(amientos|imientos|aciones|uciones|idades)$/,'');
  if(s.length>7)s=s.replace(/(mente|acion|ucion|iendo|ando)$/,'');
  if(s.length>6)s=s.replace(/(ados|adas|idos|idas|icos|icas)$/,'');
  if(s.length>5)s=s.replace(/(es|os|as)$/,'');
  else if(s.length>4)s=s.replace(/s$/,'');
  return s;
}
function lexicalTerms(text){
  const words=String(text||'').match(/[\p{L}][\p{L}\p{N}+#.-]*/gu)||[];
  return words.map(stem).filter(x=>x.length>=2&&!STOP.has(x));
}
function contentTerms(text){return lexicalTerms(text).filter(x=>x.length>=4)}
// Auto-apply is intentionally conservative: novel factual vocabulary must be evidenced by
// the resume. Only a tiny set of grammatical/paraphrase stems may be new without review.
const SAFE_REWRITE_NOVEL=new Set([
  'disen','convirt','convierte','redact','reescrib','resum','sintet','concis','clar','direct','frase','texto',
  'seis','uno','una','dos','tres','cuatro','cinco','siete','ocho','nueve','diez','once','doce',
  'trece','catorce','quince','veinte','nunca','jamas','tampoco','ningun','ninguna','ninguno','not','without','never','neither',
  'solo','solamente','unicamente','exclusivamente','only','exclusively','since','until','before','after','approximately','around'
]);

const EDITORIAL_OPTIONAL_WORDS=new Set('el la los las un una unos unas the an'.split(/\s+/));
function editorialVerificationSignature(text){
  const tokens=String(text||'').match(/[$€£¥₹]|[+-]?\d+(?:[.,]\d+)?(?:%|x|k|m)?|[\p{L}][\p{L}\p{N}+#.-]*/gu)||[],out=[];
  for(const raw of tokens){
    const f=fold(raw).replace(/^[.-]+|[.-]+$/g,'');
    if(!f||EDITORIAL_OPTIONAL_WORDS.has(f))continue;
    out.push(f.replace(',','.'));
  }
  return out;
}
export function isEditoriallyVerified(before,after){
  const a=editorialVerificationSignature(before),b=editorialVerificationSignature(after);
  return a.length===b.length&&a.every((x,i)=>x===b[i]);
}

function unsupportedPositiveEvidenceTerms(source,after){
  const known=set(contentTerms(source)),out=[];
  for(const term of [...new Set(contentTerms(after))])if(!known.has(term)&&!SAFE_REWRITE_NOVEL.has(term))out.push(term);
  return out;
}
function unsupportedTitleTerms(source,after){
  const known=set(contentTerms(source)),re=/[\p{L}][\p{L}\p{N}+#.-]*/gu,out=[];
  for(const m of String(after||'').matchAll(re)){
    const word=m[0],s=stem(word),before=String(after||'').slice(0,m.index),sentenceStart=!before.trim()||/[.!?]\s*$/u.test(before);
    if(!sentenceStart&&word.length>=5&&/^\p{Lu}/u.test(word)&&!known.has(s)&&!STOP.has(s))out.push(fold(word));
  }
  return [...new Set(out)];
}
const TECH_TERMS=new Set('kubernetes terraform docker ansible jenkins github gitlab bitbucket aws azure gcp python javascript typescript java kotlin swift golang rust react angular vue svelte node nextjs nuxt sql mysql postgres postgresql mongodb redis kafka rabbitmq spark hadoop snowflake databricks kubeflow pytorch tensorflow keras figma sketch photoshop adobe jira confluence salesforce sap oracle linux powershell bash grafana prometheus elasticsearch opensearch splunk datadog unity unreal godot c# c++ dotnet net php ruby rails laravel django flask fastapi spring springboot matlab tableau powerbi excel vba scrum jira'.split(/\s+/).map(stem));
const GENERIC_ACRONYMS=new Set('cv ats ia ai ux ui pdf docx txt json qa url http https api'.split(/\s+/));
function technicalNovelTerms(source,after){
  const known=set(lexicalTerms(source)),out=[];
  for(const term of lexicalTerms(after))if(TECH_TERMS.has(term)&&!known.has(term))out.push(term);
  return [...new Set(out)];
}
function unsupportedAcronyms(source,after){
  const known=set(lexicalTerms(source)),out=[];
  for(const token of String(after||'').match(/\b[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9+#.-]{1,8}\b/g)||[]){const f=fold(token),t=stem(token);if(!known.has(t)&&!GENERIC_ACRONYMS.has(f))out.push(f)}
  return [...new Set(out)];
}
function durationClaims(text){
  const src=fold(text),out=[];
  const re=/(mas de|al menos|aproximadamente|cerca de)?\s*\b(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s+(anos?|mes(?:es)?)\b/g;
  for(const m of src.matchAll(re)){const raw=m[2],n=NUMBER_WORDS[raw]??Number(raw.replace(',','.')),unit=m[3].startsWith('ano')?'years':'months',qual=m[1]==='mas de'?'gt':m[1]==='al menos'?'gte':m[1]?'approx':'eq';if(Number.isFinite(n))out.push(`${unit}:${n}:${qual}`)}
  for(const m of src.matchAll(/(mas de|al menos|aproximadamente|cerca de)?\s*\b(?:una?\s+)?decadas?\b/g)){const qual=m[1]==='mas de'?'gt':m[1]==='al menos'?'gte':m[1]?'approx':'eq';out.push(`years:10:${qual}`)}
  return [...new Set(out)];
}
function unsupportedDurations(current,after){const allowed=set(durationClaims(current));return durationClaims(after).filter(x=>!allowed.has(x))}

function claimClauses(text){
  return String(text||'').split(/(?:[.!?;:\n]+|\s+(?:y|e|and)\s+)/giu).map(x=>x.trim()).filter(Boolean);
}

const RELATION_MARKERS=new Map(Object.entries({
  a:'rel:to',hacia:'rel:to',to:'rel:to',into:'rel:to',
  en:'rel:at',in:'rel:at',at:'rel:at',
  de:'rel:from',desde:'rel:from',from:'rel:from',
  para:'rel:for',for:'rel:for',
  sobre:'rel:about',about:'rel:about',regarding:'rel:about',
  con:'rel:with',with:'rel:with',
  por:'rel:by',by:'rel:by',
  entre:'rel:between',between:'rel:between',
  contra:'rel:against',against:'rel:against',
  bajo:'rel:under',under:'rel:under'
}));
function relationTerms(text){
  const out=[];
  for(const m of String(text||'').matchAll(/[\p{L}][\p{L}\p{N}+#.-]*|\d+/gu)){
    const raw=m[0],singleId=/^[A-ZÁÉÍÓÚÑ]$/u.test(raw),folded=fold(raw),marker=RELATION_MARKERS.get(folded);
    let term=marker||(singleId?`id:${folded}`:stem(raw));if(term==='led')term='lead';
    if(!term||(!marker&&!singleId&&(term.length<2||STOP.has(term)||SAFE_REWRITE_NOVEL.has(term))))continue;
    if(marker||!out.includes(term))out.push(term);
  }
  return out;
}
function isOrderedSubsequence(needle,haystack){
  let i=0;for(const token of haystack)if(token===needle[i]&&++i===needle.length)return true;return needle.length===0;
}
function relationOrderSupported(afterTerms,sourceTerms){return isOrderedSubsequence(afterTerms,sourceTerms)}

const NEGATION_RE=/\b(?:no|ni|sin|nunca|jam[aá]s|tampoco|ningun(?:a|o)?|carezco|carece|carecen|carecemos|not|without|never|neither|lack(?:ed|ing|s)?)\b/iu;
function claimPolarity(text){const raw=String(text||'');return NEGATION_RE.test(raw)||/n['’]t\b/iu.test(raw)?'negative':'positive'}
const CLAIM_CONSTRAINTS=[
  ['scope:only',/\b(?:solo|solamente|unicamente|exclusivamente|only|exclusively)\b/iu],
  ['time:since',/\b(?:desde|since)\b/iu],
  ['time:until',/\b(?:hasta|until)\b/iu],
  ['time:before',/\b(?:antes\s+de|before)\b/iu],
  ['time:after',/\b(?:despues\s+de|after)\b/iu],
  ['quant:min',/(?:\b(?:al\s+menos|como\s+minimo|un\s+minimo\s+de|minimo(?:\s+de)?|at\s+least|a\s+minimum\s+of|minimum(?:\s+of)?)\b|>=|≥)/iu],
  ['quant:exact',/\b(?:exactamente|exacto|exacta|exactly|exact)\b/iu],
  ['quant:max',/(?:\b(?:como\s+maximo|a\s+lo\s+sumo|un\s+maximo\s+de|maximo(?:\s+de)?|at\s+most|up\s+to|a\s+maximum\s+of|maximum(?:\s+of)?)\b|<=|≤)/iu],
  ['quant:approx',/(?:\b(?:aproximadamente|aprox\.?|cerca\s+de|alrededor\s+de|mas\s+o\s+menos|unos?|approximately|approx\.?|around|roughly|about|circa)\b|≈|~)/iu],
  ['quant:gt',/(?:\b(?:mas\s+de|mayor\s+que|superior\s+a|more\s+than|greater\s+than|over)\b|(?<![<>=])>(?!=))/iu],
  ['quant:lt',/(?:\b(?:menos\s+de|menor\s+que|inferior\s+a|less\s+than|fewer\s+than|under)\b|(?<![<>=])<(?!=))/iu],
  ['scope:except',/\b(?:excepto|salvo|exceptuando|a\s+excepcion\s+de|except|excluding|excepting|other\s+than)\b/iu],
  ['scope:absence',/\b(?:en\s+ausencia\s+de|durante\s+la\s+ausencia\s+de|in\s+(?:the\s+)?absence\s+of|while\s+[^,.;]+\s+was\s+absent)\b/iu],
  ['role:supervised',/\b(?:bajo\s+(?:la\s+)?supervision\s+de|supervisad[oa]\s+por|under\s+(?:the\s+)?supervision\s+of|supervised\s+by)\b/iu],
  ['scope:shared',/\b(?:responsabilidad\s+compartida|responsabilidad\s+conjunta|shared\s+responsibility|joint\s+responsibility)\b/iu],
  ['scope:percentage-share',/\b(?:contribu(?:i|í|yo|yó)|particip(?:e|é|o|ó)|aporte|aporté|aportó|responsabilidad)\b[^.!?;\n]{0,80}\b\d+(?:[.,]\d+)?\s*%/iu],
  ['scope:conditional',/\b(?:cuando|en\s+caso\s+de|siempre\s+que|when|whenever|if|while)\b/iu],
  ['scope:mostly',/\b(?:principalmente|mayormente|sobre\s+todo|mostly|mainly|primarily)\b/iu],
  ['frequency:occasional',/\b(?:ocasionalmente|a\s+veces|rara\s+vez|sometimes|occasionally|rarely)\b/iu],
  ['frequency:frequent',/\b(?:frecuentemente|a\s+menudo|often|frequently)\b/iu],
  ['frequency:regular',/\b(?:regularmente|normalmente|usualmente|tipicamente|generalmente|regularly|normally|usually|typically|generally)\b/iu],
  ['quant:almost',/\b(?:casi|almost|nearly)\b/iu],
  ['quant:average',/\b(?:en\s+promedio|de\s+media|on\s+average)\b/iu],
  ['certainty:possible',/\b(?:posible(?:s)?|potencial(?:es)?|posiblemente|quizas|quiza|tal\s+vez|podria|podrian|al\s+parecer|possible|potential|prospective|prospectiv[oa]s?|possibly|maybe|perhaps|may|might|could|apparently|reportedly)\b/iu],
  ['certainty:probable',/\b(?:probablemente|likely|probably)\b/iu],
  ['certainty:estimated',/\b(?:estimad[oa]s?|estime|estimé|estimo|estimó|estimate|estimated)\b/iu],
  ['status:future',/\b(?:will|shall|going\s+to|voy\s+a|vamos\s+a|va\s+a|iran?\s+a|planeo|planifico|planifique|planifiqué)\b/iu],
  ['status:expected',/\b(?:expected|expecting|expectativa(?:s)?|esperad[oa]s?)\b/iu],
  ['status:projected',/\b(?:projected|projection|proyectad[oa]s?|proyeccion(?:es)?)\b/iu],
  ['status:forecast',/\b(?:forecast(?:ed|ing)?|forecast|pronosticad[oa]s?|prevision(?:es)?|preveia|preveía|preveo)\b/iu],
  ['status:target',/\b(?:target(?:ed)?|objetivo|meta)\b/iu],
  ['status:planned',/\b(?:planned|planning|planificad[oa]s?|planead[oa]s?)\b/iu],
  ['status:intended',/\b(?:intend(?:ed|ing)?|intention|pretendo|pretendia|pretendía|intencion)\b/iu],
  ['modality:ability',/\b(?:can|able\s+to|capaz\s+de|puedo|puede|podemos)\b/iu],
  ['status:scheduled',/\b(?:scheduled|programad[oa]s?|previst[oa]s?)\b/iu],
  ['status:nominated',/\b(?:nominated|nominee|nominad[oa]s?)\b/iu],
  ['status:selected-future',/\b(?:selected\s+to\s+become|selected\s+to\s+serve|seleccionad[oa]s?\s+para\s+(?:ser|convertirse))\b/iu],
  ['status:proposed',/\b(?:proposed|proposal|propos(?:ed|ing)|propuest[oa]s?|propuesta(?:s)?)\b/iu],
  ['status:preliminary',/\b(?:preliminary|preliminar(?:es)?)\b/iu],
  ['status:tentative',/\b(?:tentative|tentatively|tentativ[oa]s?)\b/iu],
  ['status:pending',/\b(?:pending|pendiente(?:s)?)\b/iu],
  ['status:recommended',/\b(?:recommended|recommendation|recomendad[oa]s?|recomendacion(?:es)?)\b/iu],
  ['status:offered',/\b(?:offered|offer|ofrecid[oa]s?|oferta(?:s)?)\b/iu],
  ['status:designated-future',/\b(?:designated\s+to|designad[oa]s?\s+para)\b/iu],
  ['status:appointed-future',/\b(?:appointed\s+to\s+(?:start|begin|serve)|nombrad[oa]s?\s+para\s+(?:comenzar|iniciar|ejercer))\b/iu],
  ['status:draft',/\b(?:draft|drafted|borrador|preliminar)\b/iu],
  ['status:eligible',/\b(?:eligible\s+for|elegible\s+para)\b/iu],
  ['status:qualified-future',/\b(?:qualified\s+for|calificad[oa]s?\s+para|cualificad[oa]s?\s+para)\b/iu],
  ['status:training',/\b(?:in\s+training\s+for|training\s+to|en\s+formacion\s+para|en\s+capacitacion\s+para)\b/iu],
  ['status:shortlisted',/\b(?:shortlisted|finalist|preseleccionad[oa]s?|finalista)\b/iu],
  ['status:applied',/\b(?:applied\s+for|applicant\s+for|aplique\s+a|apliqué\s+a|solicite\s+el\s+puesto|solicité\s+el\s+puesto)\b/iu],
  ['stage:pilot',/\b(?:pilot|piloto)\b/iu],
  ['stage:prototype',/\b(?:prototype|prototipo)\b/iu],
  ['stage:experimental',/\b(?:experimental|experiment(?:al)?|experimento)\b/iu],
  ['stage:alpha',/\b(?:alpha|alfa)\b/iu],
  ['stage:beta',/\b(?:beta)\b/iu],
  ['stage:mvp',/\b(?:mvp|minimum\s+viable\s+product|producto\s+minimo\s+viable)\b/iu],
  ['stage:poc',/\b(?:poc|proof\s+of\s+concept|prueba\s+de\s+concepto)\b/iu],
  ['stage:demo',/\b(?:demo|demonstration|demostracion)\b/iu],
  ['stage:sandbox',/\b(?:sandbox|entorno\s+de\s+pruebas)\b/iu],
  ['stage:trial',/\b(?:trial|prueba\s+piloto)\b/iu],
  ['currency:dollar',/(?:\$|\b(?:usd|dolares?|dollars?)\b)/iu],
  ['currency:euro',/(?:€|\b(?:eur|euros?)\b)/iu],
  ['currency:gbp',/(?:£|\b(?:gbp|libras?\s+esterlinas?|pounds?)\b)/iu],
  ['currency:yen',/(?:¥|\b(?:jpy|yenes?|yen)\b)/iu],
  ['currency:inr',/(?:₹|\b(?:inr|rupias?|rupees?)\b)/iu],
  ['currency:mxn',/\b(?:mxn|pesos?\s+mexicanos?)\b/iu],
  ['scope:partitive',/\b(?:workstream|work\s+stream|frente\s+de\s+trabajo|fase|phase|parte|part|porcion|portion|subconjunto|subset)\b/iu],
  ['scope:some-members',/\b(?:algunos?\s+miembros?|some\s+members?)\b/iu],
  ['quant:one-explicit',/\b1\s+(?:[\p{L}]|[A-Z])/iu],
  ['role:nonprimary',/\b(?:secundari[oa]|secondary|de\s+respaldo|backup|altern[oa]|alternate)\b/iu],
  ['scope:relative-attribution',/\b(?:that|which|que|where|donde)\b/iu],
  ['scope:embedded-attribution',/\b[\p{L}][\p{L}\p{N}_-]*\s+i\s+(?:worked|designed|advised|supported|contributed|collaborated|participated|helped)\b/iu],
  ['scope:indirect-management',/\b(?:indirectamente|indirectly|dotted[- ]line|matricial|matrix)\b/iu],
  ['role:specific-scope',/\b(?:technical\s+lead|lider\s+tecnico|project\s+manager|gerente\s+de\s+proyecto)\b/iu],
  ['status:informal',/\b(?:informal(?:mente)?|unofficial(?:ly)?|de\s+facto|no\s+oficial)\b/iu],
  ['status:in-progress',/\b(?:studying\s+for|studied\s+for|pursuing|preparing\s+for|on\s+track\s+for|seeking|in\s+progress|towards?|coursework\s+towards?|enrolled\s+in|estudiando\s+para|preparando(?:me)?\s+para|en\s+proceso|cursando|matriculad[oa]\s+en)\b/iu],
  ['role:advisor',/\b(?:asesor(?:a|es)?|consultor(?:a|es)?|advisor(?:s)?|consultant(?:s)?)\b/iu],
  ['scope:geo',/\b(?:regional|local|nacional|national|global|internacional|international|emea|apac|latam|latinoamerica|latin\s+america|norteamerica|north\s+america|europa|europe)\b/iu],
  ['scope:team-member',/\b(?:miembro\s+del\s+equipo|miembro\s+de\s+un\s+equipo|team\s+member|member\s+of\s+the\s+team|member\s+of\s+a\s+team)\b/iu],
  ['scope:supporting',/\b(?:apoy(?:ar|e|o|aba|ando)?|support(?:ed|ing|s)?|asist(?:ir|i|ia|iendo)?|assist(?:ed|ing|s)?|contribu(?:ir|i|yo|yendo)?|contribut(?:e|ed|ing|es)|colabor(?:ar|e|o|ando)?|collaborat(?:e|ed|ing|es)|particip(?:ar|e|o|ando)?|participat(?:e|ed|ing|es))\b/iu],
  ['role:deputy',/\b(?:adjunto|adjunta|deputy)\b/iu],
  ['role:substitute',/\b(?:suplente|substitute)\b/iu],
  ['role:interim',/\b(?:interino|interina|acting|interim)\b/iu],
  ['time:temporary',/\b(?:temporalmente|provisionalmente|temporarily|provisionally|temporary)\b/iu],
  ['scope:partial',/\b(?:parcialmente|partially)\b/iu],
  ['scope:joint',/\b(?:conjuntamente|jointly)\b/iu],
  ['role:assistant',/\b(?:asistente|assistant)\b/iu],
  ['role:co',/\b(?:corresponsable|co-?responsable|co-?lider(?:e|o)?|co-?lead(?:er|ing|ed)?)\b/iu],
  ['scope:one-of',/\b(?:uno\s+de\s+los|una\s+de\s+las|one\s+of\s+the)\b/iu],
  ['role:associate',/\b(?:associate|asociado|asociada)\b/iu],
  ['role:junior',/\b(?:junior|jr\.?)\b/iu],
  ['role:intern',/\b(?:becari[oa]|practicante|intern|internship|trainee|apprentice)\b/iu],
  ['employment:contract',/\b(?:contratista|contractor|contract\s+role|por\s+contrato)\b/iu],
  ['employment:freelance',/\b(?:freelance|independiente|self-employed)\b/iu],
  ['employment:part-time',/\b(?:medio\s+tiempo|tiempo\s+parcial|part-time)\b/iu],
  ['employment:volunteer',/\b(?:voluntari[oa]|volunteer)\b/iu],
  ['status:former',/\b(?:ex|former|anteriormente)\b/iu],
  ['status:aspiring',/\b(?:aspirante|aspiring)\b/iu],
  ['status:candidate',/\b(?:candidat[oa]|candidate)\b/iu],
  ['role:student',/\b(?:estudiante|student)\b/iu],
  ['scope:limited',/\b(?:limitad[oa]s?|limited)\b/iu],
  ['level:basic',/\b(?:basico|basica|basicos|basicas|basic|beginner|elementary)\b/iu],
  ['level:working',/\b(?:conocimiento\s+practico|working\s+knowledge)\b/iu],
  ['role:vice',/\b(?:vice)\b/iu],
  ['role:visiting',/\b(?:visiting|visitante)\b/iu],
  ['role:adjunct',/\b(?:adjunct)\b/iu],
  ['employment:probationary',/\b(?:probationary|en\s+periodo\s+de\s+prueba|en\s+prueba)\b/iu],
  ['status:honorary',/\b(?:honorary|honorario|honoraria)\b/iu],
  ['status:emeritus',/\b(?:emeritus|emerita|emerito)\b/iu]
];
function exceptionTargetSignature(text){
  const normalized=fold(text),m=normalized.match(/\b(?:excepto|salvo|exceptuando|a\s+excepcion\s+de|except|excluding|excepting|other\s+than)\b/iu);
  if(!m)return '';
  const payload=normalized.slice((m.index||0)+m[0].length);
  const terms=relationTerms(payload).filter(x=>!String(x).startsWith('rel:')&&!/^[-+]?\d/.test(String(x)));
  return terms.length?`scope:except-target:${terms.join('>')}`:'';
}
function exceptionScopeSignatures(text){
  const normalized=fold(text),out=[],re=/\b(?:excepto|salvo|exceptuando|a\s+excepcion\s+de|except|excluding|excepting|other\s+than)\b([^.!?;:\n]*)/giu;
  for(const m of normalized.matchAll(re)){
    const terms=[...new Set(relationTerms(m[1]).filter(x=>!String(x).startsWith('rel:')&&!/^[-+]?\d/.test(String(x))))].sort();
    if(terms.length)out.push(terms.join('>'));
  }
  return out;
}
function claimConstraints(text){
  const normalized=fold(text),out=CLAIM_CONSTRAINTS.filter(([,rx])=>rx.test(normalized)).map(([id])=>id),exceptSig=exceptionTargetSignature(text);
  if(exceptSig)out.push(exceptSig);
  return out;
}
const CONSTRAINT_LEXEMES=new Set('solo solamente unicamente exclusivamente only exclusively desde since hasta until antes before despues after menos minimo minimum least maximo maximum sumo most exacto exacta exactamente exact approximately cerca approximately around roughly mas mayor superior more greater over menor inferior less fewer excepto salvo exceptuando except excluding excepting ausencia absence supervisado supervisada supervision supervised compartida compartido shared joint cuando caso siempre when whenever if while principalmente mayormente mostly mainly primarily ocasionalmente veces rara sometimes occasionally rarely frecuentemente menudo often frequently usualmente usually casi almost nearly promedio media average posiblemente quizas quiza posiblemente possibly maybe perhaps probablemente likely probably estimado estimada estime estimo estimate estimated will shall going voy vamos planeo planifico expected expecting expectativa expectativas esperado esperada projected projection proyectado proyectada proyeccion forecast forecasted forecasting pronosticado pronosticada prevision preveia preveo target targeted objetivo meta planned planning planificado planificada planeado planeada intend intended intending intention pretendo pretendia intencion can able capaz puedo puede podemos scheduled programado programada previsto prevista nominated nominee nominado nominada selected serve become seleccionado seleccionada proposed proposal proposing propuesta propuesto preliminary preliminar tentative tentatively tentativo tentativa pending pendiente recommended recommendation recomendado recomendada recomendacion offered offer ofrecido ofrecida oferta designated designado designada appointed start begin nombrado nombrada comenzar iniciar ejercer draft drafted borrador eligible elegible qualified calificado calificada cualificado cualificada training formacion capacitacion shortlisted finalist preseleccionado preseleccionada finalista applied applicant aplique solicite puesto pilot piloto prototype prototipo experimental experiment experimento alpha alfa beta mvp minimum viable product producto minimo poc proof concept prueba demo demonstration demostracion sandbox entorno trial usd dolar dolares dollar dollars eur euro euros gbp libra libras pound pounds jpy yen yenes inr rupia rupias rupee rupees mxn peso pesos mexicano mexicanos adjunto adjunta deputy suplente substitute interino interina acting interim temporalmente provisionalmente temporarily provisionally temporary parcialmente partially conjuntamente jointly asistente assistant corresponsable co-responsable co-lider co-lead uno one associate asociado asociada junior jr becario becaria practicante intern internship trainee apprentice contratista contractor contract contrato freelance independiente self-employed medio tiempo parcial part-time voluntario voluntaria volunteer ex former anteriormente aspirante aspiring candidato candidata candidate estudiante student limitado limitada limitados limitadas limited basico basica basicos basicas basic beginner elementary conocimiento practico working knowledge vice visiting visitante adjunct probationary periodo prueba honorary honorario honoraria emeritus emerita emerito'.split(/\s+/).map(stem));
const factualConstraintTerms=clause=>relationTerms(clause).filter(x=>!String(x).startsWith('rel:')&&!CONSTRAINT_LEXEMES.has(x));
function unsupportedConstraintClaims(before,after){
  const source=claimClauses(before).map(clause=>({terms:factualConstraintTerms(clause),constraints:claimConstraints(clause)})).filter(x=>x.terms.length);
  const out=[];
  for(const clause of claimClauses(after)){
    const terms=factualConstraintTerms(clause);if(!terms.length)continue;
    const related=source.filter(unit=>terms.every(t=>unit.terms.includes(t))&&relationOrderSupported(terms,unit.terms));
    if(related.length&&!related.some(unit=>sameSequence(claimConstraints(clause),unit.constraints)))out.push(clause.slice(0,180));
  }
  const sourceExceptions=new Set(exceptionScopeSignatures(before));
  for(const sig of exceptionScopeSignatures(after))if(sourceExceptions.size&&!sourceExceptions.has(sig))out.push(`excepción:${sig}`.slice(0,180));
  return [...new Set(out)];
}
function unsupportedPolarityClaims(before,after){
  const sourceUnits=claimClauses(before).map(clause=>({terms:relationTerms(clause),polarity:claimPolarity(clause)})).filter(x=>x.terms.length);
  const out=[];
  for(const clause of claimClauses(after)){
    if(nums(clause).length)continue;
    const terms=relationTerms(clause);if(!terms.length)continue;
    const related=sourceUnits.filter(unit=>terms.every(t=>unit.terms.includes(t)));
    if(related.length&&!related.some(unit=>unit.polarity===claimPolarity(clause)))out.push(clause.slice(0,180));
  }
  return out;
}
function metricClauses(text){
  const primary=String(text||'').split(/(?:[.!?;:\n]+|\s+(?:y|e|and)\s+)/giu).map(x=>x.trim()).filter(Boolean),out=[];
  for(const segment of primary){
    const parts=segment.split(/,(?=\s*\p{L})/gu).map(x=>x.trim()).filter(Boolean);
    if(parts.length>1&&parts.filter(x=>nums(x).length).length>=2)out.push(...parts);else out.push(segment);
  }
  return out;
}
function metricUnits(text){
  return metricClauses(text).map(clause=>({clause,numbers:nums(clause),terms:relationTerms(clause),polarity:claimPolarity(clause)})).filter(x=>x.numbers.length);
}
function sameSequence(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i])}
function metricAnchorsSupported(afterUnit,sourceUnit){
  if(afterUnit.polarity!==sourceUnit.polarity)return false;
  if(!sameSequence(afterUnit.numbers,sourceUnit.numbers))return false;
  if(!afterUnit.terms.length)return true;
  // Metrics are auto-applicable only when every factual/relational anchor in the
  // rewritten claim is supported in the same order by the original metric claim.
  // This prevents swapping Mexico/Spain, Oracle/PostgreSQL, client/contract, etc.
  return relationOrderSupported(afterUnit.terms,sourceUnit.terms);
}
function unsupportedMetricBindings(before,after){
  const source=metricUnits(before),out=[];
  for(const unit of metricUnits(after))if(!source.some(s=>metricAnchorsSupported(unit,s)))out.push(unit.clause.slice(0,180));
  return out;
}
function unsupportedRelationalClaims(before,after){
  const sourceUnits=claimClauses(before).map(relationTerms).filter(x=>x.length);
  const unsupported=[];
  for(const clause of claimClauses(after)){
    if(nums(clause).length)continue;
    const terms=relationTerms(clause);
    if(terms.length<2)continue;
    const supported=sourceUnits.some(unit=>terms.every(t=>unit.includes(t))&&relationOrderSupported(terms,unit));
    if(!supported)unsupported.push(clause.slice(0,180));
  }
  return unsupported;
}

const CLAIM_PATTERNS=[
  /(?:experiencia|experto|experta|especialista|especializado|especializada|dominio|manejo|conocimiento|certificado|certificada|certificación|certificacion)\s+(?:adicional\s+)?(?:con|en|de)\s+([^\n.,;:!?]+)/giu,
  /(?:trabaj(?:e|é|o|ó|ado)|utilic(?:e|é|o|ó|ado)|utilizo|uso|implement(?:e|é|o|ó|ado)|desarroll(?:e|é|o|ó|ado))\s+(?:directamente\s+)?(?:con|en|de|usando|mediante)?\s*([^\n.,;:!?]+)/giu
];
function unsupportedCertificationClaims(resume,after){
  const certSource=JSON.stringify(resume?.certifications||[]),known=set(lexicalTerms(certSource)),out=[];
  const re=/(?:certificaci[oó]n|certificaciones|certificado|certificada|certified)\s+(?:en|de|como)?\s*([^\n.,;:!?]+)/giu;
  for(const m of String(after||'').matchAll(re))for(const term of lexicalTerms(m[1]))if(!known.has(term))out.push(term);
  return [...new Set(out)];
}

function unsupportedExplicitClaims(source,after){
  const known=set(contentTerms(source)),out=[];
  for(const re of CLAIM_PATTERNS)for(const m of String(after||'').matchAll(re)){
    for(const term of contentTerms(m[1]))if(!known.has(term))out.push(term);
  }
  return [...new Set(out)];
}

export function unsupportedClaimTerms(resume,after){
  const source=textOfResume(resume),known=set(contentTerms(source)),terms=[...new Set(contentTerms(after))],novel=terms.filter(x=>!known.has(x));
  const titled=unsupportedTitleTerms(source,after);
  const ratio=terms.length?novel.length/terms.length:0;
  return{novel,titled,ratio,contentCount:terms.length};
}

export const LOCAL_AI_TASKS=[
  {id:'summary',label:'Mejorar perfil',description:'Reescribe el perfil sin añadir hechos.'},
  {id:'bullet',label:'Mejorar bullet',description:'Fortalece un logro existente sin inventar métricas.'},
  {id:'concise',label:'Hacer más conciso',description:'Reduce texto conservando significado.'}
];
export function localAiContext(resume,task,{bulletId=''}={}){
  if(task==='bullet'){
    for(const e of resume.experience||[])for(const b of e.bullets||[])if(b.id===bulletId)return{task,kind:'bullet',experienceId:e.id,bulletId:b.id,before:b.text||'',role:resume.basics?.headline||'',targetRole:resume.target?.role||'',jobRequirements:(resume.target?.requirements||[]).slice(0,20).map(x=>x.concept||x),resumeSkills:(resume.skillGroups||[]).flatMap(g=>g.skills||[])};
  }
  return{task,kind:'summary',before:resume.summary||'',role:resume.basics?.headline||'',targetRole:resume.target?.role||'',jobRequirements:(resume.target?.requirements||[]).slice(0,20).map(x=>x.concept||x),resumeSkills:(resume.skillGroups||[]).flatMap(g=>g.skills||[])};
}
export function auditLocalAiSuggestion(resume,suggestion){
  const p=clone(suggestion||{}),blockingIssues=[],warnings=[];
  if(!['summary','bullet'].includes(p.kind))blockingIssues.push('Tipo de cambio no permitido.');
  if(typeof p.before!=='string'||typeof p.after!=='string'||!p.after.trim())blockingIssues.push('Cambio vacío o inválido.');
  let current='',found=p.kind==='summary';
  if(p.kind==='summary')current=resume.summary||'';
  else for(const e of resume.experience||[])for(const b of e.bullets||[])if(b.id===p.bulletId){current=b.text||'';found=true}
  if(!found)blockingIssues.push('El bullet de origen ya no existe.');
  if(current!==p.before)blockingIssues.push('El texto original cambió desde que se generó la propuesta.');
  const sourceText=textOfResume(resume),allowedNums=set(nums(current)),techVersionNovel=unsupportedTechnicalVersions(sourceText,p.after);
  for(const n of nums(p.after))if(!allowedNums.has(n))warnings.push(`Cifra fuera de contexto respecto al texto original (${n}); revísala antes de aplicar.`);
  if(techVersionNovel.length)warnings.push(`Versión técnica nueva respecto al CV: ${techVersionNovel.slice(0,6).join(', ')}.`);
  const missing=(resume.target?.requirements||[]).filter(x=>!x.matched).map(x=>String(x.concept||'').toLowerCase()).filter(Boolean),lower=p.after.toLowerCase();
  for(const term of missing)if(term.length>2&&lower.includes(term)&&!sourceText.toLowerCase().includes(term))warnings.push(`La redacción usa un requisito de la vacante que no aparece demostrado en el CV: ${term}.`);
  const evidenceText=factualEvidenceText(resume),unsupported=unsupportedClaimTerms(resume,p.after),positiveNovel=unsupportedPositiveEvidenceTerms(sourceText,p.after),editedTextNovel=unsupportedPositiveEvidenceTerms(current,p.after),relationalRaw=unsupportedRelationalClaims(evidenceText,p.after),polarityUnsupported=unsupportedPolarityClaims(current,p.after),constraintUnsupported=unsupportedConstraintClaims(current,p.after),metricUnsupported=unsupportedMetricBindings(current,p.after),explicit=unsupportedExplicitClaims(sourceText,p.after),certNovel=unsupportedCertificationClaims(resume,p.after),techNovel=technicalNovelTerms(sourceText,p.after),acronymNovel=unsupportedAcronyms(sourceText,p.after),durationNovel=unsupportedDurations(current,p.after),positiveRemaining=positiveNovel.filter(x=>!(x==='certific'&&!certNovel.length)),editedRemaining=editedTextNovel.filter(x=>positiveRemaining.includes(x)),contextSupportedNovel=editedTextNovel.filter(x=>!positiveRemaining.includes(x)&&!(x==='certific'&&!certNovel.length)),relationalUnsupported=relationalRaw.filter(x=>certNovel.length||!/(?:certificaci[oó]n|certificado|certificada|certified)/iu.test(x));
  if(techNovel.length)warnings.push(`Tecnología nueva respecto al CV: ${techNovel.slice(0,6).join(', ')}.`);
  if(acronymNovel.length)warnings.push(`Sigla o credencial nueva respecto al CV: ${acronymNovel.slice(0,6).join(', ')}.`);
  if(durationNovel.length)warnings.push('La propuesta cambia una duración o antigüedad respecto al texto editado.');
  if(editedRemaining.length)warnings.push(`Hay vocabulario factual nuevo que no aparece respaldado claramente (${editedRemaining.slice(0,6).join(', ')}).`);
  if(relationalUnsupported.length)warnings.push(`La propuesta recombina hechos o relaciones que no aparecen respaldados en una misma unidad factual; conviene revisar (${relationalUnsupported.slice(0,2).join(' | ')}).`);
  if(polarityUnsupported.length)warnings.push(`La propuesta podría cambiar una negación o el sentido de una afirmación (${polarityUnsupported.slice(0,2).join(' | ')}).`);
  if(constraintUnsupported.length)warnings.push(`La propuesta podría cambiar una restricción temporal, cuantitativa o de alcance (${constraintUnsupported.slice(0,2).join(' | ')}).`);
  if(metricUnsupported.length)warnings.push(`Revisa la asociación de cifras, métricas o fechas (${metricUnsupported.slice(0,2).join(' | ')}).`);
  if(certNovel.length)warnings.push(`Posible certificación no demostrada: ${certNovel.slice(0,6).join(', ')}.`);
  if(explicit.length)warnings.push(`Posible conocimiento o experiencia nueva: ${explicit.slice(0,6).join(', ')}.`);
  if(unsupported.titled.length)warnings.push(`Posible entidad o tecnología nueva: ${unsupported.titled.slice(0,4).join(', ')}.`);
  if(positiveRemaining.length)warnings.push(`Hay afirmaciones o vocabulario nuevo sin evidencia positiva clara; conviene confirmar (${positiveRemaining.slice(0,6).join(', ')}).`);
  if(unsupported.novel.length>=3&&unsupported.ratio>0.45)warnings.push(`La propuesta cambia bastante la redacción original (${unsupported.novel.slice(0,6).join(', ')}).`);
  for(const warning of Array.isArray(p.serverWarnings)?p.serverWarnings:[])if(warning)warnings.push(`Servidor local: ${String(warning)}`);
  if(p.needsUserFact)warnings.push('El modelo indicó que necesita un dato del usuario.');
  const serverStatus=['verified','review','blocked'].includes(p.factualStatus)?p.factualStatus:'';
  const editorialOnly=isEditoriallyVerified(current,p.after),issues=[...blockingIssues,...warnings];
  let status=blockingIssues.length?'blocked':(warnings.length||serverStatus==='review'||serverStatus==='blocked'||!editorialOnly?'review':'verified');
  const reviewReasons=[];
  if(status==='review')reviewReasons.push('Compara ANTES y DESPUÉS. Las alertas son informativas y no impiden aplicar la propuesta.');
  if(status==='review'&&warnings.length)reviewReasons.push(`${warnings.length} señal(es) automática(s) para revisar; ninguna funciona como bloqueo factual.`);
  if(status==='review'&&contextSupportedNovel.length)reviewReasons.push(`Parte de la redacción nueva aparece respaldada por otras secciones del CV (${contextSupportedNovel.slice(0,6).join(', ')}).`);
  if(serverStatus==='review'||serverStatus==='blocked')reviewReasons.push('El modelo local marcó la propuesta como dudosa; se conserva como aviso para tu revisión.');
  return{safe:blockingIssues.length===0&&warnings.length===0,status,autoApply:status==='verified',canApply:blockingIssues.length===0,reviewReasons,warnings,issues,blockingIssues,current,suggestion:p,unsupported,explicitUnsupported:explicit,certificationUnsupported:certNovel,technicalUnsupported:techNovel,acronymUnsupported:acronymNovel,durationUnsupported:durationNovel,positiveEvidenceUnsupported:positiveRemaining,editedTextUnsupported:editedRemaining,contextSupportedNovel,relationalUnsupported,polarityUnsupported,constraintUnsupported,metricUnsupported};
}
export function applyLocalAiSuggestion(resume,suggestion,{reviewed=false}={}){
  const a=auditLocalAiSuggestion(resume,suggestion);if(a.status==='blocked')throw new Error(a.issues.join(' ')||'La propuesta ya no puede aplicarse porque el origen cambió o es inválido.');
  if(a.status==='review'&&!reviewed)throw new Error('Esta propuesta requiere revisión humana: compara ANTES/DESPUÉS antes de aplicarla.');
  const before=factFingerprint(resume);
  if(suggestion.kind==='summary')resume.summary=suggestion.after;
  else{let hit=false;for(const e of resume.experience||[])for(const b of e.bullets||[])if(b.id===suggestion.bulletId){b.text=suggestion.after;hit=true}if(!hit)throw new Error('Bullet no encontrado')}
  if(factFingerprint(resume)===before&&suggestion.after!==suggestion.before)throw new Error('No se aplicó el cambio');
  return true;
}
export function localAiPrivacyStatement(){return 'Ollama se consulta únicamente en 127.0.0.1:11434. Hoja no descarga modelos y bloquea nombres de modelo cloud.'}
