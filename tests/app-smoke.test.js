import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultResume} from '../src/schema.js';

function installDom(storageValues={},options={}){
  const elements=new Map();
  const makeElement=(sel='')=>{
    const el={innerHTML:'',textContent:'',value:'',files:[],dataset:{},style:{setProperty(){},fontFamily:'',fontSize:'',transform:''},classList:{add(){},remove(){},toggle(){return false},contains(){return false}},setAttribute(){},getAttribute(){return null},click(){},focus(){},closest(){return null},appendChild(){},remove(){},oninput:null,onclick:null,onchange:null};
    if(options.throwInnerHTMLOnce===sel){let value='',thrown=false;Object.defineProperty(el,'innerHTML',{configurable:true,get(){return value},set(v){if(!thrown){thrown=true;throw new Error('qa render failure')}value=v}})}
    return el;
  };
  const get=sel=>{if(!elements.has(sel))elements.set(sel,makeElement(sel));return elements.get(sel)};
  globalThis.document={querySelector:get,querySelectorAll(sel){return options.queryAll?.(sel,makeElement)||[]},createElement(){return makeElement()},body:makeElement(),activeElement:null};
  globalThis.localStorage={get length(){return Object.keys(storageValues).length},key(i){return Object.keys(storageValues)[i]??null},getItem(k){return storageValues[k]??null},setItem(k,v){if(options.failSet?.(k,v))throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});storageValues[k]=v},removeItem(k){delete storageValues[k]}};
  let lastBlob=null;Object.defineProperty(globalThis,'URL',{value:{createObjectURL(blob){lastBlob=blob;return'blob:qa'},revokeObjectURL(){}},configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  let printCount=0,printedHtml='';globalThis.window={print(){printCount++;printedHtml=get('#exportPreviewFrame').srcdoc||get('#resumePaper').innerHTML;options.onPrint?.(printedHtml)}};globalThis.addEventListener=()=>{};globalThis.confirm=(...args)=>options.confirm?options.confirm(...args):true;globalThis.prompt=()=>null;
  return{elements,get,storageValues,getLastBlob:()=>lastBlob,getPrintCount:()=>printCount,getPrintedHtml:()=>printedHtml};
}

test('app.js arranca con un DOM mínimo y renderiza el CV inicial',async()=>{
  const {get}=installDom();
  await import(`../src/app.js?smoke=initial-${Date.now()}`);
  assert.match(get('#home').innerHTML,/Mis currículums/);
  assert.match(get('#resumePaper').innerHTML,/Ana García López/);
  assert.match(String(get('#scorePill').textContent),/^\d+$/);
  assert.match(get('#templateLabel').textContent,/ATS|Presentación/);
});

test('preview Exportación conserva el perfil PDF y permite edición exacta',async()=>{
  let human,ats,editorSurface,exportSurface;
  const {get}=installDom({}, {queryAll:(sel,make)=>{
    if(sel==='[data-preview]'){human=human||Object.assign(make(),{dataset:{preview:'human'}});ats=ats||Object.assign(make(),{dataset:{preview:'ats'}});return[human,ats]}
    if(sel==='[data-preview-surface]'){editorSurface=editorSurface||Object.assign(make(),{dataset:{previewSurface:'editor'}});exportSurface=exportSurface||Object.assign(make(),{dataset:{previewSurface:'export'}});return[editorSurface,exportSurface]}
    return[];
  }});
  await import(`../src/app.js?smoke=export-preview-${Date.now()}`);
  assert.equal(typeof exportSurface.onclick,'function');
  exportSurface.onclick();
  assert.match(get('#templateLabel').textContent,/Exportación exacta/);
  assert.match(get('#templateLabel').textContent,/1 pág\. planificada/);
  assert.doesNotMatch(get('#templateLabel').textContent,/planificada\(s\)/);
  assert.match(get('#runtimePrintPageStyle').textContent,/size:A4/);
  assert.equal(get('#previewEditBtn').disabled,false);
  assert.match(get('#exportPreviewFrame').srcdoc,/id="exportResumePaper"/);
  assert.match(get('#exportPreviewFrame').srcdoc,/exact-export-editing/);
  assert.match(get('#exportPreviewFrame').srcdoc,/data-preview-edit|preview-entry-controls|preview-drag-handle/);
  get('#previewEditBtn').onclick();
  assert.doesNotMatch(get('#exportPreviewFrame').srcdoc.slice(get('#exportPreviewFrame').srcdoc.indexOf('<article')),/data-preview-edit|preview-entry-controls|preview-drag-handle/);
  get('#previewEditBtn').onclick();
  editorSurface.onclick();
  assert.doesNotMatch(get('#templateLabel').textContent,/Exportación exacta/);
  assert.equal(get('#previewEditBtn').disabled,false);
});


test('QA impresión: runtime print usa Letter cuando el CV está configurado como carta',async()=>{
  const r=defaultResume();r.settings.paper='letter';const store={'hoja-personal-v48':JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get}=installDom(store);await import(`../src/app.js?smoke=print-letter-${Date.now()}`);assert.match(get('#runtimePrintPageStyle').textContent,/size:Letter/);
});

test('app.js normaliza IDs duplicados al cargar biblioteca local',async()=>{
  const a=defaultResume(),b=defaultResume();a.title='CV A';b.title='CV B';
  const store={'hoja-personal-v21':JSON.stringify({documents:[{id:'same_id',name:'A',resume:a},{id:'same_id',name:'B',resume:b}],currentId:'same_id',jobText:''})};
  const {get}=installDom(store);await import(`../src/app.js?smoke=dupes-${Date.now()}`);
  const ids=[...get('#home').innerHTML.matchAll(/data-home="open" data-id="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);assert.match(get('#home').innerHTML,/CV A/);assert.match(get('#home').innerHTML,/CV B/);
});

test('regresión UI: renombrar CV usa event.target.value y persiste el título',async()=>{
  const {get}=installDom();
  await import(`../src/app.js?smoke=rename-${Date.now()}`);
  assert.equal(typeof get('#docTitle').oninput,'function');
  get('#docTitle').oninput({target:{value:'CV QA Renombrado'}});
  await new Promise(r=>setTimeout(r,230));
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'home'}})}});
  assert.match(get('#home').innerHTML,/CV QA Renombrado/);
});

test('regresión UI: búsqueda y filtro de riesgo de plantillas aceptan eventos reales',async()=>{
  const {get}=installDom();
  await import(`../src/app.js?smoke=templates-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'templates'}})}});
  assert.equal(typeof get('#templateSearch').oninput,'function');
  assert.doesNotThrow(()=>get('#templateSearch').oninput({target:{value:'developer'}}));
  assert.doesNotThrow(()=>get('#riskFilter').onchange({target:{value:'high'}}));
  assert.match(get('#templates').innerHTML,/risk high|Visual \/ alto|Visual/i);
});

test('regresión UI: importar JSON con ID existente crea un CV nuevo con ID único',async()=>{
  const existing=defaultResume();existing.id='resume_same';existing.title='Original';
  const incoming=structuredClone(existing);incoming.title='Importado';
  const store={'hoja-personal-v22':JSON.stringify({documents:[{id:'resume_same',name:'Original',resume:existing}],currentId:'resume_same',jobText:''})};
  const {get}=installDom(store);
  await import(`../src/app.js?smoke=import-id-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});
  get('#importFile').files=[{name:'duplicado.json',type:'application/json',text:async()=>JSON.stringify({resume:incoming})}];
  await get('#importBtn').onclick();
  get('#importTitle').value='Importado';
  get('#confirmImport').onclick();
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'home'}})}});
  const ids=[...get('#home').innerHTML.matchAll(/data-home="open" data-id="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
  assert.match(get('#home').innerHTML,/Original/);assert.match(get('#home').innerHTML,/Importado/);
});

test('v29 importación JSON sanea target corrupto y mantiene ATS/Vacante operativos',async()=>{
  const incoming=defaultResume();incoming.title='Target corrupto';incoming.target={role:'QA',requirements:[null,5,{concept:null},{concept:'Figma',importance:'wat',type:'wat',confidence:99,line:-7},'SQL']};
  const {get,storageValues}=installDom();await import(`../src/app.js?smoke=v29-target-normalize-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});get('#importFile').files=[{name:'target.json',type:'application/json',size:1000,text:async()=>JSON.stringify({resume:incoming})}];await get('#importBtn').onclick();get('#importTitle').value='Target saneado';assert.doesNotThrow(()=>get('#confirmImport').onclick());for(const view of ['target','ats','workbench','export'])assert.doesNotThrow(()=>get('#mainNav').onclick({target:{closest:()=>({dataset:{view}})}}),view);const saved=JSON.parse(storageValues['hoja-personal-v48']),doc=saved.documents.find(d=>d.resume.title==='Target saneado');assert.ok(doc);assert.equal(doc.resume.target.requirements.length,2);assert.ok(doc.resume.target.requirements.every(x=>x&&typeof x.concept==='string'));
});

test('regresión importación: JSON enorme se rechaza antes de leerlo',async()=>{
  const {get}=installDom();
  await import(`../src/app.js?smoke=oversize-json-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});
  let read=false;
  get('#importFile').files=[{name:'gigante.json',type:'application/json',size:13*1024*1024,text:async()=>{read=true;return '{}'}}];
  await get('#importBtn').onclick();
  assert.equal(read,false);
  assert.match(get('#toast').textContent,/demasiado grande/i);
});

