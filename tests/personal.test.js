import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultResume,makeGenericItem,normalizeResume,migrateLegacy} from '../src/schema.js';
import {PERSONAL_TEMPLATES,TEMPLATE_FAMILIES,PALETTES,templateById,applyTemplateToResume,applyDesignProfile,renderResumeHtml} from '../src/personal-templates.js';
import {analyzeResume,atsTextView} from '../src/ats-engine.js';
import {parseJobDescription,matchResumeToJob} from '../src/job-engine.js';
import {buildDocxBytes} from '../src/exporters.js';
import {estimatePages,moveSection,toggleSection,addSection} from '../src/studio-engine.js';
import {STUDIO_PACKS,ensureDesignVariants,switchDesignVariant,applyStudioPack,compositionReport,compareVersion,maybeAutoSnapshot} from '../src/studio-pro.js';
import {RESUME_MODES,applyResumeMode,assignSectionColumn,togglePageBreak,setPageStrategy,buildPagePlan,templateAudit,importReview} from '../src/local-pro.js';
import {TEMPLATE_COLLECTIONS,writingCoach,snapshotDiff,exportIntegrityAudit,pageQuality,factFingerprint} from '../src/local-premium.js';
import {createThemeRecipe,applyThemeRecipe,recipeFromResume,recipeSummary,sanitizeRecipeLibrary,normalizeThemeRecipe,validateThemeRecipe,FORGE_LIMIT} from '../src/template-forge.js';
import {localAiContext,auditLocalAiSuggestion,applyLocalAiSuggestion,unsupportedClaimTerms,LOCAL_AI_TASKS,localAiPrivacyStatement} from '../src/local-ai.js';
import {ensureWorkbench,captureReleaseProfile,applyReleaseProfile,deleteReleaseProfile,createTestCase,deleteTestCase,runTestCase,runTestSuite,runReleaseGate,recordRelease,compareReleaseRecords,workbenchSummary,PROFILE_LIMIT,TEST_CASE_LIMIT,RELEASE_HISTORY_LIMIT} from '../src/resume-workbench.js';
import {readJsonStorage,persistState,persistJsonBundle,captureStorage,restoreStorage,snapshotResume,compactResumeHistory,MAX_MANUAL_VERSIONS,MAX_AUTO_VERSIONS,persistedResumeTimestamp,hasNewerPersistedResume} from '../src/storage.js';
import {markAsMaster,touchMaster,careerSharedFingerprint,createVariantFromMaster,createTargetedVariantFromMaster,syncVariantFromMaster,variantSyncStatus} from '../src/career-pack.js';
import {normalizeEvidence,evidenceSummary,addCareerFact,careerFactBank} from '../src/evidence.js';
import {pageGuideModel,fitOnePageSettings,planOnePageSettings} from '../src/page-tools.js';
import {indexedDbAvailable,createDurableEnvelope,normalizeDurableEnvelope,compareDurableEnvelopes,newestDurableEnvelope,stateLatestTimestamp,mirrorState,readMirroredState} from '../src/durable-store.js';
import {createTabSync} from '../src/tab-sync.js';
import {resolveConflictState} from '../src/conflict-resolver.js';
import {APP_MAJOR,APP_VERSION,storageKey,legacyStorageKeys} from '../src/version.js';
import {chatGptResumeSnapshot,praxisNodeConnectionGuide,syncChatGptBridge,disableChatGptBridge,getChatGptBridgeState,resolveChatGptBridgeProposal,applyBridgeEditProposal,formatBridgeProposalValue,proposalLocationLabel} from '../src/chatgpt-bridge.js';
import {cvScore,exportChecklist,impactQuestions,interviewQuestions,printFitProfile,professionalFilename,mergeResumeContent} from '../src/resume-intelligence.js';
import {buildExportDocument,buildExportPdfPayload,exportDocumentSpec,exportDocumentSignature} from '../src/export-document.js';


test('biblioteca personal contiene 528 presets unicos',()=>{
  assert.equal(TEMPLATE_FAMILIES.length,44);
  assert.equal(Object.keys(PALETTES).length,12);
  assert.equal(PERSONAL_TEMPLATES.length,528);
  assert.equal(new Set(PERSONAL_TEMPLATES.map(x=>x.id)).size,528);
  assert.ok(PERSONAL_TEMPLATES.filter(x=>x.risk==='low').length>=380);
  assert.ok(PERSONAL_TEMPLATES.some(x=>x.family==='developer'));
  assert.ok(PERSONAL_TEMPLATES.some(x=>x.family==='legal'));
});

test('v42 biblioteca incluye 48 presets Con foto y aplica diseño fotográfico',()=>{
  const photo=PERSONAL_TEMPLATES.filter(x=>x.photoFriendly);
  assert.equal(photo.length,48);
  assert.ok(photo.every(x=>x.category==='Con foto'));
  const r=defaultResume();applyTemplateToResume(r,'portrait-modern-navy');
  assert.equal(r.settings.showPhoto,true);assert.equal(r.settings.photoShape,'circle');
  assert.ok(['left','right','center','sidebar'].includes(r.settings.photoPosition));
});

test('v42 normalizeResume acepta sólo fotos data-url raster pequeñas',()=>{
  const good='data:image/jpeg;base64,QUJD';
  assert.equal(normalizeResume({basics:{photo:good}}).basics.photo,good);
  assert.equal(normalizeResume({basics:{photo:'javascript:alert(1)'}}).basics.photo,'');
  assert.equal(normalizeResume({basics:{photo:'data:image/svg+xml;base64,PHN2Zz4='}}).basics.photo,'');
  assert.equal(normalizeResume({basics:{photo:'data:image/png;base64,'+'A'.repeat(180001)}}).basics.photo,'');
});

test('v42 renderer muestra foto sólo cuando existe o en preview interactiva',()=>{
  const r=defaultResume();r.settings.showPhoto=true;r.basics.photo='data:image/jpeg;base64,QUJD';
  assert.match(renderResumeHtml(r),/class="resume-photo"/);
  r.basics.photo='';
  const clean=renderResumeHtml(r),interactive=renderResumeHtml(r,{interactive:true});
  assert.doesNotMatch(clean,/resume-photo-wrap/);
  assert.match(interactive,/resume-photo-placeholder/);
});

test('v42 foto eleva riesgo visual y perfil ATS la oculta',()=>{
  const r=defaultResume();applyTemplateToResume(r,'ats-ink');r.basics.photo='data:image/jpeg;base64,QUJD';r.settings.showPhoto=true;
  assert.notEqual(analyzeResume(r).metrics.templateRisk,'low');
  applyDesignProfile(r,'ats');assert.equal(r.settings.showPhoto,false);
});

test('v42 snapshots no duplican la foto de perfil',()=>{
  const r=defaultResume();r.basics.photo='data:image/jpeg;base64,'+'A'.repeat(100000);
  const snap=snapshotResume(r);assert.equal(snap.basics.photo,undefined);assert.equal(r.basics.photo.length>100000,true);
});

test('v42 cambiar sólo la foto no altera fingerprint factual',()=>{
  const a=defaultResume(),b=structuredClone(a);a.basics.photo='data:image/jpeg;base64,QUJD';b.basics.photo='data:image/png;base64,REVG';
  assert.equal(factFingerprint(a),factFingerprint(b));
});


test('aplicar plantilla no cambia hechos del CV',()=>{
  const r=defaultResume(),facts=JSON.stringify({basics:r.basics,experience:r.experience,education:r.education,skills:r.skillGroups});
  applyTemplateToResume(r,'creative-cobalt');
  assert.equal(r.settings.templateFamily,'creative');assert.equal(r.settings.layout,'dual');
  assert.equal(JSON.stringify({basics:r.basics,experience:r.experience,education:r.education,skills:r.skillGroups}),facts);
});

test('perfil ATS corrige layout visual sin cambiar contenido',()=>{
  const r=defaultResume();applyTemplateToResume(r,'creative-violet');const before=r.summary;applyDesignProfile(r,'ats');
  assert.equal(r.settings.layout,'single');assert.equal(r.settings.font,'Arial');assert.equal(r.summary,before);assert.equal(analyzeResume(r).metrics.templateRisk,'low');
});

test('forzar dos columnas eleva riesgo de un preset bajo',()=>{
  const r=defaultResume();applyTemplateToResume(r,'ats-ink');r.settings.layout='dual';assert.equal(analyzeResume(r).metrics.templateRisk,'medium');
});

test('estimador de páginas responde a densidad',()=>{
  const r=defaultResume();r.summary=('experiencia producto diseño resultados '.repeat(140));r.settings.density='airy';const airy=estimatePages(r).pages;r.settings.density='compact';r.settings.margin='narrow';const compact=estimatePages(r).pages;assert.ok(compact<=airy);
});

test('gestor de secciones reordena oculta y agrega',()=>{
  const r=defaultResume();const before=[...r.settings.sectionOrder];moveSection(r,'experience','up');assert.notDeepEqual(r.settings.sectionOrder,before);toggleSection(r,'skills');assert.ok(r.settings.hiddenSections.includes('skills'));addSection(r,'awards');assert.ok(r.settings.sectionOrder.includes('awards'));r.genericSections.awards=[makeGenericItem('awards','Premio X')];assert.match(renderResumeHtml(r),/Premio X/);
});

test('vista ATS conserva contenido esencial',()=>{const t=atsTextView(defaultResume());assert.match(t,/Ana García López/);assert.match(t,/EXPERIENCIA PROFESIONAL/);assert.match(t,/HABILIDADES/)});

test('v48 preview y ATS conservan fechas y URLs estructuradas',()=>{
  const r=defaultResume();r.settings.sectionOrder.push('achievements');r.projects=[{id:'p_fields',name:'Portal QA',role:'Full Stack',url:'https://example.com/portal',startDate:'2024',endDate:'2025',description:'Proyecto verificable',bullets:[{id:'pb_fields',text:'Automaticé despliegues'}]}];r.certifications=[{id:'c_fields',name:'Cert QA',issuer:'Entidad',date:'2025',url:'https://example.com/cert'}];r.achievements=[{id:'a_fields',title:'Premio QA',date:'2026',description:'Reconocimiento técnico'}];
  const html=renderResumeHtml(r),ats=atsTextView(r);
  for(const value of ['https://example.com/portal','2024','2025','https://example.com/cert','Premio QA','2026']){assert.ok(html.includes(value),value);assert.ok(ats.includes(value),value)}
});

test('v48 secciones genéricas y personalizadas conservan URL en preview, ATS y validación',()=>{
  const r=defaultResume(),pub=makeGenericItem('publications','Artículo técnico');pub.url='https://example.com/paper?utm_source=cv';pub.description='Arquitectura distribuida';r.genericSections.publications=[pub];addSection(r,'publications');
  r.customSections=[{id:'custom_links',title:'Portafolio adicional',icon:'＋',items:[{id:'custom_item_link',type:'custom-item',title:'Caso técnico',subtitle:'',location:'',startDate:'2025',endDate:'2026',url:'https://example.com/case',description:'Caso verificable',bullets:[]}]}];r.settings.sectionOrder.push('custom:custom_links');
  const html=renderResumeHtml(r),ats=atsTextView(r),analysis=analyzeResume(r);
  for(const url of [pub.url,'https://example.com/case']){assert.ok(html.includes(url),url);assert.ok(ats.includes(url),url)}
  assert.equal(analysis.checks.find(x=>x.id==='links')?.pass,false);
});

test('v48 firma de exportación cambia al editar contenido genérico/custom sin depender de updatedAt',()=>{
  const r=defaultResume(),item=makeGenericItem('publications','Artículo');item.url='https://example.com/a';r.genericSections.publications=[item];addSection(r,'publications');
  const before=exportDocumentSignature(r),stamp=r.updatedAt;r.genericSections.publications[0].url='https://example.com/b';assert.equal(r.updatedAt,stamp);assert.notEqual(exportDocumentSignature(r),before);
  r.customSections=[{id:'custom_signature',title:'Custom',icon:'＋',items:[{id:'ci_signature',type:'custom-item',title:'Caso',subtitle:'',location:'',startDate:'',endDate:'',url:'https://example.com/c1',description:'',bullets:[]}]}];r.settings.sectionOrder.push('custom:custom_signature');
  const customBefore=exportDocumentSignature(r);r.customSections[0].items[0].url='https://example.com/c2';assert.notEqual(exportDocumentSignature(r),customBefore);
});

test('v48 Job Match reconoce idiomas y evidencia en secciones personalizadas',()=>{
  const r=defaultResume();r.languages=[{id:'lang_en',language:'English',level:'C1'}];r.customSections=[{id:'custom_cloud',title:'Stack adicional',icon:'＋',items:[{id:'ci_cloud',type:'custom-item',title:'Cloud',subtitle:'',location:'',startDate:'',endDate:'',url:'',description:'Trabajé con Kubernetes en producción.',bullets:[]}]}];r.settings.sectionOrder.push('custom:custom_cloud');
  const job=parseJobDescription('English is required. Kubernetes required.',{role:'Platform Engineer'}),match=matchResumeToJob(r,job);
  const english=match.requirements.find(x=>x.concept==='english'),k8s=match.requirements.find(x=>x.concept==='kubernetes');assert.equal(english?.status,'matched');assert.equal(k8s?.status,'partial');assert.ok(k8s?.evidenceFound?.some(x=>/Stack adicional/.test(x.where)));
});

test('v48 ATS y Job Match ignoran evidencia de secciones ocultas',()=>{
  const r=defaultResume();r.skillGroups=[{id:'skills_hidden',name:'Infra',skills:['Kubernetes']}];
  const job=parseJobDescription('Kubernetes is required.',{role:'Platform Engineer'});
  assert.equal(matchResumeToJob(r,job).requirements.find(x=>x.concept==='kubernetes')?.status,'partial');
  const visibleWords=analyzeResume(r,job).metrics.wordCount;r.settings.hiddenSections=[...(r.settings.hiddenSections||[]),'skills'];
  assert.equal(matchResumeToJob(r,job).requirements.find(x=>x.concept==='kubernetes')?.status,'missing');
  assert.ok(analyzeResume(r,job).metrics.wordCount<visibleWords);
});

test('v48 plan de páginas y composición incluyen Logros visibles',()=>{
  const r=defaultResume();r.settings.sectionOrder.push('achievements');r.achievements=[{id:'ach_plan',title:'Premio técnico',date:'2026',description:'impacto '.repeat(160)}];
  const plan=buildPagePlan(r),report=compositionReport(r);
  assert.ok(plan.pages.some(p=>p.sections.some(s=>s.id==='achievements')));assert.ok(report.sections.some(s=>s.id==='achievements'&&s.words>100));
  r.settings.sectionOrder=r.settings.sectionOrder.filter(id=>id!=='achievements');assert.equal(compositionReport(r).sections.some(s=>s.id==='achievements'),false);
});

test('job match distingue requisitos y genera score',()=>{const r=defaultResume();r.skillGroups[0].skills.push('SQL','Python');r.experience[0].bullets.push({id:'b_py',text:'Desarrollé automatizaciones con Python y SQL para análisis de producto.'});const job=parseJobDescription('Buscamos Senior Product Designer. Requerido: Figma, UX Research, SQL y Python. Deseable: AWS. Experiencia de 5 años trabajando con producto y equipos multidisciplinares.',{role:'Senior Product Designer'});const m=matchResumeToJob(r,job);assert.equal(typeof m.score,'number');assert.ok(m.matched.some(x=>['python','sql','figma'].includes(x.concept)))});


function storedZipEntry(bytes,target){
  const dec=new TextDecoder();let at=0;
  while(at+30<=bytes.length){
    const v=new DataView(bytes.buffer,bytes.byteOffset+at,Math.min(bytes.length-at,30));
    if(v.getUint32(0,true)!==0x04034b50)break;
    const size=v.getUint32(18,true),nameLen=v.getUint16(26,true),extraLen=v.getUint16(28,true),nameStart=at+30,dataStart=nameStart+nameLen+extraLen;
    const name=dec.decode(bytes.slice(nameStart,nameStart+nameLen));
    if(name===target)return dec.decode(bytes.slice(dataStart,dataStart+size));
    at=dataStart+size;
  }
  return null;
}
test('DOCX se genera como ZIP OpenXML',()=>{const bytes=buildDocxBytes(defaultResume());assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);assert.ok(bytes.length>1000)});

