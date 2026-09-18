import io, sys, types, unittest, zipfile
from unittest.mock import patch
from server_lib.resume_parser import extract_document, parse_resume_text, MAX_DOCX_DOCUMENT_XML, MAX_EXTRACTED_TEXT_CHARS, _extract_pdf

class ParserHardeningTests(unittest.TestCase):
    def _docx(self, document_xml: bytes, extras=0):
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('word/document.xml',document_xml)
            for i in range(extras):zf.writestr(f'word/x{i}.xml',b'<x/>')
        return buf.getvalue()

    def test_valid_minimal_docx_extracts_text(self):
        xml=b'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Alan CV</w:t></w:r></w:p></w:body></w:document>'
        out=extract_document(self._docx(xml),'cv.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        self.assertEqual(out['format'],'docx');self.assertEqual(out['text'],'Alan CV')

    def test_docx_zip_bomb_sized_document_xml_is_rejected(self):
        payload=b'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+b'A'*(MAX_DOCX_DOCUMENT_XML+1)+b'</w:document>'
        with self.assertRaisesRegex(ValueError,'demasiado grande|descomprimido excesivo'):
            extract_document(self._docx(payload),'bomb.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document')


    def test_extracted_text_has_hard_limit(self):
        with self.assertRaisesRegex(ValueError,'demasiado texto'):
            extract_document(b'A'*(MAX_EXTRACTED_TEXT_CHARS+1),'huge.txt','text/plain')

    def test_pdf_page_limit_is_not_swallowed_by_fallback(self):
        class FakeReader:
            def __init__(self,_):self.pages=[object() for _ in range(251)]
        fake=types.SimpleNamespace(PdfReader=FakeReader)
        with patch.dict(sys.modules,{'pypdf':fake}):
            with self.assertRaisesRegex(ValueError,'Máximo 250 páginas'):
                _extract_pdf(b'%PDF-fake')

    def test_docx_without_document_xml_is_rejected_cleanly(self):
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as zf:zf.writestr('[Content_Types].xml',b'<Types/>')
        with self.assertRaisesRegex(ValueError,'falta word/document.xml'):
            extract_document(buf.getvalue(),'broken.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document')

    def test_experience_records_do_not_absorb_next_record_headers(self):
        resume=parse_resume_text('''Ana QA
ana@example.com

EXPERIENCIA
Empresa Uno
Backend Engineer
2020 - 2022
- Construí APIs internas.
Empresa Dos
Frontend Engineer
2022 - 2024
- Modernicé interfaces.
''','qa.txt')
        self.assertEqual(len(resume['experience']),2)
        first,second=resume['experience']
        self.assertEqual(first['company'],'Empresa Uno')
        self.assertEqual(first['title'],'Backend Engineer')
        self.assertEqual(first['bullets'][0]['text'],'Construí APIs internas.')
        self.assertNotIn('Frontend Engineer',first['bullets'][0]['text'])
        self.assertEqual(second['company'],'Empresa Dos')
        self.assertEqual(second['title'],'Frontend Engineer')

    def test_projects_section_is_preserved_in_imported_resume(self):
        resume=parse_resume_text('''Ana QA
ana@example.com

PROYECTOS
Portal interno
Full Stack Developer
2024 - actualidad
https://example.com/portal
- Implementé autenticación y panel administrativo.
- Automaticé despliegues.
''','qa.txt')
        self.assertEqual(len(resume['projects']),1)
        project=resume['projects'][0]
        self.assertEqual(project['name'],'Portal interno')
        self.assertEqual(project['role'],'Full Stack Developer')
        self.assertEqual(project['startDate'],'2024')
        self.assertTrue(project['url'].endswith('/portal'))
        self.assertEqual([b['text'] for b in project['bullets']],['Implementé autenticación y panel administrativo.','Automaticé despliegues.'])

    def test_contact_parser_does_not_turn_email_or_job_dates_into_website_or_phone(self):
        resume=parse_resume_text('''Ana QA
Backend Engineer
ana@example.com

EXPERIENCIA
Empresa Uno
Backend Engineer
2020 - 2024
- Construí APIs internas.
''','qa.txt')
        self.assertEqual(resume['basics']['email'],'ana@example.com')
        self.assertEqual(resume['basics']['website'],'')
        self.assertEqual(resume['basics']['phone'],'')

    def test_certification_url_and_achievement_date_are_preserved(self):
        resume=parse_resume_text('''Ana QA
ana@example.com

CERTIFICACIONES
AWS Certified Solutions Architect — Amazon Web Services — 2025 https://example.org/cert/123

LOGROS
Premio Nacional — 2026 — Reconocimiento técnico por automatización.
''','qa.txt')
        self.assertEqual(len(resume['certifications']),1)
        cert=resume['certifications'][0]
        self.assertEqual(cert['name'],'AWS Certified Solutions Architect')
        self.assertEqual(cert['issuer'],'Amazon Web Services')
        self.assertEqual(cert['date'],'2025')
        self.assertEqual(cert['url'],'https://example.org/cert/123')
        self.assertEqual(len(resume['achievements']),1)
        achievement=resume['achievements'][0]
        self.assertEqual(achievement['title'],'Premio Nacional')
        self.assertEqual(achievement['date'],'2026')
        self.assertEqual(achievement['description'],'Reconocimiento técnico por automatización.')