test('regresión restauración: backup con documentos inválidos no reemplaza la biblioteca',async()=>{
  const {get}=installDom();
  await import(`../src/app.js?smoke=invalid-backup-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});
  const bad={state:{documents:[{id:'x',resume:null}],currentId:'x'}};
  await get('#restoreAll').onchange({target:{files:[{name:'bad.json',size:100,text:async()=>JSON.stringify(bad)}]}});
  assert.match(get('#toast').textContent,/Backup inválido/i);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'home'}})}});
  assert.match(get('#home').innerHTML,/Ana García López|Mi currículum/);
});

test('regresión vacante: una descripción descomunal se rechaza antes de analizar',async()=>{
  const {get}=installDom();
  await import(`../src/app.js?smoke=job-limit-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'target'}})}});
  get('#jobText').value='x'.repeat(250001);
  get('#analyzeJob').onclick();
  assert.match(get('#toast').textContent,/demasiado larga/i);
});

test('smoke UI: todas las vistas principales renderizan sin excepción',async()=>{
  const {get}=installDom();
  await import(`../src/app.js?smoke=all-views-${Date.now()}`);
  const ids=['home','editor','studio','templates','aicreator','workbench','quality','ats','target','export'];
  for(const view of ids){
    assert.doesNotThrow(()=>get('#mainNav').onclick({target:{closest:()=>({dataset:{view}})}}),view);
    assert.ok(get('#'+view).innerHTML.length>20,`${view} debe renderizar contenido`);
  }
});

test('v42 Crear con IA muestra prompt, archivo local, modelo y diseño inicial',async()=>{
  const {get}=installDom();await import(`../src/app.js?smoke=v42-ai-create-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'aicreator'}})}});
  const html=get('#aicreator').innerHTML;
  assert.match(html,/Crear CV con IA/);assert.match(html,/aiCreatePrompt/);assert.match(html,/aiCreateFile/);assert.match(html,/PDF · DOCX · TXT/);assert.match(html,/PNG\/JPG\/WebP/);
  assert.match(html,/Modelo Ollama/);assert.match(html,/Diseño inicial/);assert.match(html,/Crear borrador de CV/);
});


test('smoke UI: backup con settings corruptos se normaliza y Studio sigue abriendo',async()=>{
  const r=defaultResume();r.settings.designVariants='roto';r.settings.layout='triple';r.settings.fontScale='NaN';
  const store={'hoja-personal-v22':JSON.stringify({documents:[{id:r.id,name:'Corrupto recuperable',resume:r}],currentId:r.id,jobText:''})};
  const {get}=installDom(store);
  await import(`../src/app.js?smoke=corrupt-settings-${Date.now()}`);
  assert.doesNotThrow(()=>get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'studio'}})}}));
  assert.match(get('#studio').innerHTML,/Layout Composer|Studio Packs/);
});


test('v23 transacción: importar CV revierte memoria y no anuncia éxito si localStorage está lleno',async()=>{
  const original=defaultResume();original.id='resume_original';original.title='Original';
  const incoming=defaultResume();incoming.id='resume_incoming';incoming.title='Importado';
  const store={'hoja-personal-v48':JSON.stringify({documents:[{id:'resume_original',name:'Original',resume:original}],currentId:'resume_original',jobText:''})};
  const initial=store['hoja-personal-v48'];
  const {get,storageValues}=installDom(store,{failSet:k=>k==='hoja-personal-v48'});
  await import(`../src/app.js?smoke=quota-import-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});
  get('#importFile').files=[{name:'nuevo.json',type:'application/json',size:100,text:async()=>JSON.stringify({resume:incoming})}];
  await get('#importBtn').onclick();get('#importTitle').value='Importado';get('#confirmImport').onclick();
  assert.match(get('#toast').textContent,/revirti|revirtió/i);assert.doesNotMatch(get('#toast').textContent,/CV importado$/i);
  assert.equal(storageValues['hoja-personal-v48'],initial);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'home'}})}});
  assert.match(get('#home').innerHTML,/Original/);assert.doesNotMatch(get('#home').innerHTML,/Importado/);
});

test('v23 transacción: restauración revierte estado principal si falla una preferencia auxiliar',async()=>{
  const original=defaultResume();original.id='resume_original';original.title='Original';
  const incoming=defaultResume();incoming.id='resume_backup';incoming.title='Desde backup';
  const oldState=JSON.stringify({documents:[{id:'resume_original',name:'Original',resume:original}],currentId:'resume_original',jobText:''});
  const store={'hoja-personal-v48':oldState,'hoja-personal-v48-favorites':JSON.stringify(['ats-ink']),'hoja-personal-v48-recent-templates':JSON.stringify(['ats-ink']),'hoja-personal-v48-forge-themes':JSON.stringify([])};
  const backup={version:23,state:{documents:[{id:'resume_backup',name:'Desde backup',resume:incoming}],currentId:'resume_backup',jobText:''},personalData:{favorites:['creative-violet'],recentTemplates:['creative-violet'],forgeThemes:[]}};
  const {get,storageValues}=installDom(store,{failSet:k=>k==='hoja-personal-v48-favorites'});
  await import(`../src/app.js?smoke=quota-restore-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});
  await get('#restoreAll').onchange({target:{files:[{name:'backup.json',size:1000,text:async()=>JSON.stringify(backup)}]}});
  assert.match(get('#toast').textContent,/No hay espacio|No se aplicó ningún cambio/i);
  assert.equal(storageValues['hoja-personal-v48'],oldState);
  assert.equal(storageValues['hoja-personal-v48-favorites'],JSON.stringify(['ats-ink']));
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'home'}})}});
  assert.match(get('#home').innerHTML,/Original/);assert.doesNotMatch(get('#home').innerHTML,/Desde backup/);
});

test('v23 backup completo incluye favoritos, recientes y Template Forge',async()=>{
  const forge=[{id:'forge_qa',name:'Mi QA',baseId:'ats-ink',overrides:{accent:'#111827',font:'Arial',layout:'single',density:'comfortable',margin:'normal',fontScale:1,lineHeight:'normal',paper:'a4',headerStyle:'line',headingStyle:'line',dividerStyle:'light',contactStyle:'inline'}}];
  const store={'hoja-personal-v48-favorites':JSON.stringify(['ats-ink']),'hoja-personal-v48-recent-templates':JSON.stringify(['modern-navy']),'hoja-personal-v48-forge-themes':JSON.stringify(forge)};
  const {get,getLastBlob}=installDom(store);await import(`../src/app.js?smoke=full-backup-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});get('#backupAll').onclick();
  const blob=getLastBlob();assert.ok(blob);const raw=JSON.parse(await blob.text());
  assert.equal(raw.version,48);assert.deepEqual(raw.personalData.favorites,['ats-ink']);assert.deepEqual(raw.personalData.recentTemplates,['modern-navy']);assert.equal(raw.personalData.forgeThemes[0].name,'Mi QA');
});


test('v28 backup individual JSON conserva diseño y Workbench al importar',async()=>{
  const original=defaultResume();original.id='resume_design';original.title='Diseño portable';
  Object.assign(original.settings,{templateId:'creative-violet',templateFamily:'creative',layout:'dual',font:'Georgia',accent:'#123456',density:'airy',margin:'wide',fontScale:1.08,lineHeight:'relaxed'});
  original.workbench={gatePolicy:{minAts:77,minJobMatch:55,maxPages:2,minWriting:60},releaseProfiles:[],testCases:[],releaseHistory:[]};
  const store={'hoja-personal-v48':JSON.stringify({documents:[{id:'base',name:'Base',resume:defaultResume()}],currentId:'base',jobText:''})};
  const {get,storageValues}=installDom(store);await import(`../src/app.js?smoke=v28-json-design-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});
  get('#importFile').files=[{name:'portable.json',type:'application/json',size:1000,text:async()=>JSON.stringify({resume:original})}];
  await get('#importBtn').onclick();get('#importTitle').value='Diseño portable';get('#confirmImport').onclick();
  const saved=JSON.parse(storageValues['hoja-personal-v48']);const imported=saved.documents.find(d=>d.resume.title==='Diseño portable').resume;
  assert.equal(imported.settings.templateId,'creative-violet');assert.equal(imported.settings.layout,'dual');assert.equal(imported.settings.font,'Georgia');assert.equal(imported.settings.accent,'#123456');assert.equal(imported.settings.density,'airy');assert.equal(imported.settings.margin,'wide');assert.equal(imported.settings.fontScale,1.08);assert.equal(imported.settings.lineHeight,'relaxed');assert.equal(imported.workbench.gatePolicy.minAts,77);
});

test('v28 exportación TXT funciona aunque falle el registro de Release por cuota',async()=>{
  const r=defaultResume();const store={'hoja-personal-v48':JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  let exportButton;const {get,getLastBlob}=installDom(store,{failSet:k=>k==='hoja-personal-v48',queryAll:(sel,make)=>{if(sel==='[data-export]'){exportButton=make();exportButton.dataset={export:'txt'};return[exportButton]}return[]}});
  await import(`../src/app.js?smoke=v28-export-quota-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});
  assert.equal(typeof exportButton.onclick,'function');exportButton.onclick();
  const blob=getLastBlob();assert.ok(blob,'debe crear el archivo incluso sin espacio');assert.match(await blob.text(),/Ana García López/);assert.match(get('#toast').textContent,/Archivo exportado|Release no se registró/i);
});

