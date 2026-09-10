from __future__ import annotations

import io
import re
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

SECTION_ALIASES = {
    'summary': ['perfil profesional','perfil','resumen profesional','resumen','professional summary','summary','profile','objective','objetivo profesional'],
    'experience': ['experiencia profesional','experiencia laboral','experiencia','work experience','professional experience','employment','employment history','career history'],
    'education': ['educación','educacion','formación académica','formacion academica','education','academic background'],
    'skills': ['habilidades','competencias','skills','technical skills','core competencies','competencias técnicas','competencias tecnicas'],
    'projects': ['proyectos','projects','selected projects','proyectos destacados'],
    'certifications': ['certificaciones','certifications','licenses & certifications','licencias y certificaciones'],
    'languages': ['idiomas','languages'],
    'achievements': ['logros','achievements','accomplishments','awards & achievements'],
}

EMAIL_RE = re.compile(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', re.I)
PHONE_RE = re.compile(r'(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)')
URL_RE = re.compile(r'(?:(?:https?://)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:/[^\s]*)?)', re.I)
DATE_RANGE_RE = re.compile(
    r'(?P<start>(?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}|(?:19|20)\d{2})\s*'
    r'(?:[-–—]|\bto\b|\ba\b)\s*'
    r'(?P<end>(?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}|(?:19|20)\d{2}|present|current|actualidad|presente)',
    re.I,
)
BULLET_RE = re.compile(r'^\s*(?:[•●▪◦·\-*]|\d+[.)])\s+')

MAX_DOCX_ENTRIES = 2000
MAX_DOCX_TOTAL_UNCOMPRESSED = 24 * 1024 * 1024
MAX_DOCX_DOCUMENT_XML = 8 * 1024 * 1024
MAX_DOCX_COMPRESSION_RATIO = 300
MAX_PDF_PAGES = 250
MAX_EXTRACTED_TEXT_CHARS = 1_000_000


def uid(prefix: str) -> str:
    return f'{prefix}_{uuid.uuid4().hex[:12]}'


def _clean_text(text: str) -> str:
    text = text.replace('\r\n', '\n').replace('\r', '\n').replace('\x00', '')
    text = text.replace('\u2028', '\n').replace('\u2029', '\n')
    lines = []
    for raw in text.split('\n'):
        line = re.sub(r'[ \t]+', ' ', raw).strip()
        if line:
            lines.append(line)
        elif lines and lines[-1] != '':
            lines.append('')
    return '\n'.join(lines).strip()


def _extract_docx(data: bytes) -> str:
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise ValueError('El archivo DOCX no es un ZIP OpenXML válido.')
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infos = zf.infolist()
        if len(infos) > MAX_DOCX_ENTRIES:
            raise ValueError('DOCX rechazado: contiene demasiados archivos internos.')
        if sum(max(0, i.file_size) for i in infos) > MAX_DOCX_TOTAL_UNCOMPRESSED:
            raise ValueError('DOCX rechazado: tamaño descomprimido excesivo.')
        try:
            info = zf.getinfo('word/document.xml')
        except KeyError as exc:
            raise ValueError('DOCX inválido: falta word/document.xml.') from exc
        if info.file_size > MAX_DOCX_DOCUMENT_XML:
            raise ValueError('DOCX rechazado: document.xml es demasiado grande.')
        if info.compress_size > 0 and info.file_size > 1024 * 1024 and info.file_size / info.compress_size > MAX_DOCX_COMPRESSION_RATIO:
            raise ValueError('DOCX rechazado: relación de compresión sospechosa.')
        if info.flag_bits & 0x1:
            raise ValueError('DOCX cifrado no compatible.')
        xml = zf.read(info)
    root = ET.fromstring(xml)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    out = []
    for p in root.findall('.//w:p', ns):
        parts = []
        for node in p.iter():
            if node.tag == f"{{{ns['w']}}}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{{{ns['w']}}}tab":
                parts.append('\t')
        text = ''.join(parts).strip()
        if text:
            out.append(text)
    return _clean_text('\n'.join(out))


def _extract_pdf(data: bytes) -> tuple[str, int | None, str]:
    try:
        from pypdf import PdfReader  # optional dependency
        reader = PdfReader(io.BytesIO(data))
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ValueError(f'PDF demasiado largo. Máximo {MAX_PDF_PAGES} páginas.')
        pages = [(page.extract_text() or '') for page in reader.pages]
        text = _clean_text('\n'.join(pages))
        if text:
            return text, len(reader.pages), 'pypdf'
    except ValueError:
        raise
    except Exception:
        pass

    exe = shutil.which('pdftotext')
    if exe:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=True) as fh:
            fh.write(data); fh.flush()
            proc = subprocess.run([exe, '-nopgbrk', fh.name, '-'], capture_output=True, timeout=20)
            if proc.returncode == 0:
                text = _clean_text(proc.stdout.decode('utf-8', errors='replace'))
                if text:
                    return text, None, 'pdftotext'
    raise ValueError('No fue posible extraer texto del PDF. Instala pypdf o Poppler/pdftotext, o usa DOCX.')


