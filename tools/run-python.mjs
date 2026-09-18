#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const requested=process.argv.slice(2);
if(!requested.length){
  console.error('Uso: node tools/run-python.mjs <args de Python>');
  process.exit(2);
}

const candidates=process.platform==='win32'
  ? [['py',['-3.14']],['py',['-3']],['python3',[]],['python',[]]]
  : [['python3',[]],['python',[]]];

function probe(command,prefix){
  const check=spawnSync(command,[...prefix,'-c','import os,sys;print(sys.executable);raise SystemExit(0 if sys.version_info >= (3,10) else 3)'],{
    cwd:root,
    encoding:'utf8',
    windowsHide:true
  });
  if(check.status!==0)return null;
  const executable=String(check.stdout||'').trim();
  if(!executable)return null;
  const normalized=resolve(executable).toLowerCase();
  const localRuntime=resolve(root,'Python').toLowerCase()+sep.toLowerCase();
  if(normalized.startsWith(localRuntime))return null;
  return{command,prefix,executable};
}

let selected=null;
for(const [command,prefix] of candidates){
  selected=probe(command,prefix);
  if(selected)break;
}
if(!selected){
  console.error('Python 3.10+ no está disponible fuera del runtime local ignorado del repositorio.');
  process.exit(1);
}

const child=spawnSync(selected.command,[...selected.prefix,...requested],{
  cwd:root,
  stdio:'inherit',
  windowsHide:false
});
if(child.error){
  console.error(child.error.message);
  process.exit(1);
}
process.exit(child.status??1);