test('v28 abrir otro CV funciona aunque no pueda persistirse currentId',async()=>{
  const a=defaultResume(),b=defaultResume();a.id='resume_a';a.title='CV A';b.id='resume_b';b.title='CV B';b.basics.fullName='Persona B';
  const store={'hoja-personal-v48':JSON.stringify({documents:[{id:'doc_a',name:'CV A',resume:a},{id:'doc_b',name:'CV B',resume:b}],currentId:'doc_a',jobText:''})};
  let openButton;const {get}=installDom(store,{failSet:k=>k==='hoja-personal-v48',queryAll:(sel,make)=>{if(sel==='[data-home]'){openButton=make();openButton.dataset={home:'open',id:'doc_b'};return[openButton]}return[]}});
  await import(`../src/app.js?smoke=v28-open-quota-${Date.now()}`);assert.equal(typeof openButton.onclick,'function');openButton.onclick();
  assert.match(get('#resumePaper').innerHTML,/Persona B/);assert.match(get('#toast').textContent,/CV abierto/i);
});


test('v28 PDF superior refresca cambios pendientes antes de imprimir',async()=>{
  let pathInput=null;
  const {get,getPrintCount,getPrintedHtml}=installDom({}, {queryAll:(sel,make)=>{if(sel==='[data-path]'){pathInput=pathInput||make();pathInput.dataset={path:'basics.fullName'};return[pathInput]}return[]}});
  await import(`../src/app.js?smoke=v28-pdf-fresh-${Date.now()}`);
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'editor'}})}});
  assert.equal(typeof pathInput.oninput,'function');pathInput.value='Nombre Nuevo QA';pathInput.oninput();
  assert.doesNotMatch(get('#resumePaper').innerHTML,/Nombre Nuevo QA/,'la preview debe seguir pendiente antes del export');
  get('#pdfBtn').onclick();
  assert.equal(getPrintCount(),1);assert.match(getPrintedHtml(),/Nombre Nuevo QA/);
});

test('v28 PDF superior usa el mismo Release Gate y respeta cancelar',async()=>{
  const r=defaultResume();r.summary='';r.experience=[];r.education=[];r.skillGroups=[];r.projects=[];r.certifications=[];r.languages=[];r.workbench={gatePolicy:{minAts:100,minJobMatch:100,maxPages:1,minWriting:100},releaseProfiles:[],testCases:[],releaseHistory:[]};
  const store={'hoja-personal-v48':JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  let asked=0;const {get,getPrintCount}=installDom(store,{confirm:()=>{asked++;return false}});
  await import(`../src/app.js?smoke=v28-pdf-gate-${Date.now()}`);get('#pdfBtn').onclick();
  assert.ok(asked>=1,'el Release Gate debe pedir confirmación');assert.equal(getPrintCount(),0,'cancelar no debe imprimir');
});


test('v29 mutateAndSave revierte memoria y localStorage si onSuccess falla después de persistir',async()=>{
  const r=defaultResume();const key='hoja-personal-v48',store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};const before=store[key];let newButton;
  const {storageValues}=installDom(store,{throwInnerHTMLOnce:'#editor',queryAll:(sel,make)=>{if(sel==='[data-home]'){newButton=make();newButton.dataset={home:'new-ats'};return[newButton]}return[]}});
  await import(`../src/app.js?smoke=v29-atomic-on-success-${Date.now()}`);assert.equal(typeof newButton.onclick,'function');assert.doesNotThrow(()=>newButton.onclick());assert.equal(storageValues[key],before);assert.equal(JSON.parse(storageValues[key]).documents.length,1);
});

test('v31 UI carga Workbench corrupto normalizado sin romper Gate, Test Lab ni Exportar',async()=>{
  const r=defaultResume();r.workbench={
    gatePolicy:{minAts:'999',minJobMatch:-50,maxPages:{},minWriting:'bad'},
    releaseProfiles:[{id:'p_bad',name:{x:1},purpose:[],target:{role:'QA',requirements:['SQL']},settings:{sectionOrder:{bad:true},sectionColumns:[],fontScale:999,layout:{}}}],
    testCases:[{id:'t_bad',name:{},target:{role:'QA',requirements:['SQL']},thresholds:{minAts:999,maxPages:99,expectedRisk:'evil'}}],
    releaseHistory:[{id:'r_bad',label:{},gate:{status:'HACK',score:999,metrics:{ats:-5,pages:999,visualRisk:'wat'}}}]
  };
  const store={'hoja-personal-v48':JSON.stringify({documents:[{id:r.id,name:'Workbench corrupto',resume:r}],currentId:r.id,jobText:''})};
  const {get}=installDom(store);await import(`../src/app.js?smoke=v31-workbench-corrupt-${Date.now()}`);
  assert.doesNotThrow(()=>get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'workbench'}})}}));assert.match(get('#workbench').innerHTML,/Release Gate/);
  assert.doesNotThrow(()=>get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}}));assert.match(get('#export').innerHTML,/Preflight/);
});

test('v31 UI normaliza snapshots históricos corruptos antes de Calidad/diff',async()=>{
  const r=defaultResume();r.versions=[{id:'badver',date:'bad',resume:{summary:{bad:true},experience:[{bullets:[{text:{x:1}}]}],settings:{sectionOrder:{bad:true}},versions:[{resume:{nested:true}}]}}];
  const store={'hoja-personal-v48':JSON.stringify({documents:[{id:r.id,name:'Historial corrupto',resume:r}],currentId:r.id,jobText:''})};
  const {get}=installDom(store);await import(`../src/app.js?smoke=v31-version-corrupt-${Date.now()}`);
  assert.doesNotThrow(()=>get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'quality'}})}}));assert.match(get('#quality').innerHTML,/Diff de snapshot/);
});

test('v32 carga de biblioteca descarta propiedades desconocidas del state global',async()=>{
  const r=defaultResume(),store={'hoja-personal-v48':JSON.stringify({documents:[{id:'d1',name:'CV',resume:r,updatedAt:Date.now()}],currentId:'d1',jobText:'QA',unexpectedBlob:'x'.repeat(500000)})};
  const {get,storageValues}=installDom(store);
  await import(`../src/app.js?smoke=v32-state-allowlist-${Date.now()}`);
  get('#docTitle').oninput({target:{value:'CV allowlist'}});await new Promise(resolve=>setTimeout(resolve,230));
  const saved=JSON.parse(storageValues['hoja-personal-v48']);assert.equal(Object.hasOwn(saved,'unexpectedBlob'),false);assert.equal(saved.jobText,'QA');
});

test('v36 edición inline persiste y deshacer restaura el texto anterior',async()=>{
  const key='hoja-personal-v48',r=defaultResume(),store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store);const paper=get('#resumePaper'),editable={innerText:'Ana García López',textContent:'Ana García López',dataset:{previewEdit:'basics.fullName',previewKind:'text'},style:{},classList:{toggle(){},add(){},remove(){}},blur(){this.onblur?.()},contentEditable:'false'};
  paper.querySelectorAll=sel=>sel==='[data-preview-edit]'?[editable]:[];
  await import(`../src/app.js?smoke=v36-inline-undo-${Date.now()}`);
  assert.equal(typeof editable.onfocus,'function');editable.onfocus();editable.innerText='Nombre editado desde preview';editable.onblur();
  assert.equal(JSON.parse(storageValues[key]).documents[0].resume.basics.fullName,'Nombre editado desde preview');
  assert.equal(typeof get('#previewUndoBtn').onclick,'function');get('#previewUndoBtn').onclick();
  assert.equal(JSON.parse(storageValues[key]).documents[0].resume.basics.fullName,'Ana García López');
  assert.equal(typeof get('#previewRedoBtn').onclick,'function');get('#previewRedoBtn').onclick();
  assert.equal(JSON.parse(storageValues[key]).documents[0].resume.basics.fullName,'Nombre editado desde preview');
});

test('v36 acciones contextuales permiten añadir experiencia desde la preview',async()=>{
  const key='hoja-personal-v48',r=defaultResume(),store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store);const paper=get('#resumePaper'),action={dataset:{previewAction:'add|experience'},style:{},classList:{toggle(){},add(){},remove(){}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-action]'?[action]:[];
  await import(`../src/app.js?smoke=v36-preview-add-${Date.now()}`);
  assert.equal(typeof action.onclick,'function');action.onclick({preventDefault(){},stopPropagation(){}});
  const saved=JSON.parse(storageValues[key]);assert.equal(saved.documents[0].resume.experience.length,2);
});

test('v36 PDF imprime render limpio aunque la edición directa esté activa',async()=>{
  const {get,getPrintCount,getPrintedHtml}=installDom();
  await import(`../src/app.js?smoke=v36-pdf-clean-${Date.now()}`);
  get('#pdfBtn').onclick();
  assert.equal(getPrintCount(),1);
  assert.match(getPrintedHtml(),/Ana García López/);
  const printedArticle=getPrintedHtml().slice(getPrintedHtml().indexOf('<article'));
  assert.doesNotMatch(printedArticle,/data-preview-edit|data-preview-action|preview-entry-controls|preview-add|data-preview-drag|preview-drag-handle/);
});

test('v36 undo/redo conserva una viñeta nueva aún vacía',async()=>{
  const key='hoja-personal-v48',r=defaultResume(),store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store);const paper=get('#resumePaper'),action={dataset:{previewAction:'addbullet|experience|0'},style:{},classList:{toggle(){},add(){},remove(){}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-action]'?[action]:[];
  await import(`../src/app.js?smoke=v36-empty-bullet-history-${Date.now()}`);
  action.onclick({preventDefault(){},stopPropagation(){}});assert.equal(JSON.parse(storageValues[key]).documents[0].resume.experience[0].bullets.length,4);
  get('#previewUndoBtn').onclick();assert.equal(JSON.parse(storageValues[key]).documents[0].resume.experience[0].bullets.length,3);
  get('#previewRedoBtn').onclick();assert.equal(JSON.parse(storageValues[key]).documents[0].resume.experience[0].bullets.length,4);
});