def _limit_extracted_text(text: str) -> str:
    if len(text) > MAX_EXTRACTED_TEXT_CHARS:
        raise ValueError('Documento rechazado: contiene demasiado texto extraído para ser un CV.')
    return text


def extract_document(data: bytes, filename: str, content_type: str = '') -> dict:
    ext = Path(filename or '').suffix.lower()
    if ext == '.docx' or 'wordprocessingml' in content_type:
        text = _limit_extracted_text(_extract_docx(data))
        return {'text': text, 'format': 'docx', 'pages': None, 'engine': 'openxml'}
    if ext == '.pdf' or content_type == 'application/pdf':
        text, pages, engine = _extract_pdf(data)
        return {'text': _limit_extracted_text(text), 'format': 'pdf', 'pages': pages, 'engine': engine}
    if ext in {'.txt', '.md'} or content_type.startswith('text/'):
        text = _clean_text(data.decode('utf-8', errors='replace'))
        return {'text': _limit_extracted_text(text), 'format': ext.lstrip('.') or 'txt', 'pages': None, 'engine': 'text'}
    raise ValueError('Formato no compatible. Usa PDF, DOCX o TXT.')


def _heading_key(line: str) -> str | None:
    normalized = re.sub(r'[^a-záéíóúüñ ]+', '', line.lower()).strip()
    normalized = re.sub(r'\s+', ' ', normalized)
    for key, aliases in SECTION_ALIASES.items():
        if normalized in aliases:
            return key
    return None


def _split_sections(lines: list[str]) -> tuple[dict[str, list[str]], list[str]]:
    sections: dict[str, list[str]] = {'header': []}
    detected = []
    current = 'header'
    for line in lines:
        key = _heading_key(line)
        if key:
            current = key
            sections.setdefault(key, [])
            if key not in detected:
                detected.append(key)
            continue
        sections.setdefault(current, []).append(line)
    return sections, detected


def _contact_details(header: list[str], all_text: str) -> tuple[dict, list[str]]:
    emails = EMAIL_RE.findall(all_text)
    phones = PHONE_RE.findall(all_text)
    urls = URL_RE.findall(all_text)
    linkedin = next((u for u in urls if 'linkedin.com' in u.lower()), '')
    website = next((u for u in urls if 'linkedin.com' not in u.lower() and '@' not in u), '')

    filtered = []
    for line in header:
        if EMAIL_RE.search(line) or PHONE_RE.search(line) or URL_RE.search(line):
            continue
        if len(line) <= 160:
            filtered.append(line)

    name = filtered[0] if filtered else ''
    headline = filtered[1] if len(filtered) > 1 else ''
    location = ''
    if len(filtered) > 2:
        candidate = filtered[2]
        if len(candidate.split()) <= 8 and not re.search(r'\d{4}', candidate):
            location = candidate

    basics = {
        'fullName': name[:100],
        'headline': headline[:140],
        'email': emails[0] if emails else '',
        'phone': phones[0].strip() if phones else '',
        'location': location[:120],
        'linkedin': linkedin[:300],
        'website': website[:300],
    }
    return basics, filtered


def _date_parts(line: str) -> tuple[str, str, bool] | None:
    m = DATE_RANGE_RE.search(line)
    if not m:
        return None
    start, end = m.group('start'), m.group('end')
    current = bool(re.fullmatch(r'present|current|actualidad|presente', end, re.I))
    return start, '' if current else end, current