test('v48 DOCX respeta el papel A4 o Letter configurado',()=>{
  const a4=defaultResume(),letter=defaultResume();letter.settings.paper='letter';
  const a4Xml=storedZipEntry(buildDocxBytes(a4),'word/document.xml'),letterXml=storedZipEntry(buildDocxBytes(letter),'word/document.xml');
  assert.match(a4Xml,/w:pgSz w:w="11906" w:h="16838"/);assert.match(letterXml,/w:pgSz w:w="12240" w:h="15840"/);
});

test('v28 DOCX elimina caracteres prohibidos por XML 1.0',()=>{
  const r=defaultResume();r.basics.fullName='QA\u0001 Nombre\u000B Seguro';r.summary='Texto\u0000 válido & < > con control\u001F.';
  const xml=storedZipEntry(buildDocxBytes(r),'word/document.xml');assert.ok(xml);
  assert.equal(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(xml),false);
  assert.match(xml,/QA Nombre Seguro/);assert.match(xml,/&amp;/);assert.match(xml,/&lt;/);assert.match(xml,/&gt;/);
});


test('todos los presets son coherentes',()=>{const allowed=new Set(TEMPLATE_FAMILIES.map(x=>x.id));for(const t of PERSONAL_TEMPLATES){assert.ok(allowed.has(t.family));assert.ok(/^#[0-9a-f]{6}$/i.test(t.accent));assert.ok(['single','dual'].includes(t.layout));assert.equal(templateById(t.id).id,t.id)}});



test('Studio Pro mantiene dos diseños sobre los mismos hechos',()=>{const r=defaultResume(),facts=JSON.stringify({summary:r.summary,experience:r.experience,skills:r.skillGroups});ensureDesignVariants(r);switchDesignVariant(r,'ats');const atsId=r.settings.templateId;switchDesignVariant(r,'presentation');assert.equal(JSON.stringify({summary:r.summary,experience:r.experience,skills:r.skillGroups}),facts);assert.notEqual(atsId,'');assert.equal(r.settings.activeDesignVariant,'presentation')});

test('v48 variantes ATS/Presentación conservan estilos visuales independientes',()=>{
  const r=defaultResume();ensureDesignVariants(r);switchDesignVariant(r,'ats');Object.assign(r.settings,{headerStyle:'minimal',headingStyle:'caps',dividerStyle:'solid',contactStyle:'stacked'});switchDesignVariant(r,'presentation');
  Object.assign(r.settings,{headerStyle:'centered',headingStyle:'pill',dividerStyle:'none',contactStyle:'inline'});switchDesignVariant(r,'ats');
  assert.equal(r.settings.headerStyle,'minimal');assert.equal(r.settings.headingStyle,'caps');assert.equal(r.settings.dividerStyle,'solid');assert.equal(r.settings.contactStyle,'stacked');
  switchDesignVariant(r,'presentation');assert.equal(r.settings.headerStyle,'centered');assert.equal(r.settings.headingStyle,'pill');assert.equal(r.settings.dividerStyle,'none');assert.equal(r.settings.contactStyle,'inline');
  const normalized=normalizeResume(r);assert.equal(normalized.settings.designVariants.ats.headerStyle,'minimal');assert.equal(normalized.settings.designVariants.presentation.headingStyle,'pill');
});

test('Studio Pack crea par ATS y presentación',()=>{const r=defaultResume();const p=applyStudioPack(r,'software');assert.equal(p.id,'software');assert.equal(r.settings.designVariants.ats.layout,'single');assert.match(r.settings.designVariants.ats.templateId,/developer|ats|technical/);assert.ok(r.settings.designVariants.presentation.templateId);assert.equal(STUDIO_PACKS.length,16)});

test('inspector de composición detecta presión por experiencia',()=>{const r=defaultResume();r.experience[0].bullets=Array.from({length:20},(_,i)=>({id:`b${i}`,text:'Desarrollé una iniciativa compleja con resultados medibles y colaboración entre equipos durante el periodo.'}));const rep=compositionReport(r);assert.ok(rep.totalWords>100);assert.equal(rep.sections[0].id,'experience');assert.ok(['medium','high'].includes(rep.sections[0].pressure))});

test('comparador de versiones calcula delta ATS sin mutar',()=>{const old=defaultResume(),cur=structuredClone(old);cur.summary='';const before=JSON.stringify(old);const cmp=compareVersion(cur,old);assert.equal(typeof cmp.ats.delta,'number');assert.equal(JSON.stringify(old),before)});

test('autosnapshot respeta intervalo y límite',()=>{const r=defaultResume();assert.equal(maybeAutoSnapshot(r,1000000,1),true);assert.equal(maybeAutoSnapshot(r,1000000,600000),false);for(let i=1;i<20;i++)maybeAutoSnapshot(r,1000000+i*700000,1,12);assert.equal(r.autoVersions.length,12)});


test('Resume Modes no cambian hechos y ofrecen seis objetivos',()=>{const r=defaultResume(),facts=JSON.stringify({basics:r.basics,summary:r.summary,experience:r.experience,skills:r.skillGroups});const m=applyResumeMode(r,'executive');assert.equal(m.id,'executive');assert.equal(RESUME_MODES.length,6);assert.equal(JSON.stringify({basics:r.basics,summary:r.summary,experience:r.experience,skills:r.skillGroups}),facts);assert.equal(r.settings.resumeMode,'executive')});

test('Layout Composer asigna columnas y saltos',()=>{const r=defaultResume();r.settings.layout='dual';assert.equal(assignSectionColumn(r,'skills','main'),true);assert.equal(r.settings.sectionColumns.skills,'main');assert.equal(togglePageBreak(r,'education'),true);assert.ok(r.settings.pageBreakHints.includes('education'));const plan=buildPagePlan(r);assert.ok(plan.pages.length>=1);assert.ok(plan.pages.flatMap(x=>x.sections).some(x=>x.id==='skills'&&x.column==='main'))});

test('estrategia de dos páginas produce plan multipágina',()=>{const r=defaultResume();r.summary='perfil '.repeat(250);setPageStrategy(r,'two');const plan=buildPagePlan(r);assert.equal(r.settings.pageStrategy,'two');assert.ok(plan.pages.length>=2)});

test('auditoría visual detecta layout dual',()=>{const r=defaultResume();r.settings.layout='dual';const a=templateAudit(r);assert.equal(typeof a.score,'number');assert.ok(a.issues.some(x=>/dos columnas/i.test(x)))});

test('Import Review resume campos detectados y faltantes',()=>{const r=defaultResume();const ok=importReview(r,{importConfidence:91,extractionEngine:'docx'});assert.equal(ok.confidence,91);assert.equal(ok.counts.experience,1);assert.ok(ok.ready);r.basics.email='';const bad=importReview(r,{});assert.ok(bad.missing.includes('Email'))});



test('Local Premium ofrece colecciones de plantillas curadas',()=>{assert.equal(TEMPLATE_COLLECTIONS.length,5);assert.ok(TEMPLATE_COLLECTIONS.some(x=>x.id==='tech'));assert.ok(TEMPLATE_COLLECTIONS.every(x=>x.query.length>=4))});

test('Writing Coach detecta bullet débil sin inventar una reescritura',()=>{const r=defaultResume();r.experience[0].bullets=[{id:'weak',text:'Ayudé con cosas del proyecto.'}];const c=writingCoach(r);assert.equal(c.items.length,1);assert.ok(c.items[0].issues.length>=2);assert.match(c.items[0].skeleton,/Verbo de acción/);assert.doesNotMatch(c.items[0].skeleton,/28%|100 usuarios/)});

test('Export Integrity mantiene hechos y Vista ATS entre variantes',()=>{const r=defaultResume();const before=factFingerprint(r);const a=exportIntegrityAudit(r);assert.equal(a.sameFacts,true);assert.equal(a.sameText,true);assert.equal(factFingerprint(r),before);assert.ok(a.score>=85)});

test('Snapshot diff detecta cambios de contenido y diseño',()=>{const old=defaultResume(),cur=structuredClone(old);cur.skillGroups[0].skills.push('Python');cur.experience[0].bullets.push({id:'extra',text:'Implementé una mejora verificable del producto.'});applyTemplateToResume(cur,'modern-navy');const d=snapshotDiff(cur,old);assert.ok(d.content.skillsAdded.includes('Python'));assert.equal(d.content.bulletDelta,1);assert.equal(d.design.templateChanged,true)});

test('Page Quality produce balance y presión por página',()=>{const r=defaultResume();r.summary='perfil '.repeat(450);setPageStrategy(r,'two');const q=pageQuality(r);assert.ok(q.pages.length>=2);assert.equal(typeof q.balance,'number');assert.equal(typeof q.recommendation,'string')});


test('Template Forge guarda una receta sin cambiar hechos',()=>{const r=defaultResume(),before=factFingerprint(r);Object.assign(r.settings,{accent:'#123456',headerStyle:'band',showIcons:false,photoZoom:1.8,photoX:12,photoY:-7});const recipe=recipeFromResume(r,'Mi diseño');assert.equal(recipe.name,'Mi diseño');assert.equal(recipe.overrides.accent,'#123456');assert.equal(recipe.overrides.showIcons,false);assert.equal(recipe.overrides.photoZoom,1.8);const target=defaultResume(),facts=factFingerprint(target);applyThemeRecipe(target,recipe);assert.equal(factFingerprint(target),facts);assert.equal(target.settings.forgeRecipeName,'Mi diseño');assert.equal(target.settings.headerStyle,'band');assert.equal(target.settings.showIcons,false);assert.equal(target.settings.photoZoom,1.8);assert.equal(target.settings.photoX,12);assert.equal(target.settings.photoY,-7);assert.equal(before,factFingerprint(r))});

test('v48 plantilla normal limpia todos los metadatos de Template Forge',()=>{
  const r=defaultResume();applyThemeRecipe(r,recipeFromResume(r,'Temporal'));assert.ok(r.settings.forgeRecipeId);assert.equal(r.settings.forgeRecipeVersion,1);applyTemplateToResume(r,'modern-navy');assert.equal(r.settings.forgeRecipeId,undefined);assert.equal(r.settings.forgeRecipeName,undefined);assert.equal(r.settings.forgeRecipeVersion,undefined);
});

test('Template Forge normaliza tokens inválidos y resume riesgo',()=>{const recipe=createThemeRecipe('ats-ink','Prueba',{layout:'xx',accent:'red',fontScale:9});const summary=recipeSummary(recipe);assert.equal(recipe.overrides.layout,'single');assert.match(recipe.overrides.accent,/^#/);assert.ok(recipe.overrides.fontScale<=1.18);assert.equal(summary.risk,'low')});

test('v48 Template Forge reporta baseId inexistente en validación',()=>{
  const result=validateThemeRecipe({id:'bad_recipe',name:'Rota',baseId:'preset-inexistente',overrides:{}});assert.equal(result.ok,false);assert.ok(result.issues.some(x=>/base inválido/i.test(x)));assert.equal(result.recipe.baseId,PERSONAL_TEMPLATES[0].id);
});

test('Template Forge deduplica y limita la biblioteca local',()=>{const x=createThemeRecipe('modern-navy','A');const items=Array.from({length:FORGE_LIMIT+15},(_,i)=>({...x,id:i<2?'dup':`id_${i}`,name:`T${i}`}));const clean=sanitizeRecipeLibrary(items);assert.ok(clean.length<=FORGE_LIMIT);assert.equal(clean.filter(r=>r.id==='dup').length,1)});

test('Local AI context usa texto exacto y no modifica el CV',()=>{const r=defaultResume(),before=factFingerprint(r),b=r.experience[0].bullets[0];const c=localAiContext(r,'bullet',{bulletId:b.id});assert.equal(c.before,b.text);assert.equal(c.bulletId,b.id);assert.equal(factFingerprint(r),before);assert.equal(LOCAL_AI_TASKS.length,3);assert.match(localAiPrivacyStatement(),/127\.0\.0\.1/)});

test('Local AI bloquea una cifra inventada',()=>{const r=defaultResume();const p={kind:'summary',before:r.summary,after:r.summary+' Aumenté ingresos 99%.',reason:'x',needsUserFact:false};const a=auditLocalAiSuggestion(r,p);assert.equal(a.safe,false);assert.ok(a.issues.some(x=>/cifra nueva|cifra no presente|fuera de contexto/i.test(x)))});

test('Local AI exige revisión humana para reescrituras semánticas aunque no detecte contradicción',()=>{const r=defaultResume(),before=r.summary;const after=before.replace('creando','diseñando');const p={kind:'summary',before,after,reason:'más directo',needsUserFact:false};const a=auditLocalAiSuggestion(r,p);assert.equal(a.safe,true);assert.equal(a.status,'review');assert.equal(a.autoApply,false);assert.throws(()=>applyLocalAiSuggestion(r,p),/revisión humana/i);assert.equal(applyLocalAiSuggestion(r,p,{reviewed:true}),true);assert.equal(r.summary,after)});

test('Local AI rechaza propuestas obsoletas',()=>{const r=defaultResume();const old=r.summary;r.summary+=' Cambio';const p={kind:'summary',before:old,after:old+' mejorado',reason:'x',needsUserFact:false};assert.equal(auditLocalAiSuggestion(r,p).safe,false);assert.throws(()=>applyLocalAiSuggestion(r,p))});



test('Workbench se inicializa localmente con política segura',()=>{const r=defaultResume();const wb=ensureWorkbench(r);assert.equal(wb.version,1);assert.equal(wb.releaseProfiles.length,0);assert.equal(wb.gatePolicy.minAts,75);assert.equal(workbenchSummary(r).profiles,0)});

test('Release Profile captura composición y vacante sin duplicar hechos',()=>{const r=defaultResume(),facts=factFingerprint(r);r.target=parseJobDescription('Buscamos Product Designer con Figma, UX Research, accesibilidad y cinco años de experiencia en producto digital y colaboración con ingeniería.',{role:'Product Designer'});r.settings.layout='dual';const p=captureReleaseProfile(r,'Producto','application');assert.equal(p.target.role,'Product Designer');assert.equal(p.settings.layout,'dual');assert.equal(factFingerprint(r),facts);assert.equal(ensureWorkbench(r).activeProfileId,p.id)});

test('Release Profile se aplica sin alterar experiencia ni skills',()=>{const r=defaultResume();r.settings.layout='dual';const p=captureReleaseProfile(r,'Dual','portfolio');r.settings.layout='single';r.target=null;const facts=factFingerprint(r);applyReleaseProfile(r,p);assert.equal(r.settings.layout,'dual');assert.equal(factFingerprint(r),facts);deleteReleaseProfile(r,p.id);assert.equal(ensureWorkbench(r).releaseProfiles.length,0)});

test('Test Lab congela vacante y no cambia target actual al ejecutar',()=>{const r=defaultResume();r.target=parseJobDescription('Senior Product Designer requerido: Figma, UX Research, Design Systems, accesibilidad y experiencia colaborando con equipos de producto e ingeniería.',{role:'Senior Product Designer'});const tc=createTestCase(r,{name:'Senior PD',minAts:60,minJobMatch:20,maxPages:3});const original=JSON.stringify(r.target);r.target=parseJobDescription('Otro puesto requiere Python, SQL, AWS, Docker y experiencia backend de cinco años.',{role:'Backend'});const active=JSON.stringify(r.target);const result=runTestCase(r,tc);assert.equal(result.name,'Senior PD');assert.equal(JSON.stringify(r.target),active);assert.notEqual(JSON.stringify(r.target),original)});

test('Test Suite reporta pass y fail por umbrales',()=>{const r=defaultResume();r.target=parseJobDescription('Product Designer requerido: Figma, UX Research, Design Systems, accesibilidad, prototipado y experiencia de producto.',{role:'Product Designer'});const easy=createTestCase(r,{name:'Easy',minAts:0,minJobMatch:0,maxPages:5,expectedRisk:'any'});const hard={...easy,id:'hard',name:'Hard',thresholds:{...easy.thresholds,minAts:100,minJobMatch:100,maxPages:1,expectedRisk:'not-high'}};const suite=runTestSuite(r,[easy,hard]);assert.equal(suite.total,2);assert.ok(suite.passed>=1);assert.ok(suite.failed>=1);deleteTestCase(r,easy.id)});

test('Release Gate detecta integridad y produce etapas explicables',()=>{const r=defaultResume();const gate=runReleaseGate(r);assert.equal(gate.stages.length,8);assert.ok(['READY','REVIEW','BLOCKED'].includes(gate.status));assert.equal(typeof gate.score,'number');assert.equal(gate.metrics.integrity,100);assert.equal(typeof gate.metrics.preflight,'number')});

test('Release Gate bloquea un CV deliberadamente incompleto',()=>{const r=defaultResume();r.basics.fullName='';r.basics.email='';r.summary='';r.experience=[];r.skillGroups=[];const gate=runReleaseGate(r,{minAts:90,minWriting:80});assert.equal(gate.status,'BLOCKED');assert.ok(gate.blocks.length>=1)});

test('v48 Release Gate nunca declara READY si Preflight tiene un bloqueo',()=>{const r=defaultResume();r.basics.headline='Desarrollador Full Stack | Angular';r.summary='Product Designer con seis años de experiencia creando productos digitales centrados en personas y negocio, liderando research, prototipado y diseño de interfaces complejas para equipos multidisciplinares.';r.experience[0].bullets=[{id:'g1',text:'Lideré iniciativas de producto aumentando activación 28% con equipos multidisciplinares.'},{id:'g2',text:'Diseñé flujos y prototipos reduciendo errores 20% para usuarios internos.'},{id:'g3',text:'Coordiné research mejorando satisfacción 15% con evidencia verificable.'}];const gate=runReleaseGate(r,{minAts:0,minWriting:0,maxPages:5,minJobMatch:0}),preflight=gate.stages.find(x=>x.id==='preflight');assert.equal(gate.preflight.blocks,1);assert.equal(preflight.status,'block');assert.equal(gate.status,'BLOCKED');assert.equal(gate.ready,false)});

test('Release History conserva métricas y permite comparar',()=>{const r=defaultResume();const a=recordRelease(r,'A');r.summary='';const b=recordRelease(r,'B');const d=compareReleaseRecords(b,a);assert.equal(ensureWorkbench(r).releaseHistory.length,2);assert.equal(typeof d.score,'number');assert.equal(d.sameFacts,false)});
test('Release reproducible distingue hechos, diseño y vacante con hashes estables',()=>{const r=defaultResume(),a=recordRelease(r,'Base');assert.match(a.factHash,/^[0-9a-f]{8}$/);assert.match(a.designHash,/^[0-9a-f]{8}$/);assert.match(a.targetHash,/^[0-9a-f]{8}$/);assert.match(a.releaseHash,/^[0-9a-f]{8}$/);const same=recordRelease(r,'Mismo');assert.equal(a.releaseHash,same.releaseHash);r.settings.accent='#123456';const visual=recordRelease(r,'Visual');assert.equal(visual.factHash,a.factHash);assert.notEqual(visual.designHash,a.designHash);assert.notEqual(visual.releaseHash,a.releaseHash)});

test('v48 normalización conserva hashes reproducibles del historial de releases',()=>{
  const r=defaultResume(),a=recordRelease(r,'Base');r.settings.accent='#123456';const b=recordRelease(r,'Visual'),normalized=normalizeResume(r),[nb,na]=normalized.workbench.releaseHistory;
  assert.equal(na.designHash,a.designHash);assert.equal(na.targetHash,a.targetHash);assert.equal(na.releaseHash,a.releaseHash);assert.equal(nb.designHash,b.designHash);assert.equal(nb.releaseHash,b.releaseHash);
  const diff=compareReleaseRecords(nb,na);assert.equal(diff.sameFacts,true);assert.equal(diff.sameDesign,false);assert.equal(diff.sameRelease,false);
});

test('Workbench respeta límites de perfiles, tests y releases',()=>{const r=defaultResume(),wb=ensureWorkbench(r);for(let i=0;i<PROFILE_LIMIT+5;i++)captureReleaseProfile(r,`P${i}`);assert.equal(wb.releaseProfiles.length,PROFILE_LIMIT);r.target=parseJobDescription('Product Designer requerido: Figma, UX Research, Design Systems y experiencia colaborando con equipos multidisciplinares.',{role:'PD'});for(let i=0;i<TEST_CASE_LIMIT+5;i++)createTestCase(r,{name:`T${i}`});assert.equal(wb.testCases.length,TEST_CASE_LIMIT);for(let i=0;i<RELEASE_HISTORY_LIMIT+5;i++)recordRelease(r,`R${i}`);assert.equal(wb.releaseHistory.length,RELEASE_HISTORY_LIMIT)});


test('v22 snapshot no anida historiales ni duplica texto fuente importado',()=>{
  const r=defaultResume();r.sourceAudit={fileName:'cv.txt',sourceText:'x'.repeat(60000)};r.autoVersions=[{id:'auto_1',date:1,resume:defaultResume()}];r.versions=[{id:'ver_1',date:1,resume:defaultResume()}];
  const snap=snapshotResume(r);assert.equal(snap.versions.length,0);assert.equal(snap.autoVersions.length,0);assert.equal('sourceText' in snap.sourceAudit,false);assert.ok(JSON.stringify(snap).length<20000);
});

test('v22 historial local queda acotado y sin snapshots recursivos',()=>{
  const r=defaultResume();r.versions=Array.from({length:40},(_,i)=>({id:`ver_${i}`,date:i+1,resume:{...defaultResume(),versions:[{id:'nested',date:1,resume:{}}]}}));r.autoVersions=Array.from({length:20},(_,i)=>({id:`auto_${i}`,date:i+1,resume:defaultResume()}));
  compactResumeHistory(r);assert.equal(r.versions.length,MAX_MANUAL_VERSIONS);assert.equal(r.autoVersions.length,MAX_AUTO_VERSIONS);assert.equal(r.versions.at(-1).resume.versions.length,0);assert.equal(r.versions.at(-1).resume.autoVersions.length,0);
});

test('v28 persistencia recupera QuotaExceededError sin compactar el estado vivo',()=>{
  const r=defaultResume();r.versions=Array.from({length:20},(_,i)=>({id:`ver_${i}`,date:i+1,resume:defaultResume()}));const state={documents:[{id:r.id,resume:r}]};let calls=0,saved='';const storage={setItem(k,v){calls++;if(calls===1){const e=new Error('full');e.name='QuotaExceededError';throw e}saved=v}};
  const before=structuredClone(state),result=persistState(storage,'test',state);assert.equal(result.ok,true);assert.equal(result.quotaRecovered,true);assert.deepEqual(state,before);assert.equal(r.versions.length,20);assert.ok(JSON.parse(saved).documents[0].resume.versions.length<=6);
});

test('v28 persistencia fallida por cuota no destruye historial en memoria',()=>{
  const r=defaultResume();r.versions=Array.from({length:24},(_,i)=>({id:`ver_${i}`,date:i+1,resume:defaultResume()}));r.autoVersions=Array.from({length:12},(_,i)=>({id:`auto_${i}`,date:i+1,resume:defaultResume()}));const state={documents:[{id:r.id,resume:r}]},before=structuredClone(state);
  const storage={setItem(){const e=new Error('full');e.name='QuotaExceededError';throw e}};const result=persistState(storage,'test',state);assert.equal(result.ok,false);assert.equal(result.reason,'quota');assert.deepEqual(state,before);assert.equal(r.versions.length,24);assert.equal(r.autoVersions.length,12);
});

test('v22 lectura local ignora JSON corrupto y usa almacenamiento legado',()=>{
  const storage={getItem(k){return k==='new'?'{"wrong":true}':k==='old'?'{"ok":true}':null}};assert.deepEqual(readJsonStorage(storage,['new','old'],null,v=>v?.ok===true),{ok:true});
});

test('v22 normalización neutraliza IDs manipulados y limita sourceAudit',()=>{
  const raw=defaultResume();raw.id='"><img src=x>';raw.experience[0].id='" onclick="x';raw.experience[0].bullets[0].id='<svg>';raw.settings.sectionOrder=['summary','bad" onclick=x','custom:ghost'];raw.sourceAudit={fileName:'x',sourceText:'z'.repeat(90000)};
  const r=normalizeResume(raw);assert.match(r.id,/^[A-Za-z0-9_-]+$/);assert.match(r.experience[0].id,/^[A-Za-z0-9_-]+$/);assert.match(r.experience[0].bullets[0].id,/^[A-Za-z0-9_-]+$/);assert.deepEqual(r.settings.sectionOrder,['summary']);assert.equal(r.sourceAudit.sourceText.length,4000);
});

test('v22 migración legacy realmente se ejecuta sobre esquema antiguo',()=>{
  const r=migrateLegacy({name:'Alan Demo',role:'Developer',email:'alan@example.com',skills:'JavaScript, Python',achievements:'Construí una herramienta local'});assert.equal(r.schemaVersion,9);assert.equal(r.basics.fullName,'Alan Demo');assert.equal(r.basics.email,'alan@example.com');assert.ok(r.skillGroups[0].skills.includes('Python'));
});

test('v22 auditor factual bloquea tecnologías y capacidades inventadas',()=>{
  const r=defaultResume(),after='Product Designer experta en Kubernetes, seguridad ofensiva y dirección de equipos internacionales.';const unsupported=unsupportedClaimTerms(r,after);assert.ok(unsupported.novel.length>=3);const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'demo',needsUserFact:false});assert.equal(a.safe,false);assert.ok(a.issues.some(x=>/tecnología nueva|no respaldado/i.test(x)));
});

test('v22 auditor factual permite paráfrasis conservadora',()=>{
  const r=defaultResume(),after='Product Designer con 6 años creando productos digitales accesibles y convirtiendo problemas complejos en experiencias claras que mejoran métricas de negocio y adopción.';const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '));
});

test('v22 Release Gate excluye Job Match del promedio cuando no hay vacante',()=>{
  const r=defaultResume();r.target=null;const gate=runReleaseGate(r),weights={content:.10,ats:.18,integrity:.18,preflight:.14,writing:.10,layout:.10,visual:.10},scored=gate.stages.filter(x=>x.id!=='match'),expected=Math.round(scored.reduce((n,x)=>n+x.score*weights[x.id],0)/Object.values(weights).reduce((a,b)=>a+b,0));const matchStage=gate.stages.find(x=>x.id==='match');assert.equal(matchStage.status,'info');assert.equal(matchStage.score,null);assert.equal(gate.score,expected);
});


test('v28 Local AI preserva negaciones y polaridad factual',()=>{
  for(const [before,after] of [
    ['No lideré equipos internacionales.','Lideré equipos internacionales.'],
    ['Sin experiencia gestionando equipos globales.','Experiencia gestionando equipos globales.'],
    ['Nunca administré infraestructura cloud.','Administré infraestructura cloud.'],
    ['I did not lead international teams.','I led international teams.'],
    ["I didn't lead international teams.",'I led international teams.'],
    ['Ni lideré equipos internacionales ni administré cloud.','Lideré equipos internacionales.']
  ]){
    const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa',needsUserFact:false});
    assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.issues.some(x=>/polaridad|negación/i.test(x)),a.issues.join(' | '));
  }
});

test('v28 Local AI permite reformular una negación sin invertir su sentido',()=>{
  const before='No lideré equipos internacionales.',after='Nunca lideré equipos internacionales.',r=defaultResume();r.summary=before;
  const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'claridad',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '));
});

test('v28 Local AI mantiene cada métrica y fecha ligada a su claim',()=>{
  for(const [before,after] of [
    ['Aumenté ventas 20% y reduje costos 10%.','Aumenté ventas 10% y reduje costos 20%.'],
    ['Atendí 50 clientes y cerré 12 contratos.','Atendí 12 clientes y cerré 50 contratos.'],
    ['Gestioné 3 proyectos en México y 8 proyectos en España.','Gestioné 8 proyectos en México y 3 proyectos en España.'],
    ['Trabajé de 2018 a 2022.','Trabajé de 2022 a 2018.'],
    ['Atendí diez clientes y cerré doce contratos.','Atendí doce clientes y cerré diez contratos.'],
    ['Aumenté ventas +20%.','Aumenté ventas -20%.']
  ]){
    const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa',needsUserFact:false});
    assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.issues.some(x=>/reasigna cifras|métricas|fechas/i.test(x)),a.issues.join(' | '));
  }
});

test('v28 Local AI permite reordenar claims métricos intactos',()=>{
  for(const [before,after] of [
    ['Aumenté ventas 20%, reduje costos 10%.','Reduje costos 10%, aumenté ventas 20%.'],
    ['Increased sales 20% and reduced costs 10%.','Reduced costs 10% and increased sales 20%.']
  ]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'orden',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

for(const tpl of PERSONAL_TEMPLATES){
  test(`render template ${tpl.id}`,()=>{const r=defaultResume();applyTemplateToResume(r,tpl.id);const html=renderResumeHtml(r);assert.match(html,/resume-header/);assert.match(html,/Ana García López/);assert.equal(r.settings.templateId,tpl.id)});
}

test('v22 normalización deduplica IDs internos válidos repetidos',()=>{
  const raw=defaultResume();
  raw.experience=[
    {id:'same',company:'A',title:'Uno',bullets:[{id:'bullet_same',text:'A'},{id:'bullet_same',text:'B'}]},
    {id:'same',company:'B',title:'Dos',bullets:[]}
  ];
  raw.education=[{id:'same',institution:'X',degree:'Y'}];
  const r=normalizeResume(raw),ids=[r.id,...r.experience.map(x=>x.id),...r.experience.flatMap(x=>x.bullets.map(b=>b.id)),...r.education.map(x=>x.id)];
  assert.equal(ids.length,new Set(ids).size);
  assert.notEqual(r.experience[0].id,r.experience[1].id);
  assert.notEqual(r.experience[0].bullets[0].id,r.experience[0].bullets[1].id);
});

test('v22 Local AI bloquea una sola tecnología o skill nueva en una afirmación explícita',()=>{
  const r=defaultResume();
  for(const skill of ['kubernetes','terraform']){
    const after=`Experiencia adicional con ${skill}.`;
    const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'demo',needsUserFact:false});
    assert.equal(a.safe,false,`${skill} no debe pasar`);
    assert.ok(a.issues.some(x=>/no demostrados|no respaldado|tecnología nueva/i.test(x)),a.issues.join(' | '));
  }
});

test('v22 Local AI no confunde una palabra capitalizada al inicio de oración con una entidad',()=>{
  const r=defaultResume();
  const after='Convierte problemas complejos en experiencias claras que mejoran métricas de negocio y adopción.';
  const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'más directo',needsUserFact:false});
  assert.equal(a.safe,true,a.issues.join(' | '));
  assert.ok(!a.issues.some(x=>/convierte/i.test(x)));
});

test('v22 Local AI no reutiliza una cifra de otro campo como si perteneciera al texto editado',()=>{
  const r=defaultResume();
  assert.ok(JSON.stringify(r).includes('28%'));
  const p={kind:'summary',before:r.summary,after:r.summary+' Mejoró ingresos 28%.',reason:'demo',needsUserFact:false};
  const a=auditLocalAiSuggestion(r,p);
  assert.equal(a.safe,false);
  assert.ok(a.issues.some(x=>/cifra.*texto original|fuera de contexto/i.test(x)),a.issues.join(' | '));
});

test('v22 Local AI bloquea skills nuevas incluso en formulaciones cortas',()=>{
  const r=defaultResume();
  for(const after of ['Kubernetes para productos digitales.','Uso kubernetes para producto.','Product Designer con kubernetes.']){
    const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'demo',needsUserFact:false});
    assert.equal(a.safe,false,after);
  }
});