test('v43 migra biblioteca v42 y persiste cambios en el store v43',async()=>{
  const r=defaultResume();r.title='CV desde v42';const store={'hoja-personal-v42':JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store);await import(`../src/app.js?smoke=v43-migrate-v42-${Date.now()}`);
  assert.match(get('#home').innerHTML,/CV desde v42/);get('#docTitle').oninput({target:{value:'CV migrado v43'}});await new Promise(res=>setTimeout(res,230));
  assert.ok(storageValues['hoja-personal-v48']);assert.equal(JSON.parse(storageValues['hoja-personal-v48']).documents[0].resume.title,'CV migrado v43');
});

test('v38 drag-and-drop reordena experiencias, persiste y entra en Deshacer',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[
    {...r.experience[0],id:'exp_a',title:'Primero'},
    {...structuredClone(r.experience[0]),id:'exp_b',title:'Segundo'}
  ];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const sourceNode={dataset:{previewDragTarget:'item|experience|0'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'item|experience|0'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|1'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?smoke=v38-drag-item-${Date.now()}`);
  assert.equal(typeof handle.ondragstart,'function');assert.equal(typeof paper.ondrop,'function');
  const dt={setData(){},setDragImage(){},effectAllowed:'',dropEffect:''};
  handle.ondragstart({stopPropagation(){},dataTransfer:dt});
  paper.ondragover({target,clientY:90,preventDefault(){},dataTransfer:dt});
  paper.ondrop({target,clientY:90,preventDefault(){},stopPropagation(){}});
  let saved=JSON.parse(storageValues[key]);assert.deepEqual(saved.documents[0].resume.experience.map(x=>x.title),['Segundo','Primero']);
  get('#previewUndoBtn').onclick();saved=JSON.parse(storageValues[key]);assert.deepEqual(saved.documents[0].resume.experience.map(x=>x.title),['Primero','Segundo']);
});

test('v38 drag-and-drop mueve viñetas entre experiencias del mismo bloque',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[
    {...r.experience[0],id:'exp_a',title:'A',bullets:[{id:'b_a',text:'Moverme'}]},
    {...structuredClone(r.experience[0]),id:'exp_b',title:'B',bullets:[{id:'b_b',text:'Destino'}]}
  ];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const sourceNode={dataset:{previewDragTarget:'bullet|experience|0|0'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'bullet|experience|0|0'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|1'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?smoke=v38-drag-bullet-${Date.now()}`);
  const dt={setData(){},setDragImage(){}};handle.ondragstart({stopPropagation(){},dataTransfer:dt});paper.ondragover({target,clientY:50,preventDefault(){},dataTransfer:dt});paper.ondrop({target,clientY:50,preventDefault(){},stopPropagation(){}});
  const saved=JSON.parse(storageValues[key]).documents[0].resume.experience;
  assert.equal(saved[0].bullets.length,0);assert.deepEqual(saved[1].bullets.map(x=>x.text),['Destino','Moverme']);
});

test('v38 drag-and-drop mueve secciones entre columnas y persiste sectionColumns',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.settings.layout='dual';r.settings.sectionColumns={experience:'main',skills:'side'};
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const sourceNode={dataset:{previewDragTarget:'section|experience'},classList:{add(){},remove(){},contains(){return false}},parentElement:paper};
  const handle={dataset:{previewDrag:'section|experience'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const sideColumn={dataset:{previewDropColumn:'side'},classList:{contains(c){return c==='resume-col-side'}},parentElement:paper};
  const target={dataset:{previewDragTarget:'section|skills'},classList:{add(){},remove(){},contains(){return false}},parentElement:sideColumn,getBoundingClientRect(){return{top:0,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?smoke=v38-drag-section-column-${Date.now()}`);
  const dt={setData(){},setDragImage(){}};handle.ondragstart({stopPropagation(){},dataTransfer:dt});paper.ondragover({target,clientY:90,preventDefault(){},dataTransfer:dt});paper.ondrop({target,clientY:90,preventDefault(){},stopPropagation(){}});
  const saved=JSON.parse(storageValues[key]).documents[0].resume;
  assert.equal(saved.settings.sectionColumns.experience,'side');
  assert.ok(saved.settings.sectionOrder.indexOf('experience')>saved.settings.sectionOrder.indexOf('skills'));
});

test('v38 drag-and-drop revierte el orden si falla la persistencia por cuota',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'a',title:'A'},{...structuredClone(r.experience[0]),id:'b',title:'B'}];
  const initial=JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''}),store={[key]:initial};
  const {get,storageValues}=installDom(store,{failSet:k=>k===key}),paper=get('#resumePaper');
  const sourceNode={dataset:{previewDragTarget:'item|experience|0'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'item|experience|0'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|1'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?smoke=v38-drag-quota-${Date.now()}`);
  const dt={setData(){},setDragImage(){}};handle.ondragstart({stopPropagation(){},dataTransfer:dt});paper.ondragover({target,clientY:90,preventDefault(){},dataTransfer:dt});paper.ondrop({target,clientY:90,preventDefault(){},stopPropagation(){}});
  assert.equal(storageValues[key],initial);assert.match(get('#resumePaper').innerHTML,/A/);assert.match(get('#toast').textContent,/revirti|No se guardó/i);
});

test('QA v40 regression: soltar una viñeta sobre su propio padre la mueve realmente al final',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'exp_a',title:'A',bullets:[{id:'b1',text:'Uno'},{id:'b2',text:'Dos'},{id:'b3',text:'Tres'},{id:'b4',text:'Cuatro'}]}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const sourceNode={dataset:{previewDragTarget:'bullet|experience|0|1'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'bullet|experience|0|1'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|0'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?qa=bullet-parent-append-${Date.now()}`);
  const dt={setData(){},setDragImage(){}};handle.ondragstart({stopPropagation(){},dataTransfer:dt});paper.ondragover({target,clientY:50,preventDefault(){},dataTransfer:dt});paper.ondrop({target,clientY:50,preventDefault(){},stopPropagation(){}});
  const bullets=JSON.parse(storageValues[key]).documents[0].resume.experience[0].bullets.map(x=>x.text);
  assert.deepEqual(bullets,['Uno','Tres','Cuatro','Dos']);
});

test('QA v40 regression: un drop que no cambia el orden no crea un falso paso de Deshacer',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'a',title:'A'},{...structuredClone(r.experience[0]),id:'b',title:'B'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const sourceNode={dataset:{previewDragTarget:'item|experience|0'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'item|experience|0'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|1'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?qa=noop-drag-${Date.now()}`);
  const before=storageValues[key],dt={setData(){},setDragImage(){}};
  handle.ondragstart({stopPropagation(){},dataTransfer:dt});paper.ondragover({target,clientY:10,preventDefault(){},dataTransfer:dt});paper.ondrop({target,clientY:10,preventDefault(){},stopPropagation(){}});
  assert.deepEqual(JSON.parse(storageValues[key]).documents[0].resume.experience.map(x=>x.title),['A','B']);
  assert.equal(storageValues[key],before,'un no-op no debe tocar persistencia ni updatedAt');
  assert.equal(get('#previewUndoBtn').disabled,true,'un no-op no debe crear historial de preview');
});

test('QA v40: botones de mover en límite no crean guardado ni historial fantasma',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'only',title:'Única'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const action={dataset:{previewAction:'move|experience|0|-1'},style:{},classList:{add(){},remove(){}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-action]'?[action]:[];
  await import(`../src/app.js?qa=boundary-noop-${Date.now()}`);
  const before=storageValues[key];action.onclick({preventDefault(){},stopPropagation(){}});
  assert.equal(storageValues[key],before);assert.equal(get('#previewUndoBtn').disabled,true);
});

test('QA v40: drag hace autoscroll del panel al acercarse al borde inferior',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'a',title:'A'},{...structuredClone(r.experience[0]),id:'b',title:'B'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get}=installDom(store),paper=get('#resumePaper');
  const pane={scrollTop:100,scrollHeight:2000,clientHeight:500,getBoundingClientRect(){return{top:0,bottom:500,height:500}}};paper.closest=sel=>sel==='.preview-pane'?pane:null;
  const sourceNode={dataset:{previewDragTarget:'item|experience|0'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'item|experience|0'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|1'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:300,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?qa=drag-autoscroll-${Date.now()}`);
  const dt={setData(){},setDragImage(){}};handle.ondragstart({stopPropagation(){},dataTransfer:dt});paper.ondragover({target,clientY:495,preventDefault(){},dataTransfer:dt});
  assert.ok(pane.scrollTop>100,`scrollTop esperado >100, recibido ${pane.scrollTop}`);handle.ondragend();
});

test('QA v40: editar y pasar directo al grip guarda sin reemplazar la preview antes del drag',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'edit_a',title:'Primero'},{...structuredClone(r.experience[0]),id:'edit_b',title:'Segundo'}];const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const sourceNode={dataset:{previewDragTarget:'item|experience|0'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'item|experience|0'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|1'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  const editable={innerText:'Primero',textContent:'Primero',dataset:{previewEdit:'experience.0.title',previewKind:'text'},style:{},classList:{add(){},remove(){},toggle(){}},blur(){},contentEditable:'false'};
  paper.querySelectorAll=sel=>sel==='[data-preview-edit]'?[editable]:sel==='[data-preview-drag]'?[handle]:[];
  await import(`../src/app.js?qa=edit-to-drag-${Date.now()}`);
  let html=paper.innerHTML,writes=0;Object.defineProperty(paper,'innerHTML',{configurable:true,get(){return html},set(v){writes++;html=v}});
  editable.onfocus();editable.innerText='Puesto editado justo antes del drag';editable.textContent=editable.innerText;editable.onblur({relatedTarget:handle});
  assert.equal(writes,0,'el blur hacia el grip no debe reconstruir el papel antes del drag');
  assert.equal(JSON.parse(storageValues[key]).documents[0].resume.experience[0].title,'Puesto editado justo antes del drag');
  const dt={setData(){},setDragImage(){}};handle.ondragstart({stopPropagation(){},dataTransfer:dt});paper.ondragover({target,clientY:90,preventDefault(){},dataTransfer:dt});paper.ondrop({target,clientY:90,preventDefault(){},stopPropagation(){}});
  assert.deepEqual(JSON.parse(storageValues[key]).documents[0].resume.experience.map(x=>x.title),['Segundo','Puesto editado justo antes del drag']);
});

test('v40 drag directo: arrastrar desde el cuerpo del bloque reordena sin usar el grip',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'body_a',title:'Primero'},{...structuredClone(r.experience[0]),id:'body_b',title:'Segundo'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper'),listeners=new Map();
  globalThis.document.addEventListener=(type,fn)=>listeners.set(type,fn);globalThis.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
  const target={dataset:{previewDragTarget:'item|experience|1'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  const source={dataset:{previewDragTarget:'item|experience|0'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,contains(){return false}};
  globalThis.document.elementFromPoint=()=>target;paper.querySelectorAll=()=>[];
  await import(`../src/app.js?qa=v40-body-drag-${Date.now()}`);
  assert.equal(typeof paper.onpointerdown,'function');
  paper.onpointerdown({target:source,pointerId:7,pointerType:'mouse',button:0,clientX:10,clientY:10});
  listeners.get('pointermove')?.({pointerId:7,pointerType:'mouse',clientX:30,clientY:90,target,preventDefault(){}});
  listeners.get('pointerup')?.({pointerId:7});
  const saved=JSON.parse(storageValues[key]);assert.deepEqual(saved.documents[0].resume.experience.map(x=>x.title),['Segundo','Primero']);
});

test('v40 drag directo: un clic o micro-movimiento no inicia drag ni crea historial',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'click_a',title:'A'},{...structuredClone(r.experience[0]),id:'click_b',title:'B'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})},initial=store[key];
  const {get,storageValues}=installDom(store),paper=get('#resumePaper'),listeners=new Map();
  globalThis.document.addEventListener=(type,fn)=>listeners.set(type,fn);globalThis.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
  const source={dataset:{previewDragTarget:'item|experience|0'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,contains(){return false}};paper.querySelectorAll=()=>[];
  await import(`../src/app.js?qa=v40-click-no-drag-${Date.now()}`);
  paper.onpointerdown({target:source,pointerId:8,pointerType:'mouse',button:0,clientX:10,clientY:10});
  listeners.get('pointermove')?.({pointerId:8,pointerType:'mouse',clientX:13,clientY:12,target:source,preventDefault(){}});
  listeners.get('pointerup')?.({pointerId:8});
  assert.equal(storageValues[key],initial);assert.equal(get('#previewUndoBtn').disabled,true);
});

test('v40 drag directo: editar o seleccionar texto no inicia drag accidental',async()=>{
  const key='hoja-personal-v48',r=defaultResume();const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper'),listeners=new Map(),before=store[key];
  globalThis.document.addEventListener=(type,fn)=>listeners.set(type,fn);globalThis.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
  const source={dataset:{previewDragTarget:'item|experience|0'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,contains(){return true}};
  const editable={dataset:{previewEdit:'experience.0.title'},contentEditable:'true',tagName:'SPAN',parentElement:source};paper.querySelectorAll=()=>[];
  await import(`../src/app.js?qa=v40-edit-no-drag-${Date.now()}`);
  paper.onpointerdown({target:editable,pointerId:9,pointerType:'mouse',button:0,clientX:10,clientY:10});
  assert.equal(listeners.has('pointermove'),false,'un contenteditable no debe armar drag del bloque');assert.equal(storageValues[key],before);
});

test('v40 drag directo touch: requiere intención antes de mover el bloque',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'touch_a',title:'A'},{...structuredClone(r.experience[0]),id:'touch_b',title:'B'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper'),listeners=new Map();
  globalThis.document.addEventListener=(type,fn)=>listeners.set(type,fn);globalThis.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
  const target={dataset:{previewDragTarget:'item|experience|1'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  const source={dataset:{previewDragTarget:'item|experience|0'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,contains(){return false}};
  globalThis.document.elementFromPoint=()=>target;paper.querySelectorAll=()=>[];
  await import(`../src/app.js?qa=v40-touch-body-${Date.now()}`);
  paper.onpointerdown({target:source,pointerId:12,pointerType:'touch',button:0,clientX:10,clientY:10});
  listeners.get('pointermove')?.({pointerId:12,pointerType:'touch',clientX:30,clientY:90,target,preventDefault(){}});
  assert.deepEqual(JSON.parse(storageValues[key]).documents[0].resume.experience.map(x=>x.title),['A','B'],'mover inmediatamente debe conservar scroll/intención touch');
  await new Promise(r=>setTimeout(r,190));
  listeners.get('pointermove')?.({pointerId:12,pointerType:'touch',clientX:30,clientY:90,target,preventDefault(){}});
  listeners.get('pointerup')?.({pointerId:12});
  assert.deepEqual(JSON.parse(storageValues[key]).documents[0].resume.experience.map(x=>x.title),['B','A']);
});

test('v40 drag directo: editar y arrastrar el bloque inmediatamente no reconstruye la preview a mitad del gesto',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'direct_edit_a',title:'Primero'},{...structuredClone(r.experience[0]),id:'direct_edit_b',title:'Segundo'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper'),listeners=new Map();
  globalThis.document.addEventListener=(type,fn)=>listeners.set(type,fn);globalThis.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
  const source={dataset:{previewDragTarget:'item|experience|0'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,contains(){return false}};
  const target={dataset:{previewDragTarget:'item|experience|1'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:0,height:100}}};
  const editable={innerText:'Primero',textContent:'Primero',dataset:{previewEdit:'experience.0.title',previewKind:'text'},style:{},classList:{add(){},remove(){},toggle(){}},blur(){},contentEditable:'false',tagName:'SPAN',parentElement:source};
  paper.querySelectorAll=sel=>sel==='[data-preview-edit]'?[editable]:[];globalThis.document.elementFromPoint=()=>target;
  await import(`../src/app.js?qa=v40-edit-body-drag-${Date.now()}`);
  let html=paper.innerHTML,writes=0;Object.defineProperty(paper,'innerHTML',{configurable:true,get(){return html},set(v){writes++;html=v}});
  editable.onfocus();editable.innerText='Editado y movido';editable.textContent=editable.innerText;
  paper.onpointerdown({target:source,pointerId:21,pointerType:'mouse',button:0,clientX:10,clientY:10});
  editable.onblur({relatedTarget:null});
  assert.equal(writes,0,'el blur durante un drag directo pendiente no debe reconstruir la preview');
  assert.equal(JSON.parse(storageValues[key]).documents[0].resume.experience[0].title,'Editado y movido');
  listeners.get('pointermove')?.({pointerId:21,pointerType:'mouse',clientX:30,clientY:90,target,preventDefault(){}});listeners.get('pointerup')?.({pointerId:21});
  assert.deepEqual(JSON.parse(storageValues[key]).documents[0].resume.experience.map(x=>x.title),['Segundo','Editado y movido']);
});

test('v40 drag directo: una sección completa cambia de columna arrastrando su cuerpo, sin grip',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.settings.layout='dual';r.settings.sectionColumns={experience:'main',skills:'side'};
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper'),listeners=new Map();
  globalThis.document.addEventListener=(type,fn)=>listeners.set(type,fn);globalThis.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
  const main={dataset:{previewDropColumn:'main'},classList:{contains:c=>c==='resume-col-main'},parentElement:paper};
  const side={dataset:{previewDropColumn:'side'},classList:{contains:c=>c==='resume-col-side'},parentElement:paper};
  const source={dataset:{previewDragTarget:'section|experience'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:main,contains(){return false}};
  const target={dataset:{previewDragTarget:'section|skills'},tagName:'DIV',classList:{add(){},remove(){},contains(){return false}},parentElement:side,getBoundingClientRect(){return{top:0,height:100}}};
  paper.querySelectorAll=()=>[];globalThis.document.elementFromPoint=()=>target;
  await import(`../src/app.js?qa=v40-section-body-drag-${Date.now()}`);
  paper.onpointerdown({target:source,pointerId:30,pointerType:'mouse',button:0,clientX:10,clientY:10});
  listeners.get('pointermove')?.({pointerId:30,pointerType:'mouse',clientX:30,clientY:90,target,preventDefault(){}});listeners.get('pointerup')?.({pointerId:30});
  const saved=JSON.parse(storageValues[key]).documents[0].resume;assert.equal(saved.settings.sectionColumns.experience,'side');assert.ok(saved.settings.sectionOrder.indexOf('experience')>saved.settings.sectionOrder.indexOf('skills'));
});

test('v41 UI/UX: teclado puede reordenar un bloque con Alt+flecha y conserva persistencia',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'kbd_a',title:'A'},{...structuredClone(r.experience[0]),id:'kbd_b',title:'B'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get,storageValues}=installDom(store),paper=get('#resumePaper');
  const classes=new Set(),node={dataset:{previewDragTarget:'item|experience|0'},tagName:'DIV',classList:{add(...xs){xs.forEach(x=>classes.add(x))},remove(...xs){xs.forEach(x=>classes.delete(x))}},parentElement:paper,querySelector(){return null},blur(){}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag-target]'?[node]:sel==='.preview-drag-selected'?(classes.has('preview-drag-selected')?[node]:[]):[];
  await import(`../src/app.js?qa=v41-keyboard-reorder-${Date.now()}`);
  node.onfocus();assert.equal(classes.has('preview-drag-selected'),true);
  node.onkeydown({key:'ArrowDown',altKey:true,preventDefault(){}});
  assert.deepEqual(JSON.parse(storageValues[key]).documents[0].resume.experience.map(x=>x.title),['B','A']);
});

test('v41 UI/UX: autoscroll continúa aunque el puntero quede quieto en el borde',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'scroll_a',title:'A'},{...structuredClone(r.experience[0]),id:'scroll_b',title:'B'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get}=installDom(store),paper=get('#resumePaper');
  const pane={scrollTop:100,scrollHeight:2000,clientHeight:500,getBoundingClientRect(){return{top:0,bottom:500,height:500}}};paper.closest=sel=>sel==='.preview-pane'?pane:null;
  const sourceNode={dataset:{previewDragTarget:'item|experience|0'},classList:{add(){},remove(){}},parentElement:paper};
  const handle={dataset:{previewDrag:'item|experience|0'},style:{},classList:{add(){},remove(){}},closest(){return sourceNode}};
  const target={dataset:{previewDragTarget:'item|experience|1'},classList:{add(){},remove(){}},parentElement:paper,getBoundingClientRect(){return{top:300,height:100}}};
  paper.querySelectorAll=sel=>sel==='[data-preview-drag]'?[handle]:[];globalThis.document.elementFromPoint=()=>target;
  await import(`../src/app.js?qa=v41-continuous-autoscroll-${Date.now()}`);
  const dt={setData(){},setDragImage(){}};handle.ondragstart({stopPropagation(){},dataTransfer:dt,clientX:10,clientY:495});paper.ondragover({target,clientX:10,clientY:495,preventDefault(){},dataTransfer:dt});
  const immediate=pane.scrollTop;await new Promise(r=>setTimeout(r,130));const later=pane.scrollTop;handle.ondragend();
  assert.ok(immediate>100);assert.ok(later>immediate,`autoscroll continuo esperado > ${immediate}, recibido ${later}`);
});

test('v41 UI/UX: un rerender cancela un drag directo pendiente y limpia listeners',async()=>{
  const key='hoja-personal-v48',r=defaultResume();r.experience=[{...r.experience[0],id:'cancel_a',title:'A'},{...structuredClone(r.experience[0]),id:'cancel_b',title:'B'}];
  const store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const {get}=installDom(store),paper=get('#resumePaper'),listeners=new Map();
  globalThis.document.addEventListener=(type,fn)=>listeners.set(type,fn);globalThis.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
  const source={dataset:{previewDragTarget:'item|experience|0'},tagName:'DIV',classList:{add(){},remove(){}},parentElement:paper,contains(){return false}};paper.querySelectorAll=()=>[];
  await import(`../src/app.js?qa=v41-rerender-cancel-${Date.now()}`);
  paper.onpointerdown({target:source,pointerId:41,pointerType:'mouse',button:0,clientX:10,clientY:10});assert.equal(listeners.has('pointermove'),true);
  get('#zoomIn').onclick();
  assert.equal(listeners.has('pointermove'),false);assert.equal(listeners.has('pointerup'),false);assert.equal(listeners.has('pointercancel'),false);
});

test('v43 QA: reemplazar contenido con IA conserva foto, vacante, Workbench y locale del CV actual',async()=>{
  const original=defaultResume();original.id='resume_keep';original.title='Original';original.basics.photo='data:image/jpeg;base64,QUJD';original.locale={language:'en',country:'US'};
  original.target={role:'QA Engineer',company:'Acme',text:'QA Engineer role with automation testing requirements and quality ownership.',raw:'QA Engineer role with automation testing requirements and quality ownership.',requirements:[],skills:[],parsedAt:1};
  original.workbench.releaseHistory=[{id:'release_keep',label:'Release anterior',createdAt:1,profileId:null,targetRole:'QA Engineer',templateId:'ats-ink',gate:{status:'READY',score:90,metrics:{ats:90,jobMatch:80,pages:1,writing:90,visualRisk:'low',integrity:100}},factHash:'abc'}];
  const key='hoja-personal-v48',store={[key]:JSON.stringify({documents:[{id:'resume_keep',name:'Original',resume:original}],currentId:'resume_keep',jobText:''})};
  const oldFetch=globalThis.fetch;globalThis.fetch=async(url)=>{
    if(String(url).includes('/api/local-ai/status'))return{json:async()=>({available:true,models:[{name:'local-model'}]})};
    if(String(url).includes('/api/local-ai/build-resume'))return{ok:true,json:async()=>({model:'local-model',sourceKind:'prompt',sourceConfidence:80,warnings:[],resume:{title:'Nuevo IA',basics:{fullName:'Ana Nueva',headline:'QA',email:'',phone:'',location:'',linkedin:'',website:''},summary:'Perfil nuevo',experience:[],education:[],skillGroups:[],projects:[],certifications:[],languages:[],achievements:[]}})};
    throw new Error('fetch inesperado '+url);
  };
  try{
    const {get,storageValues}=installDom(store);await import(`../src/app.js?smoke=v43-ai-replace-preserve-${Date.now()}`);
    get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'aicreator'}})}});await get('#aiBuilderDetect').onclick();
    get('#aiCreatePrompt').value='Ana tiene experiencia en QA';get('#aiCreateModel').value='local-model';get('#aiCreateTemplate').value='ats-ink';await get('#aiCreateBtn').onclick();
    get('#aiCreateTitle').value='Nuevo IA';get('#aiReplaceCurrent').onclick();
    const saved=JSON.parse(storageValues[key]).documents[0].resume;
    assert.equal(saved.basics.photo,'data:image/jpeg;base64,QUJD');assert.equal(saved.target.role,'QA Engineer');assert.equal(saved.workbench.releaseHistory[0].label,'Release anterior');assert.deepEqual(saved.locale,{language:'en',country:'US'});assert.equal(saved.basics.fullName,'Ana Nueva');
  }finally{globalThis.fetch=oldFetch}
});

