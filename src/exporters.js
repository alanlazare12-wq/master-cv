import {atsTextView} from './ats-engine.js?v=48';

export function downloadText(resume){download(`${safe(resume.title)}.txt`,atsTextView(resume),'text/plain;charset=utf-8')}
export function downloadJSON(resume){download(`${safe(resume.title)}.json`,JSON.stringify(resume,null,2),'application/json')}
export function downloadDocx(resume){const blob=new Blob([buildDocxBytes(resume)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});triggerBlob(`${safe(resume.title)}.docx`,blob)}

export function buildDocxBytes(resume){
  const lines=atsTextView(resume).split('\n');
  const body=lines.map((line,i)=>paragraphXml(line,i)).join('');
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>`;
  const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr><w:pPr><w:spacing w:after="70" w:line="250" w:lineRule="auto"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="34"/></w:rPr><w:pPr><w:spacing w:after="80"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Section"><w:name w:val="Section"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="3F3A73"/></w:rPr><w:pPr><w:spacing w:before="180" w:after="70"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="D8D5EA"/></w:pBdr></w:pPr></w:style></w:styles>`;
  const files={
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/document.xml':documentXml,
    'word/styles.xml':stylesXml
  };
  return zipStore(files);
}
function paragraphXml(line,index){
  if(!line)return '<w:p/>';
  const isBullet=/^-\s+/.test(line),text=isBullet?line.replace(/^-\s+/,''):line;
  const isHeading=!isBullet&&text.length<42&&text===text.toUpperCase()&&/[A-ZÁÉÍÓÚÑ]/.test(text);
  const style=index===0?'Name':isHeading?'Section':'Normal';
  const bulletPr=isBullet?'<w:ind w:left="280" w:hanging="180"/>':'';
  const bulletRun=isBullet?'<w:r><w:t>• </w:t></w:r>':'';
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${bulletPr}</w:pPr>${bulletRun}<w:r><w:t xml:space="preserve">${xml(text||' ')}</w:t></w:r></w:p>`;
}
function download(name,text,type){triggerBlob(name,new Blob([text],{type}))}
function triggerBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
const safe=s=>String(s||'cv').replace(/[\\/:*?"<>|]+/g,'-').trim()||'cv';
function xmlSafeText(value){
  let out='';
  for(const ch of String(value??'')){
    const cp=ch.codePointAt(0);
    if(cp===0x9||cp===0xA||cp===0xD||(cp>=0x20&&cp<=0xD7FF)||(cp>=0xE000&&cp<=0xFFFD)||(cp>=0x10000&&cp<=0x10FFFF))out+=ch;
  }
  return out;
}
const xml=s=>xmlSafeText(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function zipStore(files){
  const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
  for(const [name,content] of Object.entries(files)){
    const n=enc.encode(name),d=enc.encode(content),crc=crc32(d),local=new Uint8Array(30+n.length+d.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0,true);v.setUint16(8,0,true);v.setUint16(10,0,true);v.setUint16(12,0,true);v.setUint32(14,crc,true);v.setUint32(18,d.length,true);v.setUint32(22,d.length,true);v.setUint16(26,n.length,true);v.setUint16(28,0,true);local.set(n,30);local.set(d,30+n.length);chunks.push(local);
    const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);cv.setUint16(10,0,true);cv.setUint16(12,0,true);cv.setUint16(14,0,true);cv.setUint32(16,crc,true);cv.setUint32(20,d.length,true);cv.setUint32(24,d.length,true);cv.setUint16(28,n.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=local.length;
  }
  const centralSize=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);return concat([...chunks,...central,end]);
}
function concat(parts){const len=parts.reduce((n,p)=>n+p.length,0),o=new Uint8Array(len);let at=0;for(const p of parts){o.set(p,at);at+=p.length}return o}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