test('v22 normalización limita metadata auxiliar de backups para proteger almacenamiento',()=>{
  const raw=defaultResume();
  raw.sourceAudit={evidence:[{field:'x'.repeat(1000),detected:true,weight:999,extra:'z'.repeat(100000)}]};
  raw.evidenceVault=Array.from({length:510},(_,i)=>({id:`v_${i}`,title:'t'.repeat(500),text:'x'.repeat(20000),tags:['z'.repeat(300)]}));
  raw.reviewThreads=Array.from({length:510},(_,i)=>({id:`r_${i}`,comment:'c'.repeat(20000)}));
  const r=normalizeResume(raw);
  assert.equal(r.sourceAudit.evidence[0].field.length,100);assert.equal(r.sourceAudit.evidence[0].weight,100);assert.equal('extra' in r.sourceAudit.evidence[0],false);
  assert.equal(r.evidenceVault.length,500);assert.equal(r.evidenceVault[0].text.length,12000);assert.equal(r.reviewThreads.length,500);assert.equal(r.reviewThreads[0].comment.length,12000);
});

test('v22 normalización repara settings y designVariants corruptos',()=>{
  const raw=defaultResume();raw.settings={...raw.settings,designVariants:'roto',layout:'triple',fontScale:'NaN',accent:'url(javascript:x)',activeDesignVariant:'otro',pageStrategy:'infinita'};
  const r=normalizeResume(raw);
  assert.deepEqual(r.settings.designVariants,{});assert.equal(r.settings.layout,'single');assert.equal(r.settings.fontScale,1);assert.equal(r.settings.accent,'#111827');assert.equal(r.settings.activeDesignVariant,'presentation');assert.equal(r.settings.pageStrategy,'auto');
});