test('v43 QA: el archivo elegido para Crear con IA sobrevive a un re-render del panel',async()=>{
  const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({json:async()=>({available:true,models:[{name:'local-model'}]})});
  try{
    const {get}=installDom();await import(`../src/app.js?smoke=v43-ai-file-retain-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'aicreator'}})}});await get('#aiBuilderDetect').onclick();
    const fake={name:'cv-antiguo.pdf',type:'application/pdf',size:2048};get('#aiCreateFile').onchange({target:{files:[fake]}});assert.match(get('#aicreator').innerHTML,/cv-antiguo\.pdf/);assert.match(get('#aicreator').innerHTML,/Quitar/);
  }finally{globalThis.fetch=oldFetch}
});

test('v43 QA UX: selección de modelo Ollama sobrevive al re-render por archivo retenido',async()=>{
  const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({json:async()=>({available:true,models:[{name:'modelo-a'},{name:'vision-b'}]})});
  try{
    const {get}=installDom();await import(`../src/app.js?smoke=v43-ai-model-retain-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'aicreator'}})}});await get('#aiBuilderDetect').onclick();
    get('#aiCreateModel').value='vision-b';get('#aiCreateModel').onchange({target:{value:'vision-b'}});get('#aiCreateFile').onchange({target:{files:[{name:'scan.jpg',type:'image/jpeg',size:1000}]}});
    assert.match(get('#aicreator').innerHTML,/option value="vision-b" selected/);
  }finally{globalThis.fetch=oldFetch}
});