def _parse_experience(lines: list[str]) -> list[dict]:
    if not lines:
        return []
    # Identify records around recognizable date ranges. This is deliberately conservative.
    records = []
    starts = [i for i, line in enumerate(lines) if _date_parts(line)]
    if not starts:
        bullets = [BULLET_RE.sub('', x).strip() for x in lines if BULLET_RE.match(x)]
        headers = [x for x in lines if not BULLET_RE.match(x)]
        if headers or bullets:
            records.append({
                'id': uid('exp'), 'title': headers[0] if headers else '', 'company': headers[1] if len(headers) > 1 else '',
                'location': '', 'startDate': '', 'endDate': '', 'current': False,
                'bullets': [{'id': uid('b'), 'text': b} for b in bullets],
            })
        return records

    used_until = -1
    for n, idx in enumerate(starts):
        if idx <= used_until:
            continue
        next_idx = starts[n + 1] if n + 1 < len(starts) else len(lines)
        date = _date_parts(lines[idx])
        header_candidates = []
        j = idx - 1
        while j >= 0 and len(header_candidates) < 2 and not BULLET_RE.match(lines[j]) and not _date_parts(lines[j]):
            if lines[j].strip():
                header_candidates.insert(0, lines[j].strip())
            j -= 1
        title = header_candidates[-1] if header_candidates else ''
        company = header_candidates[-2] if len(header_candidates) > 1 else ''
        if ' | ' in title or ' — ' in title or ' - ' in title:
            parts = re.split(r'\s(?:\||—|-)\s', title, maxsplit=1)
            if len(parts) == 2:
                title, company = parts[0], parts[1]
        body = lines[idx + 1:next_idx]
        bullets = []
        location = ''
        for line in body:
            if BULLET_RE.match(line):
                bullets.append(BULLET_RE.sub('', line).strip())
            elif not location and len(line.split()) <= 8 and not _date_parts(line) and len(line) < 90:
                location = line
            elif line and bullets:
                bullets[-1] += ' ' + line
            elif line and not bullets and len(line) > 35:
                bullets.append(line)
        records.append({
            'id': uid('exp'), 'title': title[:160], 'company': company[:160], 'location': location[:120],
            'startDate': date[0], 'endDate': date[1], 'current': date[2],
            'bullets': [{'id': uid('b'), 'text': b[:800]} for b in bullets if b],
        })
        used_until = idx
    # De-duplicate records that accidentally share identical headers and dates.
    unique = []
    seen = set()
    for r in records:
        key = (r['title'].lower(), r['company'].lower(), r['startDate'], r['endDate'])
        if key not in seen:
            seen.add(key); unique.append(r)
    return unique[:12]


def _parse_education(lines: list[str]) -> list[dict]:
    if not lines:
        return []
    entries = []
    chunks = []
    cur = []
    for line in lines:
        if _date_parts(line) and cur:
            cur.append(line); chunks.append(cur); cur = []
        else:
            cur.append(line)
    if cur:
        chunks.append(cur)
    for chunk in chunks[:8]:
        clean = [x for x in chunk if x]
        if not clean: continue
        date_line = next((x for x in clean if _date_parts(x)), '')
        date = _date_parts(date_line) if date_line else None
        nondate = [x for x in clean if x != date_line and not BULLET_RE.match(x)]
        degree = nondate[0] if nondate else ''
        institution = nondate[1] if len(nondate) > 1 else ''
        details = ' '.join(nondate[2:])
        entries.append({'id': uid('edu'), 'degree': degree[:180], 'institution': institution[:180], 'startDate': date[0] if date else '', 'endDate': date[1] if date else '', 'details': details[:600]})
    return entries


def _parse_skills(lines: list[str]) -> list[dict]:
    raw = ' | '.join(lines)
    pieces = re.split(r'[,;|•·\n]', raw)
    skills = []
    for piece in pieces:
        s = re.sub(r'^[\-*•\s]+', '', piece).strip()
        if not s or len(s) > 70 or len(s.split()) > 8:
            continue
        # strip a single group label such as "Technical Skills:"
        if ':' in s:
            left, right = s.split(':', 1)
            if right.strip():
                s = right.strip()
        if s and s.lower() not in {x.lower() for x in skills}:
            skills.append(s)
    return [{'id': uid('skills'), 'name': 'Habilidades', 'skills': skills[:40]}] if skills else []


