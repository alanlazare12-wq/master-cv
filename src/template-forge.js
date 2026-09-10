import {templateById,applyTemplateToResume} from './personal-templates.js?v=48';

const clone=o=>structuredClone(o);
export const FORGE_VERSION=1;
export const FORGE_LIMIT=120;
export const FORGE_TOKENS={
  headerStyle:['line','band','minimal','centered'],
  headingStyle:['line','caps','pill','plain'],
  dividerStyle:['solid','light','none'],
  contactStyle:['inline','stacked'],
  photoShape:['circle','rounded','square'],photoPosition:['left','right','center','sidebar'],photoSize:['small','medium','large'],
  layout:['single','dual'],
  density:['airy','comfortable','compact'],
  margin:['wide','normal','narrow'],
  lineHeight:['compact','normal','relaxed'],
  paper:['a4','letter']
};
const DESIGN_KEYS=['accent','font','layout','density','margin','fontScale','lineHeight','paper','headerStyle','headingStyle','dividerStyle','contactStyle','showPhoto','photoShape','photoPosition','photoSize'];
const facts=r=>{const basics={...(r.basics||{})};delete basics.photo;return JSON.stringify({basics,summary:r.summary,experience:r.experience,education:r.education,skillGroups:r.skillGroups,projects:r.projects,certifications:r.certifications,languages:r.languages,achievements:r.achievements,genericSections:r.genericSections,customSections:r.customSections})};
const safeName=s=>String(s||'Mi plantilla').trim().slice(0,80)||'Mi plantilla';
const safeHex=(v,fallback='#111827')=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):fallback;
const safeRecipeId=v=>{const raw=String(v||'');return /^[A-Za-z0-9_-]{1,80}$/.test(raw)?raw:`forge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`};

export function normalizeThemeRecipe(raw={}){
  const base=templateById(raw.baseId||'ats-ink'),o=raw.overrides||{};
  const overrides={
    accent:safeHex(o.accent,base.accent),
    font:['Arial','Inter','Georgia','Verdana','Trebuchet MS','Times New Roman'].includes(o.font)?o.font:base.font,
    layout:FORGE_TOKENS.layout.includes(o.layout)?o.layout:base.layout,
    density:FORGE_TOKENS.density.includes(o.density)?o.density:base.density,
    margin:FORGE_TOKENS.margin.includes(o.margin)?o.margin:base.margin,
    fontScale:Math.max(.82,Math.min(1.18,Number(o.fontScale)||base.fontScale||1)),
    lineHeight:FORGE_TOKENS.lineHeight.includes(o.lineHeight)?o.lineHeight:base.lineHeight||'normal',
    paper:FORGE_TOKENS.paper.includes(o.paper)?o.paper:'a4',
    headerStyle:FORGE_TOKENS.headerStyle.includes(o.headerStyle)?o.headerStyle:'line',
    headingStyle:FORGE_TOKENS.headingStyle.includes(o.headingStyle)?o.headingStyle:'line',
    dividerStyle:FORGE_TOKENS.dividerStyle.includes(o.dividerStyle)?o.dividerStyle:'light',
    contactStyle:FORGE_TOKENS.contactStyle.includes(o.contactStyle)?o.contactStyle:'inline',
    showPhoto:typeof o.showPhoto==='boolean'?o.showPhoto:!!base.photoFriendly,
    photoShape:FORGE_TOKENS.photoShape.includes(o.photoShape)?o.photoShape:(base.photoShape||'circle'),
    photoPosition:FORGE_TOKENS.photoPosition.includes(o.photoPosition)?o.photoPosition:(base.photoPosition||'left'),
    photoSize:FORGE_TOKENS.photoSize.includes(o.photoSize)?o.photoSize:(base.photoSize||'medium')
  };
  return{id:safeRecipeId(raw.id),version:FORGE_VERSION,name:safeName(raw.name),baseId:base.id,createdAt:Number(raw.createdAt)||Date.now(),updatedAt:Number(raw.updatedAt)||Date.now(),overrides};
}
export function createThemeRecipe(baseId,name,overrides={}){return normalizeThemeRecipe({baseId,name,overrides})}
export function cloneThemeRecipe(recipe,name){const x=normalizeThemeRecipe(recipe);return normalizeThemeRecipe({...clone(x),id:'',name:name||`${x.name} · copia`,createdAt:Date.now(),updatedAt:Date.now()})}
export function validateThemeRecipe(recipe){const r=normalizeThemeRecipe(recipe),issues=[];if(!recipe?.name?.trim())issues.push('Añade un nombre.');if(!templateById(r.baseId))issues.push('Preset base inválido.');return{ok:issues.length===0,issues,recipe:r}}
export function applyThemeRecipe(resume,recipe){const r=normalizeThemeRecipe(recipe),before=facts(resume);applyTemplateToResume(resume,r.baseId);for(const k of DESIGN_KEYS)resume.settings[k]=clone(r.overrides[k]);resume.settings.forgeRecipeId=r.id;resume.settings.forgeRecipeName=r.name;resume.settings.forgeRecipeVersion=r.version;if(facts(resume)!==before)throw new Error('Template Forge changed resume facts');return r}
export function recipeFromResume(resume,name='Mi plantilla'){const t=templateById(resume.settings?.templateId);const o={};for(const k of DESIGN_KEYS)o[k]=clone(resume.settings?.[k]);return createThemeRecipe(t.id,name,o)}
export function recipeSummary(recipe){const r=normalizeThemeRecipe(recipe),base=templateById(r.baseId);return{name:r.name,base:base.name,layout:r.overrides.layout,font:r.overrides.font,accent:r.overrides.accent,risk:r.overrides.layout==='dual'?(base.risk==='high'?'high':'medium'):base.risk}}
export function sanitizeRecipeLibrary(items){const out=[],seen=new Set();for(const item of Array.isArray(items)?items:[]){const r=normalizeThemeRecipe(item);if(seen.has(r.id))continue;seen.add(r.id);out.push(r);if(out.length>=FORGE_LIMIT)break}return out}