test('v43 QA UX: título editado del borrador IA sobrevive a Actualizar Ollama',async()=>{
  const oldFetch=globalThis.fetch;globalThis.fetch=async(url)=>{
    if(String(url).includes('/api/local-ai/status'))return{json:async()=>({available:true,models:[{name:'local-model'}]})};
    return{ok:true,json:async()=>({model:'local-model',sourceKind:'prompt',sourceConfidence:70,warnings:[],resume:{title:'Título inicial',basics:{fullName:'Ana',headline:'QA',email:'',phone:'',location:'',linkedin:'',website:''},summary:'Perfil',experience:[],education:[],skillGroups:[],projects:[],certifications:[],languages:[],achievements:[]}})};
  };
  try{
    const {get}=installDom();await import(`../src/app.js?smoke=v43-ai-title-retain-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'aicreator'}})}});await get('#aiBuilderDetect').onclick();
    get('#aiCreatePrompt').value='Ana trabaja en QA';get('#aiCreateModel').value='local-model';await get('#aiCreateBtn').onclick();get('#aiCreateTitle').oninput({target:{value:'Mi CV definitivo'}});await get('#aiBuilderDetect').onclick();
    assert.match(get('#aicreator').innerHTML,/value="Mi CV definitivo"/);
  }finally{globalThis.fetch=oldFetch}
});

test('v46 migra biblioteca v45 conservando datos, foto y workspace',async()=>{
  const r=defaultResume();r.title='CV v43 real';r.basics.photo='data:image/jpeg;base64,QUJD';r.target={role:'QA',company:'Empresa',description:'Vacante QA',requirements:[]};r.workbench={...r.workbench,gatePolicy:{minAts:82,minJobMatch:61,maxPages:2,minWriting:66}};
  const store={'hoja-personal-v45':JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:'Vacante QA'})};
  const {get,storageValues}=installDom(store);await import(`../src/app.js?smoke=v46-migrate-v45-${Date.now()}`);
  assert.match(get('#home').innerHTML,/CV v43 real/);get('#docTitle').oninput({target:{value:'CV migrado v46'}});await new Promise(res=>setTimeout(res,230));
  const saved=JSON.parse(storageValues['hoja-personal-v48']),resume=saved.documents[0].resume;assert.equal(resume.title,'CV migrado v46');assert.equal(resume.basics.photo,'data:image/jpeg;base64,QUJD');assert.equal(resume.target.role,'QA');assert.equal(resume.workbench.gatePolicy.minAts,82);assert.equal(resume.workbench.gatePolicy.minJobMatch,61);assert.equal(resume.schemaVersion,9);
});

test('v45 QA multi-pestaña bloquea autosave si localStorage ya contiene una versión más nueva',async()=>{
  const r=defaultResume();r.id='resume_conflict_ui';r.title='Base';r.updatedAt=100;
  const initial={documents:[{id:'doc_conflict',name:'Base',resume:r,updatedAt:100}],currentId:'doc_conflict',jobText:''};
  const store={'hoja-personal-v48':JSON.stringify(initial)};const {get,storageValues}=installDom(store);
  await import(`../src/app.js?smoke=v45-conflict-${Date.now()}`);
  const remote=structuredClone(initial);remote.documents[0].name='Guardado remoto';remote.documents[0].resume.title='Guardado remoto';remote.documents[0].updatedAt=5000;remote.documents[0].resume.updatedAt=5000;storageValues['hoja-personal-v48']=JSON.stringify(remote);
  get('#docTitle').oninput({target:{value:'Edición local que no debe pisar'}});await new Promise(r=>setTimeout(r,230));
  const persisted=JSON.parse(storageValues['hoja-personal-v48']);assert.equal(persisted.documents[0].resume.title,'Guardado remoto');assert.match(get('#saveState').textContent,/bloqueado|conflicto/i);
});


test('v48 UI conflictos: Conservar ambos recupera la edición local sin borrar cambios remotos',async()=>{
  const base=defaultResume();base.id='resume_conflict_fork';base.title='Base';base.updatedAt=100;
  const other=defaultResume();other.id='resume_other_remote';other.title='Otro';other.updatedAt=100;
  const initial={documents:[{id:'doc_conflict_fork',name:'Base',resume:base,updatedAt:100},{id:'doc_other_remote',name:'Otro',resume:other,updatedAt:100}],currentId:'doc_conflict_fork',jobText:'vacante remota'};
  const store={'hoja-personal-v48':JSON.stringify(initial)};const {get,storageValues}=installDom(store);await import(`../src/app.js?smoke=v48-conflict-fork-${Date.now()}`);
  const remote=structuredClone(initial);remote.documents[0].name='Versión remota';remote.documents[0].resume.title='Versión remota';remote.documents[0].updatedAt=5000;remote.documents[0].resume.updatedAt=5000;remote.documents[1].resume.summary='Cambio remoto que debe sobrevivir';remote.documents[1].updatedAt=5100;remote.documents[1].resume.updatedAt=5100;storageValues['hoja-personal-v48']=JSON.stringify(remote);
  get('#docTitle').oninput({target:{value:'Mi edición en conflicto'}});await new Promise(r=>setTimeout(r,230));assert.match(get('#saveState').textContent,/bloqueado|conflicto/i);
  get('#tabConflictFork').onclick();await new Promise(r=>setTimeout(r,25));
  const persisted=JSON.parse(storageValues['hoja-personal-v48']);assert.equal(persisted.documents.length,3);assert.equal(persisted.documents[0].resume.title,'Versión remota');assert.equal(persisted.documents[1].resume.summary,'Cambio remoto que debe sobrevivir');const copy=persisted.documents.find(d=>/copia recuperada/i.test(d.resume.title));assert.ok(copy);assert.match(copy.resume.title,/Mi edición en conflicto/);assert.notEqual(copy.resume.id,'resume_conflict_fork');assert.doesNotMatch(get('#saveState').textContent,/bloqueado|conflicto/i);
});


test('v46 QA durable: IndexedDB autoritativo recupera biblioteca y elimina la copia completa local',async()=>{
  const durable=defaultResume();durable.id='resume_durable_qa';durable.title='Recuperado durable';durable.updatedAt=9000;
  const durableState={documents:[{id:'doc_durable_qa',name:durable.title,resume:durable,updatedAt:9000}],currentId:'doc_durable_qa',jobText:''};
  let storedEnvelope={savedAt:9000,state:durableState};
  const db={objectStoreNames:{contains(){return true}},close(){},transaction(){const tx={oncomplete:null,onerror:null,onabort:null};tx.objectStore=()=>({get(){const req={};queueMicrotask(()=>{req.result=storedEnvelope;req.onsuccess?.()});return req},put(v){storedEnvelope=v;queueMicrotask(()=>tx.oncomplete?.())},delete(){storedEnvelope=null;queueMicrotask(()=>tx.oncomplete?.())}});return tx}};
  const fakeIndexedDb={open(){const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req}};
  const oldIndexedDb=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fakeIndexedDb,configurable:true});
  try{
    const {get,storageValues}=installDom({'hoja-personal-v48':'{corrupt-json'});await import(`../src/app.js?smoke=v45-durable-recover-${Date.now()}`);await new Promise(r=>setTimeout(r,30));
    assert.match(get('#home').innerHTML,/Recuperado durable/);assert.equal(storageValues['hoja-personal-v48'],undefined);assert.ok(storageValues['hoja-personal-v48-sync-index']);assert.equal(storedEnvelope.state.documents[0].resume.title,'Recuperado durable');
  }finally{Object.defineProperty(globalThis,'indexedDB',{value:oldIndexedDb,configurable:true})}
});

test('v45 QA Maestro: eliminar un Maestro no deja variantes huérfanas',async()=>{
  const master=defaultResume();master.id='master_delete_qa';master.title='Maestro QA';master.careerPack={role:'master',masterResumeId:master.id,masterTitle:master.title,variantLabel:'',masterRevision:100,linkedAt:1,lastSyncedAt:1};
  const variant=structuredClone(master);variant.id='variant_delete_qa';variant.title='Variante QA';variant.careerPack={role:'variant',masterResumeId:master.id,masterTitle:master.title,variantLabel:variant.title,masterRevision:100,linkedAt:2,lastSyncedAt:2};
  const key='hoja-personal-v48',store={[key]:JSON.stringify({documents:[{id:'doc_master',name:master.title,resume:master,updatedAt:100},{id:'doc_variant',name:variant.title,resume:variant,updatedAt:100}],currentId:'doc_master',jobText:''})};
  const {get,storageValues}=installDom(store);await import(`../src/app.js?smoke=v45-master-delete-${Date.now()}`);
  const deleteBtn={dataset:{home:'delete',id:'doc_master'}};get('#home').querySelectorAll=()=>[]; // no-op: handlers already bound by document queryAll mock in this harness
  const homeDelete=get('[data-home="delete"]');
  // Invoke the delegated handler by re-rendering with a queryAll that returns the target button.
  globalThis.document.querySelectorAll=sel=>sel==='[data-home]'?[{dataset:{home:'delete',id:'doc_master'},onclick:null}]:[];
  // renderHome is private; opening Home through nav causes handlers to bind to the synthetic delete button.
  get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'home'}})}});const synthetic=globalThis.document.querySelectorAll('[data-home]')[0];
  // querySelectorAll above returns a fresh object, so use a stable button for binding.
  const stable={dataset:{home:'delete',id:'doc_master'},onclick:null};globalThis.document.querySelectorAll=sel=>sel==='[data-home]'?[stable]:[];get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'home'}})}});stable.onclick();
  const saved=JSON.parse(storageValues[key]);assert.equal(saved.documents.length,1);assert.equal(saved.documents[0].resume.id,'variant_delete_qa');assert.equal(saved.documents[0].resume.careerPack.role,'standalone');assert.equal(saved.documents[0].resume.careerPack.masterResumeId,'');
});

function installFakeDurableDb({initial=null,failWrites=false}={}){
  let stored=initial;
  const db={objectStoreNames:{contains(){return true}},close(){},transaction(){
    const tx={oncomplete:null,onerror:null,onabort:null};
    const store={get(){const req={};queueMicrotask(()=>{req.result=stored;req.onsuccess?.()});return req},put(v){if(failWrites){queueMicrotask(()=>tx.onerror?.());return}stored=structuredClone(v)},delete(){stored=null}};
    tx.objectStore=()=>store;setTimeout(()=>{if(!failWrites)tx.oncomplete?.()},3);return tx;
  }};
  const fake={open(){const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req}};
  return{fake,getStored:()=>stored};
}

test('v46 migración durable: biblioteca v45 válida pasa a IndexedDB y libera la copia completa local',async()=>{
  const r=defaultResume();r.id='resume_v45_to_v46';r.title='Biblioteca heredada v45';r.updatedAt=3000;
  const legacy={documents:[{id:'doc_legacy',name:r.title,resume:r,updatedAt:3000}],currentId:'doc_legacy',jobText:'Vacante heredada'};
  const {fake,getStored}=installFakeDurableDb(),oldIndexedDb=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fake,configurable:true});
  try{
    const {get,storageValues}=installDom({'hoja-personal-v45':JSON.stringify(legacy)});await import(`../src/app.js?smoke=v46-primary-migrate-${Date.now()}`);await new Promise(res=>setTimeout(res,35));
    assert.match(get('#home').innerHTML,/Biblioteca heredada v45/);assert.equal(storageValues['hoja-personal-v45'],undefined);assert.equal(storageValues['hoja-personal-v48-journal'],undefined);assert.ok(storageValues['hoja-personal-v48-sync-index']);
    const durable=getStored();assert.equal(durable.schema,2);assert.ok(durable.revision>=1);assert.equal(durable.state.documents[0].resume.title,'Biblioteca heredada v45');
  }finally{Object.defineProperty(globalThis,'indexedDB',{value:oldIndexedDb,configurable:true})}
});

test('v46 arranque durable: una revisión IndexedDB más nueva gana sobre una biblioteca local válida',async()=>{
  const local=defaultResume();local.id='same_resume';local.title='Local antigua';local.updatedAt=100;
  const durable=structuredClone(local);durable.title='Durable nueva';durable.updatedAt=9000;
  const localState={documents:[{id:'doc_same',name:local.title,resume:local,updatedAt:100}],currentId:'doc_same',jobText:''};
  const durableState={documents:[{id:'doc_same',name:durable.title,resume:durable,updatedAt:9000}],currentId:'doc_same',jobText:''};
  const envelope={schema:2,revision:7,savedAt:9000,appVersion:'46.0.0-personal',state:durableState};
  // Leave digest absent intentionally: compatible envelopes from prior v46 prerelease snapshots remain readable.
  const {fake}=installFakeDurableDb({initial:envelope}),oldIndexedDb=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fake,configurable:true});
  try{
    const {get,storageValues}=installDom({'hoja-personal-v45':JSON.stringify(localState)});await import(`../src/app.js?smoke=v46-durable-wins-${Date.now()}`);await new Promise(res=>setTimeout(res,35));
    assert.match(get('#home').innerHTML,/Durable nueva/);assert.doesNotMatch(get('#home').innerHTML,/Local antigua/);assert.equal(storageValues['hoja-personal-v45'],undefined);
  }finally{Object.defineProperty(globalThis,'indexedDB',{value:oldIndexedDb,configurable:true})}
});

test('v46 recovery journal: si IndexedDB falla, el cambio completo permanece en journal para el siguiente arranque',async()=>{
  const r=defaultResume();r.id='journal_resume';r.title='Antes';r.updatedAt=100;const legacy={documents:[{id:'journal_doc',name:'Antes',resume:r,updatedAt:100}],currentId:'journal_doc',jobText:''};
  const {fake}=installFakeDurableDb({failWrites:true}),oldIndexedDb=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fake,configurable:true});
  try{
    const {get,storageValues}=installDom({'hoja-personal-v45':JSON.stringify(legacy)});await import(`../src/app.js?smoke=v46-journal-fallback-${Date.now()}`);await new Promise(res=>setTimeout(res,25));
    get('#docTitle').oninput({target:{value:'Cambio protegido por journal'}});await new Promise(res=>setTimeout(res,260));await new Promise(res=>setTimeout(res,15));
    const journalKey=Object.keys(storageValues).find(k=>k.startsWith('hoja-personal-v48-journal-'));assert.ok(journalKey,'debe existir journal aislado por pestaña');const journal=JSON.parse(storageValues[journalKey]);assert.equal(journal.documents[0].resume.title,'Cambio protegido por journal');assert.match(get('#saveState').textContent,/temporal|pendiente|durable/i);
  }finally{Object.defineProperty(globalThis,'indexedDB',{value:oldIndexedDb,configurable:true})}
});

test('v48 QA fallback: editar CV A no pisa un cambio remoto más nuevo en CV B',async()=>{
  const a=defaultResume(),b=defaultResume();a.id='fallback_a';b.id='fallback_b';a.title='A local';b.title='B base';a.updatedAt=100;b.updatedAt=100;
  const initial={documents:[{id:'doc_a',name:a.title,resume:a,updatedAt:100},{id:'doc_b',name:b.title,resume:b,updatedAt:100}],currentId:'doc_a',jobText:''};
  const {get,storageValues}=installDom({'hoja-personal-v48':JSON.stringify(initial)});await import(`../src/app.js?smoke=v48-fallback-cross-doc-${Date.now()}`);
  const remote=structuredClone(initial);remote.documents[1].name='B remoto';remote.documents[1].resume.title='B remoto';remote.documents[1].updatedAt=5000;remote.documents[1].resume.updatedAt=5000;storageValues['hoja-personal-v48']=JSON.stringify(remote);
  get('#docTitle').oninput({target:{value:'A edición que no debe pisar B'}});await new Promise(r=>setTimeout(r,240));
  const persisted=JSON.parse(storageValues['hoja-personal-v48']);assert.equal(persisted.documents[1].resume.title,'B remoto');assert.equal(persisted.documents[0].resume.title,'A local');assert.match(get('#saveState').textContent,/bloqueado|conflicto/i);
});

test('v48 QA migración: journal pendiente de v47 más nuevo que IndexedDB se recupera antes de limpiar legacy',async()=>{
  const durableResume=defaultResume();durableResume.id='migration_resume';durableResume.title='Durable anterior';durableResume.updatedAt=5000;
  const durableState={documents:[{id:'migration_doc',name:'Durable anterior',resume:durableResume,updatedAt:5000}],currentId:'migration_doc',jobText:''};
  const durableEnvelope={schema:2,revision:10,savedAt:5000,appVersion:'47.0.0-personal',state:durableState};
  const pending=structuredClone(durableState);pending.documents[0].name='Cambio pendiente v47';pending.documents[0].resume.title='Cambio pendiente v47';pending.documents[0].updatedAt=9000;pending.documents[0].resume.updatedAt=9000;
  const {fake,getStored}=installFakeDurableDb({initial:durableEnvelope}),oldIndexedDb=globalThis.indexedDB;Object.defineProperty(globalThis,'indexedDB',{value:fake,configurable:true});
  try{
    const {get,storageValues}=installDom({'hoja-personal-v47-journal':JSON.stringify(pending)});await import(`../src/app.js?smoke=v48-legacy-journal-recovery-${Date.now()}`);await new Promise(r=>setTimeout(r,45));
    assert.match(get('#home').innerHTML,/Cambio pendiente v47/);const stored=getStored();assert.equal(stored.state.documents[0].resume.title,'Cambio pendiente v47');assert.ok(stored.revision>10);assert.equal(storageValues['hoja-personal-v47-journal'],undefined);
  }finally{Object.defineProperty(globalThis,'indexedDB',{value:oldIndexedDb,configurable:true})}
});


test('QA final: PDF directo fallido no crea Release fantasma',async()=>{
  const r=defaultResume(),key='hoja-personal-v48',store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const oldFetch=globalThis.fetch;globalThis.fetch=async url=>String(url).includes('/api/export-pdf')?{ok:false,status:503,json:async()=>({error:'fallo QA'})}:{ok:true,json:async()=>({})};
  try{const {get,storageValues}=installDom(store);await import(`../src/app.js?smoke=pdf-direct-fail-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});await get('#directPdfBtn').onclick();const saved=JSON.parse(storageValues[key]);assert.equal(saved.documents[0].resume.workbench.releaseHistory.length,0);assert.match(get('#toast').textContent,/PDF directo no disponible|fallo QA/i)}finally{globalThis.fetch=oldFetch}
});

