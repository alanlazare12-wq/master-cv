import {uid} from './schema.js?v=48';
const clean=v=>String(v??'').trim();
export function normalizeEvidence(items,{sourceKind='',fileName='',model=''}={}){
  return (Array.isArray(items)?items:[]).slice(0,200).map(item=>{
    if(!item||typeof item!=='object')return null;
    const quote=clean(item.quote||item.text).slice(0,1800),field=clean(item.field||item.anchor).slice(0,180),page=Number.isFinite(+item.page)&&+item.page>0?Math.floor(+item.page):null,confidence=Number.isFinite(+item.confidence)?Math.max(0,Math.min(100,+item.confidence)):0;
    if(!quote&&!field)return null;
    return{id:clean(item.id)||uid('evidence'),type:'source',title:field||'Evidencia',text:quote,tags:['source',clean(item.sourceKind||sourceKind),model].filter(Boolean).slice(0,8),anchor:field,quote,sourceKind:clean(item.sourceKind||sourceKind).slice(0,80),fileName:clean(item.fileName||fileName).slice(0,260),page,confidence,verified:item.verified===true,createdAt:Date.now(),updatedAt:Date.now()};
  }).filter(Boolean);
}
export function evidenceForAnchor(resume,anchor){const a=clean(anchor);return (resume?.evidenceVault||[]).filter(e=>e?.anchor===a||e?.title===a)}
export function evidenceSummary(resume){const xs=resume?.evidenceVault||[],source=xs.filter(x=>x?.type==='source'),careerFacts=xs.filter(x=>x?.type==='career-fact');return{total:xs.length,source:source.length,careerFacts:careerFacts.length,verified:source.filter(x=>x.verified).length,pages:[...new Set(source.map(x=>x.page).filter(Boolean))].length};}

export function addCareerFact(resume,{anchor='',title='Hecho de carrera',text='',tags=[]}={}){const value=clean(text).slice(0,12000);if(!value)throw new Error('Escribe una respuesta antes de guardarla.');resume.evidenceVault=Array.isArray(resume.evidenceVault)?resume.evidenceVault:[];const a=clean(anchor).slice(0,200),now=Date.now(),existing=resume.evidenceVault.find(x=>x?.type==='career-fact'&&x?.anchor===a);const item={id:existing?.id||uid('fact'),type:'career-fact',title:clean(title).slice(0,300)||'Hecho de carrera',text:value,quote:value.slice(0,1800),tags:[...new Set(['career-fact','user-confirmed',...(Array.isArray(tags)?tags:[])])].slice(0,8),anchor:a,sourceKind:'user',fileName:'',page:null,confidence:100,verified:false,createdAt:existing?.createdAt||now,updatedAt:now};if(existing)Object.assign(existing,item);else resume.evidenceVault.push(item);resume.evidenceVault=resume.evidenceVault.slice(-500);return item}
export function careerFactBank(resume){return (resume?.evidenceVault||[]).filter(x=>x?.type==='career-fact').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))}
