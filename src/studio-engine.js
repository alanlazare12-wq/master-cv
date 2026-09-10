import {resumePlainText} from './ats-engine.js?v=48';
import {templateById,applyDesignProfile,resetTemplateDesign} from './personal-templates.js?v=48';

export function estimatePages(resume){
  const words=resumePlainText(resume).trim().split(/\s+/).filter(Boolean).length;
  const s=resume.settings||{};
  let capacity=s.density==='compact'?690:s.density==='airy'?430:540;
  if(s.layout==='dual') capacity+=40;
  if(s.margin==='narrow') capacity+=80;
  if(s.margin==='wide') capacity-=65;
  capacity=Math.max(280,capacity/Math.max(.82,Number(s.fontScale||1)));
  return {words,pages:Math.max(1,Math.ceil(words/capacity)),capacity:Math.round(capacity)};
}

export function moveSection(resume,id,direction){
  const order=resume.settings.sectionOrder||[];const i=order.indexOf(id);if(i<0)return false;
  const j=direction==='up'?i-1:i+1;if(j<0||j>=order.length)return false;
  [order[i],order[j]]=[order[j],order[i]];return true;
}
export function toggleSection(resume,id){
  const hidden=new Set(resume.settings.hiddenSections||[]);hidden.has(id)?hidden.delete(id):hidden.add(id);resume.settings.hiddenSections=[...hidden];return !hidden.has(id);
}
export function addSection(resume,id){
  resume.settings.sectionOrder=resume.settings.sectionOrder||[];
  if(!resume.settings.sectionOrder.includes(id))resume.settings.sectionOrder.push(id);
  resume.settings.hiddenSections=(resume.settings.hiddenSections||[]).filter(x=>x!==id);
}
export function removeSection(resume,id){
  resume.settings.hiddenSections=[...new Set([...(resume.settings.hiddenSections||[]),id])];
}
export function designSummary(resume){
  const t=templateById(resume.settings.templateId),p=estimatePages(resume);
  return {template:t.name,risk:t.risk,layout:resume.settings.layout,font:resume.settings.font,density:resume.settings.density,margin:resume.settings.margin,pages:p.pages,words:p.words};
}
export function safeATSProfile(resume){applyDesignProfile(resume,'ats');return designSummary(resume)}
export function fitOnePageProfile(resume){applyDesignProfile(resume,'onepage');return designSummary(resume)}
export function presentationProfile(resume){applyDesignProfile(resume,'presentation');return designSummary(resume)}
export function resetDesign(resume){resetTemplateDesign(resume);return designSummary(resume)}
