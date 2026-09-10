import io, sys, types, unittest, zipfile
from unittest.mock import patch
from server_lib.resume_parser import extract_document, MAX_DOCX_DOCUMENT_XML, MAX_EXTRACTED_TEXT_CHARS, _extract_pdf

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