def _parse_simple_items(lines: list[str], kind: str) -> list[dict]:
    out = []
    for line in lines[:20]:
        text = BULLET_RE.sub('', line).strip()
        if not text: continue
        if kind == 'languages':
            parts = re.split(r'\s[-–—|:]\s|:\s*', text, maxsplit=1)
            out.append({'id': uid('lang'), 'language': parts[0][:80], 'level': parts[1][:80] if len(parts) > 1 else ''})
        elif kind == 'certifications':
            parts = re.split(r'\s[-–—|]\s', text, maxsplit=2)
            out.append({'id': uid('cert'), 'name': parts[0][:180], 'issuer': parts[1][:120] if len(parts) > 1 else '', 'date': parts[2][:40] if len(parts) > 2 else ''})
        elif kind == 'achievements':
            out.append({'id': uid('ach'), 'title': text[:180], 'description': ''})
    return out


def parse_resume_text(text: str, filename: str = 'CV importado') -> dict:
    text = _clean_text(text)
    lines = [x for x in text.split('\n') if x.strip()]
    sections, detected = _split_sections(lines)
    basics, header_filtered = _contact_details(sections.get('header', []), text)

    summary_lines = sections.get('summary', [])
    if not summary_lines and len(header_filtered) > 2:
        possible = [x for x in header_filtered[2:] if len(x.split()) > 8]
        summary_lines = possible[:2]
    summary = ' '.join(summary_lines).strip()[:1800]

    experience = _parse_experience(sections.get('experience', []))
    education = _parse_education(sections.get('education', []))
    skill_groups = _parse_skills(sections.get('skills', []))
    languages = _parse_simple_items(sections.get('languages', []), 'languages')
    certifications = _parse_simple_items(sections.get('certifications', []), 'certifications')
    achievements = _parse_simple_items(sections.get('achievements', []), 'achievements')

    score = 0
    evidence = []
    for label, ok, weight in [
        ('nombre', bool(basics['fullName']), 12), ('email', bool(basics['email']), 12), ('título', bool(basics['headline']), 8),
        ('secciones', len(detected) >= 3, 18), ('experiencia', bool(experience), 18), ('educación', bool(education), 10),
        ('habilidades', bool(skill_groups and skill_groups[0]['skills']), 12), ('resumen', bool(summary), 10),
    ]:
        if ok: score += weight
        evidence.append({'field': label, 'detected': ok, 'weight': weight})
    confidence = min(100, score)

    warnings = []
    if len(text) < 200: warnings.append('Se extrajo muy poco texto; el archivo podría estar escaneado como imagen.')
    if not basics['email']: warnings.append('No se detectó un correo electrónico.')
    if not experience: warnings.append('No se pudo estructurar la sección de experiencia automáticamente.')
    if len(detected) < 3: warnings.append('Se detectaron pocos encabezados estándar; revisa la reconstrucción.')

    section_order = ['summary','experience','education','skills','projects','certifications','languages','achievements']
    return {
        'schemaVersion': 9,
        'id': uid('resume'),
        'title': f'{Path(filename).stem or "CV"} · importado',
        'locale': {'language': 'es', 'country': 'MX'},
        'basics': basics,
        'summary': summary,
        'experience': experience,
        'education': education,
        'skillGroups': skill_groups or [{'id': uid('skills'), 'name': 'Habilidades', 'skills': []}],
        'projects': [], 'certifications': certifications, 'languages': languages, 'achievements': achievements,
        'genericSections': {}, 'customSections': [],
        'settings': {
            'templateId':'nexus','layout':'single','font':'Inter','accent':'#6d5dfc','paper':'a4','density':'comfortable','fontScale':1,'lineHeight':'normal',
            'margin':'normal','showIcons':True,'sectionOrder':section_order,'hiddenSections':[],'sectionColumns':{},'pageBreakHints':[]
        },
        'target': None,
        'careerProfile': {'targetRoles': [], 'seniority': '', 'industries': [], 'workModes': [], 'locationPreference': '', 'pitch': ''},
        'evidenceVault': [],
        'careerPack': None,
        'sourceAudit': {
            'fileName': filename,
            'detectedSections': detected,
            'importConfidence': confidence,
            'extractedCharacters': len(text),
            'warnings': warnings,
            'evidence': evidence,
            'sourceText': text[:4000],
        },
        'versions': [],
    }


def import_resume(data: bytes, filename: str, content_type: str = '') -> dict:
    extracted = extract_document(data, filename, content_type)
    resume = parse_resume_text(extracted['text'], filename)
    resume['sourceAudit'].update({
        'format': extracted['format'],
        'pages': extracted['pages'],
        'extractionEngine': extracted['engine'],
    })
    return {'resume': resume, 'audit': resume['sourceAudit'], 'rawText': extracted['text'][:60000]}