test('v23 Local AI bloquea tecnología corta o capitalizada inventada',()=>{
  const r=defaultResume();
  for(const after of ['Product Designer con 6 años de experiencia. Unity.','Product Designer con 6 años creando productos digitales. Certificación AWS.','Product Designer con experiencia en SQL.']){
    const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'qa',needsUserFact:false});
    assert.equal(a.safe,false,after);assert.ok(a.issues.some(x=>/tecnología|sigla|credencial|no demostr/i.test(x)),a.issues.join(' | '));
  }
});

test('v23 Local AI bloquea antigüedad inventada escrita con palabras y permite seis años',()=>{
  const r=defaultResume();
  const bad=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after:'Product Designer con más de una década de experiencia creando productos digitales.',reason:'qa',needsUserFact:false});
  assert.equal(bad.safe,false);assert.ok(bad.issues.some(x=>/duración|antigüedad/i.test(x)));
  const good=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after:'Product Designer con seis años creando productos digitales accesibles y centrados en las personas.',reason:'qa',needsUserFact:false});
  assert.equal(good.safe,true,good.issues.join(' | '));
});

test('v23 persistJsonBundle es atómico y restaura claves previas al fallar',()=>{
  const data={a:'old-a',b:'old-b'};let writes=0;
  const storage={getItem:k=>data[k]??null,setItem(k,v){writes++;if(k==='b'&&v!==data.b)throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});data[k]=v},removeItem:k=>delete data[k]};
  const result=persistJsonBundle(storage,[{key:'a',value:{new:1}},{key:'b',value:{new:2}}]);
  assert.equal(result.ok,false);assert.equal(data.a,'old-a');assert.equal(data.b,'old-b');assert.ok(writes>=2);
});

test('v23 captureStorage y restoreStorage preservan ausencia y valores exactos',()=>{
  const data={a:'1'};const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v,removeItem:k=>delete data[k]};
  const snap=captureStorage(storage,['a','b']);storage.setItem('a','2');storage.setItem('b','3');assert.equal(restoreStorage(storage,snap),true);assert.equal(data.a,'1');assert.equal('b' in data,false);
});


test('v23 Local AI no convierte una skill existente en certificación inexistente',()=>{
  const r=defaultResume();r.skillGroups[0].skills.push('AWS');
  const p={kind:'summary',before:r.summary,after:r.summary+' Certificación AWS.',reason:'qa',needsUserFact:false};
  const a=auditLocalAiSuggestion(r,p);assert.equal(a.safe,false);assert.ok(a.issues.some(x=>/certificación no demostrada/i.test(x)),a.issues.join(' | '));
  r.certifications.push({id:'cert_aws',name:'AWS Certified Cloud Practitioner',issuer:'AWS',date:'2025'});
  const b=auditLocalAiSuggestion(r,p);assert.equal(b.safe,true,b.issues.join(' | '));
});


test('v28 Template Forge regenera IDs inseguros antes de usarlos en DOM',()=>{
  const bad='forge_x" autofocus data-qa-injected="yes';const r=normalizeThemeRecipe({id:bad,name:'QA',baseId:'ats-ink',overrides:{}});
  assert.notEqual(r.id,bad);assert.match(r.id,/^[A-Za-z0-9_-]{1,80}$/);
  const lib=sanitizeRecipeLibrary([{id:bad,name:'QA',baseId:'ats-ink',overrides:{}}]);assert.match(lib[0].id,/^[A-Za-z0-9_-]{1,80}$/);assert.doesNotMatch(lib[0].id,/['"\s=]/);
});

test('v28 Local AI exige evidencia positiva para afirmaciones factuales nuevas',()=>{
  const r=defaultResume();
  for(const after of [
    r.summary+' Photoshop.',
    'Product Designer con 6 años de experiencia creando productos digitales. Lideré equipos globales.',
    'Product Designer con 6 años de experiencia creando productos digitales. Dirigí equipos internacionales.',
    'Product Designer con 6 años de experiencia creando productos digitales. Gestioné presupuestos millonarios.',
    'Product Designer con 6 años de experiencia creando productos digitales. Responsable de seguridad ofensiva.'
  ]){
    const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'red-team',needsUserFact:false});
    assert.equal(a.safe,false,after);assert.ok(a.issues.some(x=>/evidencia positiva|no demostrada|tecnología/i.test(x)),a.issues.join(' | '));
  }
});


test('v28 Local AI bloquea recombinación de hechos dispersos fuera del texto editado',()=>{
  const r=defaultResume();r.summary='Product Designer con seis años creando productos digitales.';r.experience=[
    {id:'e1',company:'A',title:'Designer',bullets:[{id:'b1',text:'Lideré la investigación de usuarios.'}]},
    {id:'e2',company:'B',title:'Designer',bullets:[{id:'b2',text:'Colaboré con equipos de producto.'}]},
    {id:'e3',company:'C',title:'Designer',bullets:[{id:'b3',text:'Diseñé experiencias para mercados internacionales.'}]}
  ];
  const after='Product Designer con seis años creando productos digitales. Lideré equipos internacionales.';const a=auditLocalAiSuggestion(r,{kind:'summary',before:r.summary,after,reason:'qa-relacional',needsUserFact:false});
  assert.equal(a.safe,false,a.issues.join(' | '));assert.ok(a.issues.some(x=>/texto editado|misma unidad factual/i.test(x)),a.issues.join(' | '));
});

test('v48 Factual Check usa evidencia del CV completo sin bloquear una afirmación ya demostrada',()=>{
  const r=defaultResume();r.experience=[{id:'e1',company:'Empresa',title:'Developer',bullets:[
    {id:'b1',text:'Configuré Docker para despliegues.'},
    {id:'b2',text:'Administré proyectos con Docker.'}
  ]}];
  const before=r.experience[0].bullets[0].text,after='Configuré Docker para despliegues. Administré proyectos con Docker.';
  const a=auditLocalAiSuggestion(r,{kind:'bullet',bulletId:'b1',before,after,reason:'qa-contexto-cv',needsUserFact:false});
  assert.equal(a.safe,true,a.issues.join(' | '));assert.equal(a.status,'review');assert.ok(a.contextSupportedNovel.length,a.reviewReasons.join(' | '));assert.ok(a.reviewReasons.some(x=>/otras secciones del CV/i.test(x)),a.reviewReasons.join(' | '));
});

test('v48 Factual Check sigue bloqueando relaciones nuevas aunque sus palabras existan dispersas en el CV',()=>{
  const r=defaultResume();r.experience=[{id:'e1',company:'Empresa',title:'Developer',bullets:[
    {id:'b1',text:'Optimicé procedimientos almacenados en SQL Server.'},
    {id:'b2',text:'Diseñé aplicaciones empresariales.'}
  ]}];
  const before=r.experience[0].bullets[0].text,after='Diseñé procedimientos almacenados en SQL Server.';
  const a=auditLocalAiSuggestion(r,{kind:'bullet',bulletId:'b1',before,after,reason:'qa-relacion-nueva',needsUserFact:false});
  assert.equal(a.safe,false,a.issues.join(' | '));assert.ok(a.relationalUnsupported.length||a.issues.some(x=>/misma unidad factual/i.test(x)),a.issues.join(' | '));
});

test('v28 Local AI preserva dirección sujeto-acción-objeto y origen-destino',()=>{
  const cases=[
    ['Ana supervisó a Carlos.','Carlos supervisó a Ana.'],
    ['Diseñé para México con un equipo de España.','Diseñé para España con un equipo de México.'],
    ['Migré datos de Oracle a PostgreSQL.','Migré datos de PostgreSQL a Oracle.'],
    ['El proyecto A reemplazó al proyecto B.','El proyecto B reemplazó al proyecto A.']
  ];
  for(const [before,after] of cases){
    const r=defaultResume();r.summary=before;
    const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-dirección',needsUserFact:false});
    assert.equal(a.safe,false,`${before} -> ${after}`);
    assert.ok(a.issues.some(x=>/misma unidad factual|afirmación sin respaldo/i.test(x)),a.issues.join(' | '));
  }
});

test('v28 Local AI permite conservar relaciones direccionales al simplificar texto',()=>{
  const cases=[
    ['Ana supervisó directamente a Carlos durante el proyecto.','Ana supervisó a Carlos.'],
    ['Migré datos de Oracle a PostgreSQL durante la modernización.','Migré datos de Oracle a PostgreSQL.']
  ];
  for(const [before,after] of cases){
    const r=defaultResume();r.summary=before;
    const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});
    assert.equal(a.safe,true,a.issues.join(' | '));
  }
});


test('v28 Local AI conserva marcadores relacionales de origen, destino y rol',()=>{
  const cases=[
    ['Migré datos de Oracle a PostgreSQL.','Migré datos a Oracle desde PostgreSQL.'],
    ['Transferí datos de México a España.','Transferí datos a México desde España.'],
    ['Gestioné proyectos para México desde España.','Gestioné proyectos desde México para España.'],
    ['Reporté a Ana sobre Carlos.','Reporté sobre Ana a Carlos.'],
    ['Entregué el informe a Ana de parte de Carlos.','Entregué el informe de Ana a Carlos.']
  ];
  for(const [before,after] of cases){
    const r=defaultResume();r.summary=before;
    const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-preposiciones',needsUserFact:false});
    assert.equal(a.safe,false,`${before} -> ${after}`);
    assert.ok(a.issues.some(x=>/misma unidad factual|afirmación sin respaldo/i.test(x)),a.issues.join(' | '));
  }
});

test('v28 Local AI liga métricas a todos sus anchors discriminativos',()=>{
  const cases=[
    ['Aumenté ventas en México 20% y aumenté ventas en España 10%.','Aumenté ventas en España 20% y aumenté ventas en México 10%.'],
    ['Reduje costos de Oracle 20% y reduje costos de PostgreSQL 10%.','Reduje costos de PostgreSQL 20% y reduje costos de Oracle 10%.']
  ];
  for(const [before,after] of cases){
    const r=defaultResume();r.summary=before;
    const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-metric-anchors',needsUserFact:false});
    assert.equal(a.safe,false,`${before} -> ${after}`);
    assert.ok(a.issues.some(x=>/reasigna cifras|métricas|fechas/i.test(x)),a.issues.join(' | '));
  }
});

test('v28 Local AI permite simplificar un claim métrico sin cambiar anchors',()=>{
  const before='Aumenté las ventas en México 20% durante el primer trimestre.';
  const after='Aumenté ventas en México 20%.';
  const r=defaultResume();r.summary=before;
  const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});
  assert.equal(a.safe,true,a.issues.join(' | '));
});