test('QA final: PDF directo rechaza MIME incorrecto aunque el archivo sea grande',async()=>{
  const r=defaultResume(),key='hoja-personal-v48',store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const oldFetch=globalThis.fetch;globalThis.fetch=async url=>String(url).includes('/api/export-pdf')?{ok:true,status:200,blob:async()=>new Blob([new Uint8Array(2200)],{type:'text/plain'})}:{ok:true,json:async()=>({})};
  try{const {get,storageValues,getLastBlob}=installDom(store);await import(`../src/app.js?smoke=pdf-direct-mime-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});await get('#directPdfBtn').onclick();const saved=JSON.parse(storageValues[key]);assert.equal(saved.documents[0].resume.workbench.releaseHistory.length,0);assert.equal(getLastBlob(),null);assert.match(get('#toast').textContent,/archivo inválido|archivo inv.lido/i)}finally{globalThis.fetch=oldFetch}
});

test('QA final: PDF directo exitoso registra Release sólo después de descargar',async()=>{
  const r=defaultResume(),key='hoja-personal-v48',store={[key]:JSON.stringify({documents:[{id:r.id,name:r.title,resume:r}],currentId:r.id,jobText:''})};
  const oldFetch=globalThis.fetch;globalThis.fetch=async url=>String(url).includes('/api/export-pdf')?{ok:true,status:200,blob:async()=>new Blob([new Uint8Array(2200)],{type:'application/pdf'})}:{ok:true,json:async()=>({})};
  try{const {get,storageValues,getLastBlob}=installDom(store);await import(`../src/app.js?smoke=pdf-direct-success-${Date.now()}`);get('#mainNav').onclick({target:{closest:()=>({dataset:{view:'export'}})}});await get('#directPdfBtn').onclick();const saved=JSON.parse(storageValues[key]),releases=saved.documents[0].resume.workbench.releaseHistory;assert.ok(getLastBlob());assert.equal(releases.length,1);assert.match(releases[0].label,/PDF DIRECT/);assert.match(releases[0].releaseHash,/^[0-9a-f]{8}$/)}finally{globalThis.fetch=oldFetch}
});