test('v29 Local AI preserva restricciones temporales y de alcance',()=>{
  const blocked=[
    ['Sólo gestioné proyectos en México.','Gestioné proyectos en México.'],
    ['Únicamente apoyé al equipo de seguridad.','Apoyé al equipo de seguridad.'],
    ['Trabajé en PostgreSQL desde 2020.','Trabajé en PostgreSQL hasta 2020.'],
    ['I only managed projects in Mexico.','I managed projects in Mexico.'],
    ['I worked with PostgreSQL since 2020.','I worked with PostgreSQL until 2020.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v29',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.issues.some(x=>/restricción temporal|alcance|cuantitativa/i.test(x)),a.issues.join(' | '))}
  for(const [before,after] of [['Sólo gestioné proyectos en México durante el año.','Sólo gestioné proyectos en México.'],['Únicamente gestioné proyectos en México.','Sólo gestioné proyectos en México.'],['I only managed projects in Mexico.','I exclusively managed projects in Mexico.']]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

test('v29 normalizeResume sanea target y requirements corruptos antes de ATS y Job Match',()=>{
  const raw={...defaultResume(),target:{role:5,company:{x:1},requirements:[null,5,{concept:null},{id:'bad id',concept:'Figma',importance:'invalid',type:'weird',confidence:9,line:-2},'SQL'],skills:[null,'Figma','Figma',5],parsedAt:'bad'}};
  const r=normalizeResume(raw);assert.equal(r.target.role,'5');assert.equal(r.target.requirements.length,2);assert.ok(r.target.requirements.every(x=>x&&typeof x.concept==='string'));assert.ok(r.target.requirements.every(x=>['required','preferred','context'].includes(x.importance)));assert.ok(r.target.requirements.every(x=>['skill','experience','education','term'].includes(x.type)));assert.doesNotThrow(()=>matchResumeToJob(r,r.target));assert.doesNotThrow(()=>analyzeResume(r,r.target));
});

test('v30 Local AI preserva modificadores de responsabilidad y alcance profesional',()=>{
  const blocked=[
    ['Fui responsable adjunto de seguridad.','Fui responsable de seguridad.'],
    ['Fui responsable interino de seguridad.','Fui responsable de seguridad.'],
    ['Gestioné temporalmente el equipo de producto.','Gestioné el equipo de producto.'],
    ['Lideré parcialmente la migración a PostgreSQL.','Lideré la migración a PostgreSQL.'],
    ['Actué como responsable suplente de seguridad.','Actué como responsable de seguridad.'],
    ['Asumí provisionalmente la dirección del proyecto Atlas.','Asumí la dirección del proyecto Atlas.'],
    ['Dirigí conjuntamente el proyecto con Ana.','Dirigí el proyecto con Ana.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v30',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.constraintUnsupported.length,a.issues.join(' | '))}
  for(const [before,after] of [['Fui responsable adjunto de seguridad durante la auditoría.','Fui responsable adjunto de seguridad.'],['Gestioné temporalmente el equipo durante la transición.','Gestioné temporalmente el equipo.']]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

test('v30 normalizeResume convierte todos los campos textuales nucleares a escalares seguros',()=>{
  const r=defaultResume();
  r.title={bad:true};r.summary=['bad'];r.basics={fullName:{bad:true},headline:42,email:['x'],phone:true,location:{},linkedin:5,website:null};
  r.experience=[{id:'exp1',company:{},title:42,location:['x'],startDate:2024,endDate:false,current:'yes',bullets:[{id:'b1',text:{bad:true}},{id:'b2',text:42},{id:'b3',text:['x']}]}];
  r.education=[{id:'e1',institution:{},degree:7,startDate:2020,endDate:['bad'],details:{}}];
  r.skillGroups=[{id:'s1',name:{},skills:[{},'Figma',42,['bad']]}];
  r.projects=[{id:'p1',name:{},role:3,description:['bad'],url:{},startDate:2022,endDate:false,bullets:[{text:true},{text:{bad:true}}]}];
  r.certifications=[{id:'c1',name:{},issuer:9,date:['bad'],url:{}}];r.languages=[{id:'l1',language:{},level:5}];r.achievements=[{id:'a1',title:{},description:['bad'],date:2025}];
  const n=normalizeResume(r);
  const scalar=v=>assert.equal(typeof v,'string');
  scalar(n.title);scalar(n.summary);Object.values(n.basics).forEach(scalar);
  for(const e of n.experience){['company','title','location','startDate','endDate'].forEach(k=>scalar(e[k]));for(const b of e.bullets)scalar(b.text)}
  for(const e of n.education)['institution','degree','startDate','endDate','details'].forEach(k=>scalar(e[k]));
  for(const g of n.skillGroups){scalar(g.name);g.skills.forEach(scalar)}
  for(const p of n.projects){['name','role','description','url','startDate','endDate'].forEach(k=>scalar(p[k]));for(const b of p.bullets)scalar(b.text)}
  for(const c of n.certifications)['name','issuer','date','url'].forEach(k=>scalar(c[k]));for(const l of n.languages)['language','level'].forEach(k=>scalar(l[k]));for(const a of n.achievements)['title','description','date'].forEach(k=>scalar(a[k]));
  assert.doesNotThrow(()=>analyzeResume(n));assert.doesNotThrow(()=>renderResumeHtml(n));assert.doesNotThrow(()=>runReleaseGate(n));
});

test('v31 Local AI preserva excepciones, comparadores, incertidumbre y moneda',()=>{
  const blocked=[
    ['Gestioné todos los mercados excepto España.','Gestioné todos los mercados.'],
    ['Atendí menos de 50 clientes.','Atendí 50 clientes.'],
    ['Generé más de 50 leads.','Generé 50 leads.'],
    ['Posiblemente gestioné el equipo de producto.','Gestioné el equipo de producto.'],
    ['Probablemente lideré la migración a PostgreSQL.','Lideré la migración a PostgreSQL.'],
    ['Generé $50k en ingresos.','Generé €50k en ingresos.'],
    ['I managed all markets except Spain.','I managed all markets.'],
    ['I served fewer than 50 clients.','I served 50 clients.'],
    ['I possibly managed the product team.','I managed the product team.'],
    ['Atendí >50 clientes.','Atendí 50 clientes.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v31',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.constraintUnsupported.length||a.metricUnsupported.length,a.issues.join(' | '))}
  for(const [before,after] of [
    ['Gestioné todos los mercados excepto España durante 2025.','Gestioné todos los mercados excepto España.'],
    ['Atendí menos de 50 clientes durante el trimestre.','Atendí menos de 50 clientes.'],
    ['Posiblemente gestioné el equipo durante la transición.','Posiblemente gestioné el equipo.']
  ]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v31',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

test('v31 Local AI preserva seniority y contexto de empleo',()=>{
  const blocked=[
    ['Fui Associate Director de Producto.','Fui Director de Producto.'],
    ['Trabajé como Junior Developer.','Trabajé como Developer.'],
    ['Trabajé como becario de ingeniería.','Trabajé en ingeniería.'],
    ['I was one of the security leads.','I was the security lead.'],
    ['Trabajé como contratista para Google.','Trabajé para Google.'],
    ['Trabajé medio tiempo en soporte.','Trabajé en soporte.'],
    ['Fui ex Director de Producto.','Fui Director de Producto.'],
    ['I was a former Director of Product.','I was a Director of Product.'],
    ['Soy aspirante a Product Manager.','Soy Product Manager.'],
    ['Tengo experiencia limitada en AWS.','Tengo experiencia en AWS.'],
    ['Tengo conocimientos básicos de Python.','Tengo conocimientos de Python.'],
    ['Fui Vice President de Producto.','Fui President de Producto.'],
    ['I was a Visiting Professor of Design.','I was a Professor of Design.'],
    ['I was a probationary manager.','I was a manager.'],
    ['I was an honorary chair.','I was a chair.'],
    ['I was a professor emeritus.','I was a professor.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v31',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
});

test('v31 normaliza Workbench completo antes de usar perfiles, tests y releases',()=>{
  const raw=defaultResume();raw.workbench={
    gatePolicy:{minAts:'999',minJobMatch:-50,maxPages:{},minWriting:'wat'},
    activeProfileId:'bad-profile',
    releaseProfiles:[{id:'bad-profile',name:{x:1},purpose:['x'],createdAt:{},updatedAt:[],target:{role:'QA',requirements:['SQL']},settings:{sectionOrder:{bad:true},hiddenSections:'x',sectionColumns:[],pageBreakHints:42,layout:{},fontScale:'999',headerStyle:'evil',designVariants:{ats:{layout:{},fontScale:999}}}}],
    testCases:[{id:'t',name:{},target:{role:'QA',requirements:['SQL']},thresholds:{minAts:'999',minJobMatch:-4,maxPages:99,expectedRisk:'evil'}}],
    releaseHistory:[{id:'r',label:{},profileId:'bad-profile',targetRole:{},templateId:'bad id',gate:{status:'HACK',score:999,metrics:{ats:-5,jobMatch:'x',pages:999,writing:999,visualRisk:'wat',integrity:-2}},factHash:{}}]
  };
  const r=normalizeResume(raw),wb=ensureWorkbench(r);assert.doesNotThrow(()=>runReleaseGate(r));assert.doesNotThrow(()=>runTestSuite(r));assert.equal(wb.gatePolicy.minAts,100);assert.equal(wb.gatePolicy.minJobMatch,0);assert.equal(wb.gatePolicy.maxPages,2);assert.equal(wb.releaseProfiles.length,1);assert.ok(Array.isArray(wb.releaseProfiles[0].settings.sectionOrder));assert.equal(wb.releaseProfiles[0].settings.layout,'single');assert.equal(wb.testCases[0].thresholds.maxPages,5);assert.equal(wb.testCases[0].thresholds.expectedRisk,'not-high');assert.equal(wb.releaseHistory[0].gate.status,'REVIEW');assert.equal(wb.releaseHistory[0].gate.score,100);const c=structuredClone(r);assert.doesNotThrow(()=>applyReleaseProfile(c,c.workbench.releaseProfiles[0]));assert.doesNotThrow(()=>runReleaseGate(c));
});

test('v31 normaliza snapshots de versiones corruptos antes del diff',()=>{
  const raw=defaultResume();raw.versions=[{id:'v1',date:'bad',resume:{summary:{bad:true},experience:[{bullets:[{text:{x:1}}]}],settings:{sectionOrder:{bad:true}},versions:[{resume:{bad:true}}]}}];const r=normalizeResume(raw);assert.equal(r.versions.length,1);assert.equal(typeof r.versions[0].resume.summary,'string');assert.ok(Array.isArray(r.versions[0].resume.settings.sectionOrder));assert.deepEqual(r.versions[0].resume.versions,[]);assert.doesNotThrow(()=>compareVersion(r,r.versions[0].resume));
});

test('v31 QA iterativo preserva exactitud, mínimos/máximos, excepciones y responsabilidad dependiente',()=>{
  const blocked=[
    ['Atendí exactamente 50 clientes.','Atendí 50 clientes.'],
    ['Atendí un mínimo de 50 clientes.','Atendí 50 clientes.'],
    ['Atendí maximum 50 customers.','Atendí 50 customers.'],
    ['Handled a minimum of 50 customers.','Handled 50 customers.'],
    ['Handled exactly 50 customers.','Handled 50 customers.'],
    ['Gestioné todos salvo México y España.','Gestioné todos salvo México.'],
    ['Actué como líder en ausencia de Ana.','Actué como líder.'],
    ['Fui responsable bajo supervisión de Ana.','Fui responsable.'],
    ['Contribuí al 50% del proyecto.','Contribuí al proyecto.'],
    ['Tuve responsabilidad compartida sobre el proyecto.','Tuve responsabilidad sobre el proyecto.'],
    ['I had shared responsibility for the project.','I had responsibility for the project.']
  ];
  for(const [before,after] of blocked){
    const r=defaultResume();r.summary=before;
    const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v31-iterativo',needsUserFact:false});
    assert.equal(a.safe,false,`${before} -> ${after}`);
  }
  for(const [before,after] of [
    ['Atendí exactamente 50 clientes durante el trimestre.','Atendí exactamente 50 clientes.'],
    ['Atendí entre 40 y 50 clientes durante el trimestre.','Atendí entre 40 y 50 clientes.'],
    ['Fui responsable interino del proyecto durante 2024.','Fui responsable interino del proyecto.'],
    ['Gestioné principalmente México durante el trimestre.','Gestioné principalmente México.']
  ]){
    const r=defaultResume();r.summary=before;
    const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});
    assert.equal(a.safe,true,`${before} -> ${after}: ${a.issues.join(' | ')}`);
  }
});

test('v31 QA iterativo preserva hechos futuros, previstos, proyectados y de capacidad',()=>{
  const blocked=[
    ['I will lead the migration team.','I lead the migration team.'],
    ['I will lead the migration team.','I led the migration team.'],
    ['Expected revenue of $50k.','Revenue of $50k.'],
    ['Projected revenue of $50k.','Revenue of $50k.'],
    ['Forecast revenue of $50k.','Revenue of $50k.'],
    ['Target revenue of $50k.','Revenue of $50k.'],
    ['Planned a 20% increase in sales.','20% increase in sales.'],
    ['Estimé ingresos de €50k.','Ingresos de €50k.'],
    ['I can lead international teams.','I lead international teams.'],
    ['I intend to manage the team.','I manage the team.'],
    ['Scheduled to lead the rollout.','Led the rollout.'],
    ['Nominated as Director.','Director.'],
    ['Selected to become Director.','Director.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-future',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
  for(const [before,after] of [
    ['I will lead the migration team during the transition.','I will lead the migration team.'],
    ['I can lead international teams effectively.','I can lead international teams.'],
    ['I intend to manage the team during the transition.','I intend to manage the team.']
  ]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

test('v31 QA iterativo preserva estatus prospectivo y etapa de madurez',()=>{
  const blocked=[
    ['Proposed budget of $50k.','Budget of $50k.'],
    ['Preliminary revenue of $50k.','Revenue of $50k.'],
    ['Tentative target of $50k.','Target of $50k.'],
    ['Pending promotion to Director.','Director.'],
    ['Recommended for promotion to Director.','Director.'],
    ['Offered the Director role.','Director.'],
    ['Designated to become Director.','Director.'],
    ['Appointed to start as Director next month.','Director.'],
    ['Draft plan increased sales 20%.','Increased sales 20%.'],
    ['Eligible for Director.','Director.'],
    ['Qualified for Director.','Director.'],
    ['In training for Director.','Director.'],
    ['Shortlisted for Director.','Director.'],
    ['Applied for Director.','Director.'],
    ['Led a pilot deployment of the platform.','Led a deployment of the platform.'],
    ['Built a prototype payment system.','Built a payment system.'],
    ['Ran an experimental analytics program.','Ran an analytics program.'],
    ['Managed a beta release.','Managed a release.'],
    ['Owned the MVP roadmap.','Owned the roadmap.'],
    ['Built a proof of concept for payments.','Built payments.'],
    ['Built a demo application.','Built an application.'],
    ['Deployed in a sandbox environment.','Deployed in an environment.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-status-stage',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
  for(const [before,after] of [
    ['Led a pilot deployment during Q1.','Led a pilot deployment.'],
    ['Built a prototype payment system for internal review.','Built a prototype payment system.'],
    ['Managed a beta release during testing.','Managed a beta release.']
  ]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

test('v32 QA preserva alcance parcial y no eleva parte/fase/subset al total',()=>{
  const blocked=[
    ['Lideré un workstream dentro del proyecto Atlas.','Lideré el proyecto Atlas.'],
    ['Gestioné un subconjunto del equipo de producto.','Gestioné el equipo de producto.'],
    ['Gestioné algunos miembros del equipo de producto.','Gestioné el equipo de producto.'],
    ['Fui responsable de la parte frontend de la migración.','Fui responsable de la migración.'],
    ['Dirigí una fase del programa internacional.','Dirigí el programa internacional.'],
    ['Supervisé una parte de la implementación de SAP.','Supervisé la implementación de SAP.'],
    ['Coordiné la fase de pruebas del despliegue.','Coordiné el despliegue.'],
    ['Owned the frontend portion of the migration.','Owned the migration.'],
    ['Led one workstream within Project Atlas.','Led Project Atlas.'],
    ['Managed a subset of the product team.','Managed the product team.'],
    ['Managed some members of the product team.','Managed the product team.'],
    ['Led one phase of the international program.','Led the international program.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-scope',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.constraintUnsupported.length,a.issues.join(' | '))}
  for(const [before,after] of [
    ['Lideré un workstream dentro del proyecto Atlas durante 2025.','Lideré un workstream dentro del proyecto Atlas.'],
    ['Owned the frontend portion of the migration during Q1.','Owned the frontend portion of the migration.']
  ]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

test('v32 normalizeResume usa allowlist y descarta propiedades desconocidas o blobs invisibles',()=>{
  const raw={
    title:'QA',unexpectedBlob:'x'.repeat(600000),
    settings:{templateId:'ats-ink',unexpectedNested:{data:'y'.repeat(200000)}},
    careerProfile:{targetRoles:['QA'],evil:'x'.repeat(10000)},
    evidenceVault:[{title:'Evidencia',text:'válida',evil:'z'.repeat(20000)}],
    careerPack:{blob:'z'.repeat(100000)}
  };
  const r=normalizeResume(raw);
  assert.equal(Object.hasOwn(r,'unexpectedBlob'),false);
  assert.equal(Object.hasOwn(r.settings,'unexpectedNested'),false);
  assert.equal(Object.hasOwn(r.careerProfile,'evil'),false);
  assert.equal(Object.hasOwn(r.evidenceVault[0]||{},'evil'),false);
  assert.equal(r.careerPack.role,'standalone');assert.equal(r.careerPack.masterResumeId,'');
  assert.ok(JSON.stringify(r).length<100000);
});

test('v32 QA preserva pertenencia e intervención de apoyo frente a responsabilidad directa',()=>{
  const blocked=[
    ['Fui miembro del equipo responsable de seguridad.','Fui responsable de seguridad.'],
    ['I was a member of the team responsible for security.','I was responsible for security.'],
    ['Fui responsable de apoyar la migración a PostgreSQL.','Fui responsable de la migración a PostgreSQL.'],
    ['I was responsible for supporting the PostgreSQL migration.','I was responsible for the PostgreSQL migration.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-membership',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.constraintUnsupported.length,a.issues.join(' | '))}
  for(const [before,after] of [
    ['Fui miembro del equipo responsable de seguridad durante 2025.','Fui miembro del equipo responsable de seguridad.'],
    ['I was responsible for supporting the PostgreSQL migration during Q1.','I was responsible for supporting the PostgreSQL migration.']
  ]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});

test('v32 QA preserva alcance geográfico explícito',()=>{
  const blocked=[
    ['Fui gerente regional de ventas.','Fui gerente de ventas.'],
    ['I was regional sales manager.','I was sales manager.'],
    ['Lideré el equipo de EMEA.','Lideré el equipo.'],
    ['I led the EMEA team.','I led the team.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-geo',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`);assert.ok(a.constraintUnsupported.length,a.issues.join(' | '))}
});

test('v32 QA preserva rol no principal y cardinalidad explícita de uno',()=>{
  const blocked=[
    ['Fui responsable secundario del proyecto.','Fui responsable del proyecto.'],
    ['I was secondary owner of the project.','I was owner of the project.'],
    ['Fui líder de respaldo del equipo.','Fui líder del equipo.'],
    ['I was backup lead for the team.','I was lead for the team.'],
    ['Fui líder alterno del equipo.','Fui líder del equipo.'],
    ['I was alternate lead for the team.','I was lead for the team.'],
    ['Gestioné 1 región.','Gestioné regiones.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-nonprimary',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
});

test('v32 QA preserva rol asesor/consultor y relación laboral o colaboración',()=>{
  const blocked=[
    ['Fui asesor del CEO.','Fui CEO.'],
    ['I was advisor to the CEO.','I was CEO.'],
    ['Fui asesor del Director.','Fui Director.'],
    ['I was consultant to the Director.','I was Director.'],
    ['Trabajé para Microsoft.','Trabajé en Microsoft.'],
    ['I worked for Microsoft.','I worked at Microsoft.'],
    ['Trabajé con Microsoft.','Trabajé en Microsoft.'],
    ['I worked with Microsoft.','I worked at Microsoft.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-attribution',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
});

test('v32 QA evita atribuir al usuario resultados de una entidad descrita en cláusula relativa',()=>{
  const blocked=[
    ['I advised a team that raised $1m.','I raised $1m.'],
    ['I designed a product that generated $1m in revenue.','I generated $1m in revenue.'],
    ['I advised a team which raised $1m.','I raised $1m.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-attribution-relative',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
});

test('v32 QA evita atribución embebida sin that/which',()=>{
  const blocked=[
    ['The project I worked on generated $1m.','I generated $1m.'],
    ['The team I advised raised $1m.','I raised $1m.'],
    ['The product where I worked generated $1m.','I generated $1m.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-embedded',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
});

test('v32 QA preserva estatus potencial, gestión indirecta y alcance específico del rol',()=>{
  const blocked=[
    ['Worked with prospective clients.','Worked with clients.'],
    ['I supported potential customers.','I supported customers.'],
    ['Potential revenue of $1m.','Revenue of $1m.'],
    ['Possible revenue of $1m.','Revenue of $1m.'],
    ['Posibles ingresos de $1m.','Ingresos de $1m.'],
    ['Clientes potenciales en México.','Clientes en México.'],
    ['I indirectly managed the product team.','I managed the product team.'],
    ['Gestioné indirectamente el equipo de producto.','Gestioné el equipo de producto.'],
    ['I was a dotted-line manager for the team.','I was manager for the team.'],
    ['Fui gerente matricial del equipo.','Fui gerente del equipo.'],
    ['I was a technical lead for the team.','I was lead for the team.'],
    ['Fui líder técnico del equipo.','Fui líder del equipo.'],
    ['I was project manager for Atlas.','I was manager for Atlas.'],
    ['Fui gerente de proyecto de Atlas.','Fui gerente de Atlas.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-potential',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
});

test('v32 QA preserva liderazgo informal y credenciales/formación en progreso',()=>{
  const blocked=[
    ['I was an informal lead for the team.','I was lead for the team.'],
    ['I was the unofficial lead for the team.','I was the lead for the team.'],
    ['Actué como líder informal del equipo.','Actué como líder del equipo.'],
    ['I was de facto lead for the team.','I was lead for the team.'],
    ['Studying for PMP certification.','PMP certification.'],
    ['Pursuing PMP certification.','PMP certification.'],
    ['Preparing for AWS certification.','AWS certification.'],
    ['PMP certification in progress.','PMP certification.'],
    ['Completed coursework toward an MBA.','MBA.'],
    ['Pursuing an MBA.','MBA.'],
    ['Enrolled in an MBA.','MBA.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-progress',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
});

test('v32 QA preserva otras formas de credencial pendiente',()=>{
  const blocked=[
    ['Studied for PMP certification.','PMP certification.'],
    ['On track for PMP certification.','PMP certification.'],
    ['Seeking PMP certification.','PMP certification.']
  ];
  for(const [before,after] of blocked){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'qa-v32-pending-cert',needsUserFact:false});assert.equal(a.safe,false,`${before} -> ${after}`)}
  for(const [before,after] of [['Pursuing PMP certification during 2025.','Pursuing PMP certification.'],['I was an informal lead during the transition.','I was an informal lead.']]){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'concisión',needsUserFact:false});assert.equal(a.safe,true,a.issues.join(' | '))}
});


test('v33 Factual Check usa triestado y sólo autoaplica cambios editoriales de riesgo mínimo',()=>{
  const r=defaultResume();
  const before='Product Designer con 6 años de experiencia.';
  r.summary=before;
  let a=auditLocalAiSuggestion(r,{kind:'summary',before,after:'Product Designer, con 6 años de experiencia.',reason:'puntuación',needsUserFact:false});
  assert.equal(a.status,'verified');assert.equal(a.autoApply,true);assert.equal(a.canApply,true);
  const reviewCases=[
    ['Performed Project Manager duties for 6 months.','Project Manager for 6 months.'],
    ['Covered Director responsibilities for 3 months.','Director for 3 months.'],
    ['Advised the CTO on cybersecurity strategy.','CTO.'],
    ['Reported to the VP of Sales.','VP of Sales.'],
    ['Helped lead Project Atlas.','Led Project Atlas.'],
    ['Served as a non-voting board observer.','Served on the board.'],
    ['Shadowed the Engineering Director for 2 months.','Engineering Director for 2 months.'],
    ['Completed MBA coursework.','MBA.'],
    ['Passed the PMP exam.','PMP.'],
    ['Completed AWS certification training.','AWS certification.']
  ];
  for(const [src,after] of reviewCases){const rr=defaultResume();rr.summary=src;a=auditLocalAiSuggestion(rr,{kind:'summary',before:src,after,reason:'qa-v33',needsUserFact:false});assert.notEqual(a.status,'verified',`${src} -> ${after}`);assert.equal(a.autoApply,false,`${src} -> ${after}`);assert.throws(()=>applyLocalAiSuggestion(rr,{kind:'summary',before:src,after,reason:'qa-v33',needsUserFact:false}),/revisión humana|bloqueada/i)}
});


test('v33 invariante: Verificado nunca elimina marcadores relacionales ni tokens factuales',()=>{
  const cases=[
    ['Migré datos de Oracle a PostgreSQL.','Migré datos de Oracle PostgreSQL.'],
    ['Reported to the VP.','Reported the VP.'],
    ['Worked with Microsoft.','Worked Microsoft.'],
    ['Product Designer con 6 años.','Product Designer con años.'],
    ['The Product Designer.','Product Designer.']
  ];
  for(const [before,after] of cases){const r=defaultResume();r.summary=before;const a=auditLocalAiSuggestion(r,{kind:'summary',before,after,reason:'invariante-v33',needsUserFact:false});if(a.status==='verified')assert.equal(after,'Product Designer.',`${before} -> ${after} no debe verificarse`)}
});

test('v34 preview interactiva expone edición directa sin contaminar render limpio',()=>{
  const r=defaultResume();
  const clean=renderResumeHtml(r);
  const interactive=renderResumeHtml(r,{interactive:true});
  assert.doesNotMatch(clean,/data-preview-edit|preview-delete/);
  assert.match(interactive,/data-preview-edit="basics\.fullName"/);
  assert.match(interactive,/data-preview-edit="summary"/);
  assert.match(interactive,/data-preview-edit="experience\.0\.title"/);
  assert.match(interactive,/data-preview-delete="experience:0"/);
  assert.match(interactive,/data-preview-delete="section:experience"/);
});

test('v34 títulos de sección personalizados sobreviven normalización y Vista ATS',()=>{
  const r=defaultResume();r.settings.sectionTitles={experience:'Trayectoria',summary:''};
  const n=normalizeResume(r);
  assert.equal(n.settings.sectionTitles.experience,'Trayectoria');
  assert.equal(n.settings.sectionTitles.summary,'');
  const html=renderResumeHtml(n);assert.match(html,/Trayectoria/);assert.doesNotMatch(html,/Perfil profesional/);
  const ats=atsTextView(n);assert.match(ats,/TRAYECTORIA/);assert.doesNotMatch(ats,/PERFIL PROFESIONAL/);
});

test('v34 edición directa conserva índices reales cuando existen elementos vacíos',()=>{
  const r=defaultResume();
  r.experience[0].bullets=[{id:'b_empty',text:''},{id:'b_real',text:'Segundo bullet visible'}];
  r.skillGroups=[{id:'s_empty',name:'Vacío',skills:[]},{id:'s_real',name:'Herramientas',skills:['Figma']}];
  const html=renderResumeHtml(r,{interactive:true});
  assert.match(html,/data-preview-edit="experience\.0\.bullets\.1\.text"/);
  assert.match(html,/data-preview-delete="experience:0:bullet:1"/);
  assert.match(html,/data-preview-edit="skillGroups\.1\.skills"/);
  assert.match(html,/data-preview-delete="skillGroups:1"/);
});

test('v36 preview avanzada expone acciones, fechas y placeholders sin contaminar render limpio',()=>{
  const r=defaultResume();r.education[0].details='';r.projects=[{id:'proj_qa',name:'Proyecto QA',role:'',description:'',startDate:'2024',endDate:'',bullets:[]}];
  const interactive=renderResumeHtml(r,{interactive:true}),clean=renderResumeHtml(r);
  assert.match(interactive,/data-preview-action="move\|experience\|0\|-1"/);
  assert.match(interactive,/data-preview-action="duplicate\|experience\|0"/);
  assert.match(interactive,/data-preview-action="addbullet\|experience\|0"/);
  assert.match(interactive,/data-preview-action="add\|experience"/);
  assert.match(interactive,/data-preview-edit="experience\.0\.startDate"/);
  assert.match(interactive,/data-preview-edit="education\.0\.details"/);
  assert.match(interactive,/data-preview-placeholder="Detalles \(opcional\)"/);
  assert.match(interactive,/data-preview-edit="projects\.0\.description"/);
  assert.doesNotMatch(clean,/data-preview-action|preview-add|preview-entry-controls|data-preview-placeholder/);
});

test('v36 preview interactiva permite mostrar una viñeta vacía para editarla directamente',()=>{
  const r=defaultResume();r.experience[0].bullets.push({id:'b_empty',text:''});
  const interactive=renderResumeHtml(r,{interactive:true}),clean=renderResumeHtml(r);
  assert.match(interactive,/data-preview-edit="experience\.0\.bullets\.3\.text"/);
  assert.match(interactive,/data-preview-placeholder="Escribe una viñeta"/);
  assert.doesNotMatch(clean,/b_empty|Escribe una viñeta/);
});

test('v37 preview visual usa HTML válido para entradas inline y controles accesibles',()=>{
  const r=defaultResume();r.certifications=[{id:'c1',name:'PMP',issuer:'PMI',date:'2026'}];r.achievements=[{id:'a1',title:'Premio',description:'Reconocimiento'}];r.settings.sectionOrder.push('achievements');
  const html=renderResumeHtml(r,{interactive:true});
  for(const list of ['skillGroups','certifications','languages','achievements'])assert.match(html,new RegExp(`class="resume-inline-entry" data-preview-entry data-preview-list="${list}"`));
  assert.doesNotMatch(html,/<p data-preview-entry[^>]*>[\s\S]*?preview-entry-controls/);
  assert.match(html,/class="preview-add"[^>]*title="Añadir experiencia"[^>]*aria-label="Añadir experiencia"/);
});

test('v38 preview drag-and-drop expone handles y targets sin contaminar render limpio',()=>{
  const r=defaultResume();r.experience.push({...structuredClone(r.experience[0]),id:'exp_qa_2',title:'Segundo puesto'});
  const interactive=renderResumeHtml(r,{interactive:true}),clean=renderResumeHtml(r);
  assert.match(interactive,/data-preview-drag="section\|experience"/);
  assert.match(interactive,/data-preview-drag-target="section\|experience"/);
  assert.match(interactive,/data-preview-drag="item\|experience\|0"/);
  assert.match(interactive,/data-preview-drag-target="item\|experience\|1"/);
  assert.match(interactive,/data-preview-drag="bullet\|experience\|0\|0"/);
  assert.match(interactive,/preview-drag-handle/);
  assert.doesNotMatch(clean,/data-preview-drag|preview-drag-handle|data-preview-drop-column/);
});

test('v38 layout dual marca columnas como destinos de drop sólo en preview interactiva',()=>{
  const r=defaultResume();r.settings.layout='dual';r.settings.sectionColumns={experience:'main',skills:'side'};
  const interactive=renderResumeHtml(r,{interactive:true}),clean=renderResumeHtml(r);
  assert.match(interactive,/resume-col-main" data-preview-drop-column="main"/);
  assert.match(interactive,/resume-col-side" data-preview-drop-column="side"/);
  assert.doesNotMatch(clean,/data-preview-drop-column/);
});

test('v38 renderer interactivo con drag funciona en los 528 presets sin contaminar salida limpia',()=>{
  for(const t of PERSONAL_TEMPLATES){
    const r=defaultResume();applyTemplateToResume(r,t.id);
    const interactive=renderResumeHtml(r,{interactive:true}),clean=renderResumeHtml(r);
    assert.match(interactive,/data-preview-drag="section\|/);
    assert.match(interactive,/preview-drag-handle/);
    assert.doesNotMatch(clean,/data-preview-drag|preview-drag-handle|preview-drop-/);
  }
});

test('v41 preview interactiva hace los bloques enfocables y accesibles por teclado sin contaminar render limpio',()=>{
  const r=defaultResume();r.experience=[{...r.experience[0],id:'a11y_a',title:'A'},{...structuredClone(r.experience[0]),id:'a11y_b',title:'B'}];
  const interactive=renderResumeHtml(r,{interactive:true}),clean=renderResumeHtml(r);
  assert.match(interactive,/data-preview-drag-target="item\|experience\|0" tabindex="0" role="group" aria-label="Experiencia reordenable"/);
  assert.match(interactive,/data-preview-drag-target="section\|experience" tabindex="0" role="group"/);
  assert.doesNotMatch(clean,/tabindex="0"|data-preview-drag-target|preview-drag-handle/);
});


test('v44 CV Maestro crea variante enlazada y sincroniza hechos sin destruir personalización',()=>{
  const master=defaultResume();master.title='CV Maestro';master.basics.headline='Perfil maestro';markAsMaster(master);
  const variant=createVariantFromMaster(master,{label:'Backend · Vacante A'});variant.basics.headline='Backend Senior';variant.summary='Resumen específico';variant.target={role:'Backend',company:'Empresa A',description:'Vacante',requirements:[]};variant.settings.accent='#123456';variant.workbench={...variant.workbench,notes:'Mantener'};
  master.experience[0].company='Empresa sincronizada';master.skillGroups[0].skills.push('Rust');touchMaster(master);
  assert.equal(variantSyncStatus(variant,master).outdated,true);syncVariantFromMaster(variant,master);
  assert.equal(variant.experience[0].company,'Empresa sincronizada');assert.ok(variant.skillGroups[0].skills.includes('Rust'));
  assert.equal(variant.basics.headline,'Backend Senior');assert.equal(variant.summary,'Resumen específico');assert.equal(variant.target.company,'Empresa A');assert.equal(variant.settings.accent,'#123456');assert.equal(variant.careerPack.role,'variant');assert.equal(variantSyncStatus(variant,master).outdated,false);
});

test('v44 evidencia normaliza origen, página y verificación sin aceptar basura',()=>{
  const evidence=normalizeEvidence([{field:'experience.0',quote:'Aumenté conversión 20%',page:2,confidence:96,verified:true},{bad:true},null],{sourceKind:'pdf',fileName:'cv.pdf',model:'local'});
  assert.equal(evidence.length,1);assert.equal(evidence[0].sourceKind,'pdf');assert.equal(evidence[0].fileName,'cv.pdf');assert.equal(evidence[0].page,2);assert.equal(evidence[0].verified,true);
  const r=defaultResume();r.evidenceVault=evidence;const summary=evidenceSummary(r);assert.equal(summary.total,1);assert.equal(summary.verified,1);assert.equal(summary.pages,1);
});

test('v48 normalizeEvidence conserva timestamps al reprocesar evidencia existente',()=>{
  const original={id:'ev_stable',field:'experience.0',quote:'Reduje 20 minutos',sourceKind:'pdf',fileName:'cv.pdf',createdAt:111,updatedAt:222,verified:true};
  const first=normalizeEvidence([original],{sourceKind:'pdf',fileName:'cv.pdf',model:'local'})[0],second=normalizeEvidence([first],{sourceKind:'pdf',fileName:'cv.pdf',model:'local'})[0];
  assert.equal(first.createdAt,111);assert.equal(first.updatedAt,222);assert.equal(second.createdAt,111);assert.equal(second.updatedAt,222);assert.equal(second.id,'ev_stable');
});

test('v44 paginación visual calcula guías y ajustar a una página sólo compacta diseño',()=>{
  const r=defaultResume();r.summary='Experiencia '.repeat(900);const facts=JSON.stringify({experience:r.experience,education:r.education,skillGroups:r.skillGroups,summary:r.summary});const model=pageGuideModel(r);assert.ok(model.pages>=1);
  const result=fitOnePageSettings(r);assert.equal(r.settings.pageStrategy,'one');assert.equal(r.settings.density,'compact');assert.equal(r.settings.margin,'narrow');assert.equal(r.settings.lineHeight,'compact');assert.ok(r.settings.fontScale>=.85);assert.equal(JSON.stringify({experience:r.experience,education:r.education,skillGroups:r.skillGroups,summary:r.summary}),facts);assert.equal(result.after.pageStrategy,'one');
});

test('v46 version.js es fuente común de claves y migración incluye v45',()=>{
  assert.equal(APP_MAJOR,48);assert.equal(APP_VERSION,'48.0.0-personal');assert.equal(storageKey(),'hoja-personal-v48');assert.equal(legacyStorageKeys()[0],'hoja-personal-v47');
});

test('v44 coordinador multi-pestaña no abre BroadcastChannel fuera de browser real',()=>{
  assert.equal(createTabSync({channelName:'qa'}),null);assert.equal(typeof indexedDbAvailable(),'boolean');
});

test('v44 DOCX round-trip estructural conserva hechos clave en document.xml',()=>{
  const r=defaultResume();r.basics.fullName='QA Round Trip';r.experience[0].company='Empresa RoundTrip';r.experience[0].bullets=[{id:'rt',text:'Reduje tiempos 25% con automatización.'}];
  const xml=storedZipEntry(buildDocxBytes(r),'word/document.xml');assert.match(xml,/QA Round Trip/);assert.match(xml,/Empresa RoundTrip/);assert.match(xml,/Reduje tiempos 25% con automatización/);
});


test('v44 CV Maestro no invalida variantes al crear/sincronizar otra ni por diseño',()=>{
  const master=defaultResume();markAsMaster(master);const a=createVariantFromMaster(master,{label:'A'}),revision=master.careerPack.masterRevision,b=createVariantFromMaster(master,{label:'B'});
  assert.equal(master.careerPack.masterRevision,revision);assert.equal(variantSyncStatus(a,master).outdated,false);syncVariantFromMaster(b,master);assert.equal(master.careerPack.masterRevision,revision);assert.equal(variantSyncStatus(a,master).outdated,false);
  const before=careerSharedFingerprint(master);master.settings.accent='#abcdef';assert.equal(careerSharedFingerprint(master),before);
  master.experience[0].company='Cambio factual';assert.notEqual(careerSharedFingerprint(master),before);
});


test('v45 QA paginación: Priorizar 1 página no oculta overflow real',()=>{
  const r=defaultResume();r.summary=('Palabra '.repeat(1800)).trim();r.experience=[];r.education=[];r.skillGroups=[];r.projects=[];r.certifications=[];r.languages=[];r.settings.sectionOrder=['summary'];
  fitOnePageSettings(r);const plan=buildPagePlan(r),guide=pageGuideModel(r);
  assert.equal(r.settings.pageStrategy,'one');assert.ok(plan.pages.length>=2,`plan=${plan.pages.length}`);assert.ok(guide.pages>=2);assert.equal(guide.targetMet,false);assert.match(guide.warnings.join(' '),/objetivo de 1 página/i);assert.equal(guide.overflow,guide.pages>2);
});

test('v45 QA fingerprint Maestro detecta cambios de foto/evidencia aunque mantengan longitud',()=>{
  const r=defaultResume();markAsMaster(r);r.basics.photo='data:image/jpeg;base64,AAAA1111ZZZZ';r.evidenceVault=[{id:'e1',anchor:'experience.0',quote:'ABCD',updatedAt:100,verified:false}];const before=careerSharedFingerprint(r);
  r.basics.photo='data:image/jpeg;base64,BBBB2222ZZZZ';const photoChanged=careerSharedFingerprint(r);assert.notEqual(photoChanged,before);
  r.basics.photo='data:image/jpeg;base64,AAAA1111ZZZZ';r.evidenceVault[0].quote='WXYZ';assert.notEqual(careerSharedFingerprint(r),before);
});

test('v45 QA almacenamiento detecta CV más nuevo en otra pestaña sin confiar en mensajes BroadcastChannel',()=>{
  const r=defaultResume(),key='qa-store';r.id='resume_conflict';r.updatedAt=100;
  const storage={data:{[key]:JSON.stringify({documents:[{id:'d1',updatedAt:250,resume:{...r,updatedAt:250}}]})},getItem(k){return this.data[k]??null}};
  assert.equal(persistedResumeTimestamp(storage,key,r.id),250);assert.equal(hasNewerPersistedResume(storage,key,r.id,100),true);assert.equal(hasNewerPersistedResume(storage,key,r.id,300),false);
  storage.data[key]='{corrupt';assert.equal(persistedResumeTimestamp(storage,key,r.id),0);
});


test('v46 IndexedDB: envelope durable detecta corrupción y ordena por revisión antes que timestamp',()=>{
  const a=defaultResume();a.id='dur_a';a.updatedAt=100;const stateA={documents:[{id:'a',resume:a,updatedAt:100}],currentId:'a',jobText:''};
  const e1=createDurableEnvelope(stateA,{revision:4,savedAt:1000,appVersion:'46'}),e2=createDurableEnvelope(stateA,{revision:5,savedAt:500,appVersion:'46'});
  assert.equal(stateLatestTimestamp(stateA),100);assert.ok(normalizeDurableEnvelope(e1));assert.equal(compareDurableEnvelopes(e2,e1),1);assert.equal(newestDurableEnvelope(e1,e2).revision,5);
  const corrupt=structuredClone(e1);corrupt.state.documents[0].resume.title='mutado';assert.equal(normalizeDurableEnvelope(corrupt),null);
});

test('v46 IndexedDB: envelope legado v45 se promueve sin perder estado',()=>{
  const r=defaultResume();r.title='Legado durable';r.updatedAt=456;const state={documents:[{id:'x',resume:r,updatedAt:456}],currentId:'x',jobText:''};
  const env=normalizeDurableEnvelope({savedAt:500,state});assert.ok(env);assert.equal(env.revision,0);assert.equal(env.savedAt,500);assert.equal(env.state.documents[0].resume.title,'Legado durable');
});

test('v48 IndexedDB: conserva snapshots v46 sin digest y rechaza esquemas futuros desconocidos',()=>{
  const r=defaultResume(),state={documents:[{id:'x',resume:r,updatedAt:1}],currentId:'x',jobText:''},env=createDurableEnvelope(state,{revision:2,savedAt:2,appVersion:'48'});
  const missingDigest=structuredClone(env);delete missingDigest.digest;assert.ok(normalizeDurableEnvelope(missingDigest));
  const future=structuredClone(env);future.schema=99;assert.equal(normalizeDurableEnvelope(future),null);
});

test('v46 IndexedDB: un commit atrasado no puede sobrescribir una revisión durable más nueva',async()=>{
  let stored=null;
  const store={get(){const req={};queueMicrotask(()=>{req.result=stored;req.onsuccess?.()});return req},put(v){stored=structuredClone(v)}};
  const db={objectStoreNames:{contains(){return true}},close(){},transaction(){const tx={oncomplete:null,onerror:null,onabort:null,objectStore(){return store}};setTimeout(()=>tx.oncomplete?.(),0);return tx}};
  const fake={open(){const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req}};
  const old=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fake,configurable:true});
  try{
    const r=defaultResume(),state={documents:[{id:'d',resume:r,updatedAt:1}],currentId:'d',jobText:''};
    assert.equal((await mirrorState('qa',state,{revision:9,savedAt:900})).ok,true);
    const older=structuredClone(state);older.documents[0].resume.title='stale';const result=await mirrorState('qa',older,{revision:8,savedAt:1000});assert.equal(result.ok,true);assert.equal(result.skipped,true);
    const read=await readMirroredState('qa');assert.equal(read.revision,9);assert.notEqual(read.state.documents[0].resume.title,'stale');
  }finally{Object.defineProperty(globalThis,'indexedDB',{value:old,configurable:true})}
});


test('v48 conflictos: conservar ambos preserva durable y crea una copia independiente completa',()=>{
  const remote=defaultResume();remote.id='resume_shared';remote.title='Versión durable';remote.updatedAt=9000;
  const other=defaultResume();other.id='resume_other';other.title='Otro CV remoto';other.updatedAt=8000;
  const local=structuredClone(remote);local.title='Mi edición local';local.updatedAt=9500;local.versions=[{id:'ver_keep',date:1,resume:{title:'histórico'}}];local.careerPack={role:'master',masterResumeId:local.id,masterTitle:local.title,variantLabel:'',masterRevision:2,linkedAt:1,lastSyncedAt:1};
  const latest={documents:[{id:'doc_remote',name:remote.title,resume:remote,updatedAt:9000},{id:'doc_other',name:other.title,resume:other,updatedAt:8000}],currentId:'doc_remote',jobText:'vacante durable'};
  const stale={documents:[{id:'doc_remote',name:local.title,resume:local,updatedAt:9500}],currentId:'doc_remote',jobText:'vacante local'};
  let n=0;const out=resolveConflictState(latest,stale,'doc_remote',{mode:'fork',now:10000,idFactory:p=>`${p}_fork_${++n}`});
  assert.equal(out.state.documents.length,3);assert.equal(out.state.documents[0].resume.title,'Versión durable');assert.equal(out.state.documents[1].resume.title,'Otro CV remoto');
  const fork=out.state.documents.find(d=>d.id===out.currentId);assert.equal(fork.resume.title,'Mi edición local · copia recuperada');assert.notEqual(fork.resume.id,'resume_shared');assert.equal(fork.resume.versions.length,1);assert.equal(fork.resume.careerPack.role,'standalone');assert.equal(out.state.jobText,'vacante durable');
});

test('v48 conflictos: usar mi versión reemplaza sólo el CV afectado y conserva cambios remotos ajenos',()=>{
  const remote=defaultResume();remote.id='resume_shared';remote.title='Remota';remote.updatedAt=9000;
  const other=defaultResume();other.id='resume_other';other.title='No tocar';other.summary='Cambio hecho en otra pestaña';
  const local=structuredClone(remote);local.title='Local elegida';local.summary='Mi cambio';
  const latest={documents:[{id:'doc_remote_new',name:'Remota',resume:remote,updatedAt:9000},{id:'doc_other',name:'No tocar',resume:other,updatedAt:9100}],currentId:'doc_other',jobText:'remoto'};
  const stale={documents:[{id:'old_doc',name:'Local elegida',resume:local,updatedAt:9200}],currentId:'old_doc',jobText:'local'};
  const out=resolveConflictState(latest,stale,'old_doc',{mode:'replace',now:10000,idFactory:p=>`${p}_x`});
  assert.equal(out.state.documents.length,2);assert.equal(out.currentId,'doc_remote_new');assert.equal(out.state.documents[0].resume.title,'Local elegida');assert.equal(out.state.documents[0].resume.summary,'Mi cambio');assert.equal(out.state.documents[1].resume.summary,'Cambio hecho en otra pestaña');assert.equal(out.state.jobText,'remoto');
});

test('v48 conflictos: no elimina un CV remoto cuando la biblioteca ya alcanzó el límite',()=>{
  const seed=defaultResume(),latest={documents:[],currentId:'',jobText:''};
  for(let i=0;i<500;i++){const r=structuredClone(seed);r.id=`resume_${i}`;latest.documents.push({id:`doc_${i}`,name:`CV ${i}`,resume:r,updatedAt:i})}
  const local=structuredClone(seed);local.id='resume_local';const stale={documents:[{id:'doc_local',name:'Local',resume:local,updatedAt:999}],currentId:'doc_local',jobText:''};
  assert.throws(()=>resolveConflictState(latest,stale,'doc_local',{mode:'fork',maxDocuments:500,idFactory:p=>`${p}_new`}),/límite de 500/i);assert.equal(latest.documents.length,500);
});

test('v48 QA IndexedDB CAS: un escritor con revisión esperada obsoleta no pisa cambios de otro CV',async()=>{
  let stored=null;
  const store={get(){const req={};queueMicrotask(()=>{req.result=stored;req.onsuccess?.()});return req},put(v){stored=structuredClone(v)}};
  const db={objectStoreNames:{contains(){return true}},close(){},transaction(){const tx={oncomplete:null,onerror:null,onabort:null,objectStore(){return store}};setTimeout(()=>tx.oncomplete?.(),0);return tx}};
  const fake={open(){const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req}};
  const old=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fake,configurable:true});
  try{
    const a=defaultResume(),b=defaultResume();a.id='cv_a';b.id='cv_b';a.title='A base';b.title='B base';
    const base={documents:[{id:'a',resume:a,updatedAt:100},{id:'b',resume:b,updatedAt:100}],currentId:'a',jobText:''};
    assert.equal((await mirrorState('qa-cas',base,{revision:5,savedAt:500,expectedRevision:0})).skipped,false);
    const tabA=structuredClone(base);tabA.documents[0].resume.title='A editado';tabA.documents[0].updatedAt=600;
    const tabB=structuredClone(base);tabB.documents[1].resume.title='B editado';tabB.documents[1].updatedAt=610;
    const first=await mirrorState('qa-cas',tabA,{revision:6,savedAt:600,expectedRevision:5});assert.equal(first.skipped,false);
    const stale=await mirrorState('qa-cas',tabB,{revision:6,savedAt:610,expectedRevision:5});assert.equal(stale.ok,true);assert.equal(stale.skipped,true);assert.equal(stale.conflict,true);
    const read=await readMirroredState('qa-cas');assert.equal(read.revision,6);assert.equal(read.state.documents[0].resume.title,'A editado');assert.equal(read.state.documents[1].resume.title,'B base');
  }finally{Object.defineProperty(globalThis,'indexedDB',{value:old,configurable:true})}
});

test('v48 QA IndexedDB: onblocked seguido de onsuccess tardío cierra la conexión tardía',async()=>{
  let closes=0;const db={close(){closes++}};
  const fake={open(){const req={result:db};queueMicrotask(()=>{req.onblocked?.();queueMicrotask(()=>req.onsuccess?.())});return req}};
  const old=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fake,configurable:true});
  try{assert.equal(await readMirroredState('qa-blocked'),null);await new Promise(r=>setTimeout(r,0));assert.equal(closes,1)}
  finally{Object.defineProperty(globalThis,'indexedDB',{value:old,configurable:true})}
});

test('v48 QA fuzz conflictos: fork/replace preservan documentos remotos e identidades únicas',()=>{
  for(let round=0;round<120;round++){
    const docs=[];for(let i=0;i<5;i++){const r=defaultResume();r.id=`r_${round}_${i}`;r.title=`Remote ${round}-${i}`;r.updatedAt=1000+i;docs.push({id:`d_${round}_${i}`,name:r.title,resume:r,updatedAt:1000+i})}
    const latest={documents:docs,currentId:docs[0].id,jobText:`job-${round}`},local=structuredClone(latest),target=round%5;local.currentId=local.documents[target].id;local.documents[target].resume.title=`Local ${round}`;local.documents[target].resume.updatedAt=9000+round;local.documents[target].updatedAt=9000+round;
    let n=0;const ids=p=>`${p}_${round}_${++n}`;
    const fork=resolveConflictState(latest,local,local.currentId,{mode:'fork',idFactory:ids,now:10000+round});assert.equal(fork.state.documents.length,6);assert.equal(new Set(fork.state.documents.map(d=>d.id)).size,6);assert.equal(new Set(fork.state.documents.map(d=>d.resume.id)).size,6);for(let i=0;i<5;i++)assert.equal(fork.state.documents[i].resume.title,latest.documents[i].resume.title);
    const replace=resolveConflictState(latest,local,local.currentId,{mode:'replace',idFactory:ids,now:11000+round});assert.equal(replace.state.documents.length,5);for(let i=0;i<5;i++)assert.equal(replace.state.documents[i].resume.title,i===target?`Local ${round}`:latest.documents[i].resume.title);
  }
});


test('ChatGPT bridge snapshot omite foto e historiales locales',()=>{
  const r=defaultResume();r.basics.photo='data:image/jpeg;base64,SECRET';r.versions=[{id:'history'}];r.autoVersions=[{id:'auto'}];r.workbench={secret:true};r.evidenceVault=[{quote:'private'}];
  const snap=chatGptResumeSnapshot(r);assert.equal(snap.id,r.id);assert.equal(snap.basics.photo,undefined);assert.equal(snap.versions,undefined);assert.equal(snap.autoVersions,undefined);assert.equal(snap.workbench,undefined);assert.equal(snap.evidenceVault,undefined);
});

test('ChatGPT bridge describe la conexión actual con PraxisNode sin inventar estado del túnel',()=>{
  const guide=praxisNodeConnectionGuide({mcpEndpoint:'http://127.0.0.1:4173/mcp',praxisNodeDefaultDetected:true,praxisNodeDefaultMcpEndpoint:'http://127.0.0.1:47321/mcp',praxisNodeTunnelProfile:'praxisnode'});
  assert.equal(guide.masterCvMcpEndpoint,'http://127.0.0.1:4173/mcp');assert.equal(guide.praxisNodeDefaultMcpEndpoint,'http://127.0.0.1:47321/mcp');assert.equal(guide.defaultTunnelProfile,'praxisnode');assert.equal(guide.defaultDetected,true);assert.match(guide.secondaryInstanceNote,/secundarias/i);
});

test('ChatGPT bridge cubre sync, estado, disable y resolve HTTP',async()=>{
  const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options={})=>{calls.push([url,options]);const payload=url.endsWith('/status')?{enabled:true}:url.endsWith('/pending')?{pending:[{id:'p1'}]}:{ok:true};return{ok:true,status:200,json:async()=>payload}};
  try{
    assert.equal((await syncChatGptBridge({resume:{id:'r1'}})).ok,true);assert.equal((await disableChatGptBridge()).ok,true);const state=await getChatGptBridgeState();assert.equal(state.status.enabled,true);assert.equal(state.pending[0].id,'p1');assert.equal((await resolveChatGptBridgeProposal('p1','rejected')).ok,true);assert.equal(calls.length,5);
  }finally{globalThis.fetch=original}
});

test('ChatGPT bridge propaga errores HTTP del servidor',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>({ok:false,status:422,json:async()=>({error:'rechazado por QA'})});
  try{await assert.rejects(()=>syncChatGptBridge({resume:{id:'r1'}}),/rechazado por QA/)}finally{globalThis.fetch=original}
});


test('ChatGPT bridge etiqueta ubicación exacta de perfil, bullets y campos estructurados',()=>{
  const r=defaultResume(),exp=r.experience[0],second={id:'b_location_2',text:'Segundo logro'};exp.company='Empresa QA';exp.title='Desarrollador Full Stack';exp.bullets.push(second);
  assert.equal(proposalLocationLabel(r,{kind:'summary',resumeId:r.id}),'Perfil profesional → Resumen');
  assert.equal(proposalLocationLabel(r,{kind:'bullet',resumeId:r.id,bulletId:second.id}),`Experiencia profesional → Empresa QA → Desarrollador Full Stack → Logro ${exp.bullets.length}`);
  assert.equal(proposalLocationLabel(r,{kind:'edit',resumeId:r.id,op:'set',path:'basics.headline'}),'Información personal → Título profesional');
  assert.equal(proposalLocationLabel(r,{kind:'edit',resumeId:r.id,op:'set',path:'settings.font'}),'Diseño y plantilla → Tipografía');
});

test('ChatGPT bridge etiqueta proyectos, colecciones y evita atribuir propuestas de otro CV',()=>{
  const r=defaultResume();r.projects=[{id:'proj_location',name:'Portal interno',role:'Developer',description:'',bullets:[{id:'pb_location',text:'Integré módulos'}]}];
  assert.equal(proposalLocationLabel(r,{kind:'edit',resumeId:r.id,path:'projects.bullets',parentId:'proj_location',itemId:'pb_location'}),'Proyectos → Portal interno → Logro 1');
  assert.equal(proposalLocationLabel(r,{kind:'edit',resumeId:r.id,path:'education',itemId:'missing',after:{institution:'UAS',degree:'Licenciatura en Informática'}}),'Educación → UAS → Licenciatura en Informática');
  assert.equal(proposalLocationLabel(r,{kind:'summary',resumeId:'otro-cv'}),'Otro CV · abre el CV correspondiente');
});

test('ChatGPT bridge aplica edición estructurada y renormaliza el CV',()=>{
  const r=defaultResume();const originalId=r.id;
  applyBridgeEditProposal(r,{kind:'edit',op:'set',path:'basics.fullName',after:'Alan QA',itemId:'',parentId:''});
  assert.equal(r.basics.fullName,'Alan QA');assert.equal(r.id,originalId);
  const expCount=r.experience.length;
  applyBridgeEditProposal(r,{kind:'edit',op:'upsert',path:'experience',itemId:'',parentId:'',after:{company:'Empresa QA',title:'Ingeniero',location:'México',startDate:'2024',endDate:'',current:true,bullets:[]}});
  assert.equal(r.experience.length,expCount+1);assert.ok(r.experience.at(-1).id);assert.equal(r.experience.at(-1).company,'Empresa QA');
});

test('ChatGPT bridge actualiza y elimina elementos por ID sin tocar colecciones ajenas',()=>{
  const r=defaultResume(),exp=r.experience[0],bullet=exp.bullets[0],educationId=r.education[0].id;
  applyBridgeEditProposal(r,{kind:'edit',op:'upsert',path:'experience.bullets',parentId:exp.id,itemId:bullet.id,after:{text:'Bullet actualizado'}});
  assert.equal(r.experience[0].bullets[0].text,'Bullet actualizado');
  applyBridgeEditProposal(r,{kind:'edit',op:'delete',path:'education',itemId:educationId,parentId:'',after:null});
  assert.equal(r.education.some(x=>x.id===educationId),false);assert.ok(r.experience.length>0);
  assert.match(formatBridgeProposalValue({a:1}),/"a": 1/);
});


test('Nombre profesional no duplica CV cuando no hay titular ni vacante',()=>{const r=defaultResume();r.basics.fullName='Ana Pérez';r.basics.headline='';r.target=null;assert.equal(professionalFilename(r,'pdf'),'Ana_Perez_CV.pdf')});

test('Resume Intelligence calcula score, checklist y nombre profesional sin mutar',()=>{
  const r=defaultResume(),before=JSON.stringify(r),score=cvScore(r),check=exportChecklist(r),name=professionalFilename(r,'pdf');
  assert.ok(score.score>=0&&score.score<=100);assert.ok(check.items.length>=10);assert.match(name,/Ana_Garcia_Lopez.*_CV\.pdf$/);assert.equal(JSON.stringify(r),before);
});

test('Impact Lab pregunta por resultados sólo cuando faltan métricas demostrables',()=>{
  const r=defaultResume();r.experience[0].bullets=[{id:'b1',text:'Implementé Docker para despliegues'},{id:'b2',text:'Reduje 35% el tiempo de despliegue'}];
  const qs=impactQuestions(r,{limit:10});assert.equal(qs.some(x=>x.bulletId==='b1'),true);assert.equal(qs.some(x=>x.bulletId==='b2'),false);assert.match(qs.find(x=>x.bulletId==='b1').question,/desplieg/i);
});

test('Fit inteligente elige nivel y plan sin ocultar contenido',()=>{
  const r=defaultResume(),profile=printFitProfile(r),plan=planOnePageSettings(r);assert.ok(['light','medium','strong'].includes(profile.level));assert.equal(plan.after.pageStrategy,'one');assert.ok(plan.after.fontScale>=.85);assert.equal(r.settings.pageStrategy!=='one'||plan.before.pageStrategy==='one',true);
});

test('Variante inteligente prioriza evidencia de la vacante sin añadir skills',()=>{
  const r=defaultResume();r.skillGroups=[{id:'g1',name:'General',skills:['Figma']},{id:'g2',name:'Backend',skills:['Docker','SQL']}];r.experience[0].bullets=[{id:'b1',text:'Diseñé interfaces en Figma'},{id:'b2',text:'Implementé Docker para despliegue'}];
  const job=parseJobDescription('Docker is required. SQL preferred.',{role:'Backend Engineer'}),beforeSkills=new Set(r.skillGroups.flatMap(g=>g.skills));const v=createTargetedVariantFromMaster(r,{label:'Backend',target:job}),afterSkills=new Set(v.skillGroups.flatMap(g=>g.skills));
  assert.equal(v.careerPack.role,'variant');assert.equal(v.skillGroups[0].name,'Backend');assert.match(v.experience[0].bullets[0].text,/Docker/);assert.deepEqual(afterSkills,beforeSkills);assert.match(v.basics.headline,/Backend Engineer/);
});


test('Banco de logros guarda un hecho confirmado sin modificar el bullet',()=>{
  const r=defaultResume(),before=r.experience[0].bullets[0].text,anchor=`experience.${r.experience[0].id}.bullets.${r.experience[0].bullets[0].id}`;addCareerFact(r,{anchor,title:'Impacto QA',text:'La mejora redujo el proceso en 20 minutos.'});const facts=careerFactBank(r);assert.equal(facts.length,1);assert.equal(facts[0].anchor,anchor);assert.equal(facts[0].sourceKind,'user');assert.equal(r.experience[0].bullets[0].text,before);
});

test('Interview Coach genera preguntas desde experiencia sin inventar hechos',()=>{
  const r=defaultResume(),qs=interviewQuestions(r,{limit:8});assert.ok(qs.length>0);assert.ok(qs.every(x=>typeof x.question==='string'&&x.question.length>20));assert.ok(qs.some(x=>/trabajo|caso|ejemplo|migraci|Docker|SQL/i.test(x.question)));
});


test('Merge de CV conserva campos completos y añade colecciones nuevas sin duplicar',()=>{
  const base=defaultResume(),incoming=defaultResume();base.basics.email='real@example.com';incoming.basics.email='otro@example.com';incoming.experience.push({...incoming.experience[0],id:'newexp',company:'Empresa Nueva',title:'Backend Engineer',startDate:'2025'});incoming.skillGroups=[{id:'newg',name:'Habilidades',skills:['Figma','Docker']}];const merged=mergeResumeContent(base,incoming);assert.equal(merged.basics.email,'real@example.com');assert.equal(merged.experience.filter(x=>x.company==='Empresa Nueva').length,1);assert.equal(merged.experience.filter(x=>x.company===base.experience[0].company&&x.title===base.experience[0].title).length,1);assert.ok(merged.skillGroups.flatMap(g=>g.skills).includes('Docker'));
});


test('v48 Merge de CV conserva secciones genéricas/custom y su estructura',()=>{
  const base=defaultResume(),incoming=defaultResume();
  const pub=makeGenericItem('publications','Artículo distribuido');Object.assign(pub,{url:'https://example.com/paper',description:'Paper técnico'});incoming.genericSections.publications=[pub];incoming.settings.sectionOrder.push('publications');incoming.settings.hiddenSections.push('publications');incoming.settings.sectionTitles.publications='Publicaciones seleccionadas';
  base.customSections=[{id:'custom_portfolio_base',title:'Casos especiales',icon:'＋',items:[{id:'ci_base',type:'custom-item',title:'Caso A',subtitle:'',location:'',startDate:'',endDate:'',url:'',description:'Base',bullets:[]}]}];base.settings.sectionOrder.push('custom:custom_portfolio_base');
  incoming.customSections=[{id:'custom_portfolio_in',title:'Casos especiales',icon:'＋',items:[{id:'ci_in',type:'custom-item',title:'Caso B',subtitle:'',location:'',startDate:'',endDate:'',url:'https://example.com/case-b',description:'Importado',bullets:[]}]}];incoming.settings.sectionOrder.push('custom:custom_portfolio_in');
  const merged=mergeResumeContent(base,incoming),custom=merged.customSections.find(s=>s.title==='Casos especiales');
  assert.equal(merged.genericSections.publications.length,1);assert.equal(merged.genericSections.publications[0].url,'https://example.com/paper');assert.ok(merged.settings.sectionOrder.includes('publications'));assert.ok(merged.settings.hiddenSections.includes('publications'));assert.equal(merged.settings.sectionTitles.publications,'Publicaciones seleccionadas');
  assert.equal(merged.customSections.filter(s=>s.title==='Casos especiales').length,1);assert.ok(custom.items.some(x=>x.title==='Caso A'));assert.ok(custom.items.some(x=>x.title==='Caso B'));assert.ok(merged.settings.sectionOrder.includes('custom:'+custom.id));
});

test('Merge de CV combina bullets nuevos dentro de la misma experiencia',()=>{const base=defaultResume(),incoming=structuredClone(base);incoming.experience[0].bullets.push({id:'incoming_bullet',text:'Documenté una mejora adicional validada por QA.'});incoming.experience[0].location='';const merged=mergeResumeContent(base,incoming),exp=merged.experience[0];assert.equal(exp.bullets.filter(b=>/mejora adicional/.test(b.text)).length,1);assert.equal(exp.bullets.filter(b=>/onboarding/.test(b.text)).length,1);assert.equal(exp.location,base.experience[0].location)});

test('Merge de CV no duplica evidencia ya existente',()=>{const base=defaultResume();base.evidenceVault=[{id:'ev1',type:'career-fact',title:'Impacto',text:'Reduje 20 minutos',quote:'Reduje 20 minutos',tags:['career-fact'],anchor:'experience.x',sourceKind:'user',fileName:'',page:null,confidence:100,verified:false,createdAt:1,updatedAt:1}];const incoming=structuredClone(base);incoming.evidenceVault[0].id='ev2';const merged=mergeResumeContent(base,incoming);assert.equal(merged.evidenceVault.filter(x=>x.text==='Reduje 20 minutos').length,1)});


test('Checklist de impacto no aprueba dos bullets sin ninguna métrica',()=>{const r=defaultResume();r.experience=[{id:'e1',company:'X',title:'Y',location:'',startDate:'2024',endDate:'',current:true,bullets:[{id:'b1',text:'Implementé procesos internos'},{id:'b2',text:'Coordiné despliegues con el equipo'}]}];const item=exportChecklist(r).items.find(x=>x.id==='impact');assert.equal(item.pass,false);assert.match(item.detail,/0\/2/)});


test('Preflight bloquea un perfil Product Designer dentro de un CV Full Stack',()=>{const r=defaultResume();r.basics.headline='Desarrollador Full Stack | Angular · Spring Boot';r.summary='Product Designer con 6 años de experiencia creando productos digitales simples y centrados en las personas, convirtiendo problemas complejos en experiencias claras para usuarios y negocio.';const check=exportChecklist(r),item=check.items.find(x=>x.id==='role-consistency');assert.equal(item.pass,false);assert.equal(item.severity,'block');assert.ok(check.blocks>=1);assert.match(item.detail,/desarrollo de software.*diseño de producto/i)});

test('Preflight acepta perfil y titular dentro de la misma familia profesional',()=>{const r=defaultResume();r.basics.headline='Desarrollador Full Stack | Angular';r.summary='Desarrollador Full Stack con experiencia creando y modernizando aplicaciones empresariales, integrando frontend, backend y bases de datos para resolver necesidades de negocio de forma mantenible.';const item=exportChecklist(r).items.find(x=>x.id==='role-consistency');assert.equal(item.pass,true)});


test('PDF directo conserva el factor Auto Fill calculado por la preview exacta',()=>{const r=defaultResume(),payload=buildExportPdfPayload(r,{fillScale:1.4412}),html=buildExportDocument(r,{fillScale:1.4412});assert.match(payload.html,/--export-fill-scale:1\.4412/);assert.equal(payload.attrs.autoFillScale,'1.4412');assert.match(html,/--export-fill-scale:1\.4412/);assert.equal(exportDocumentSpec(r).onePage,true)});
