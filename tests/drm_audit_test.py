"""보호 문서와 스캔 PDF를 구분하고 ZIP 내부도 검사하는지 확인한다."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile
import pymupdf

spec=importlib.util.spec_from_file_location('drm_audit',Path(__file__).resolve().parents[1]/'tools/drm_audit.py')
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditTest(unittest.TestCase):
    def test_drm_header_without_document_extension(self):
        self.assertEqual(audit.header_kind(b'\x9b DRMONE protected by Fasoo DRM'),'DRM 확인')

    def test_image_only_pdf_is_not_drm(self):
        with pymupdf.open() as d:
            d.new_page()
            status,_,extra=audit.inspect(d.tobytes(),'.pdf')
        self.assertEqual(status,'PDF 글자층 없음')
        self.assertEqual(extra['pages'],1)

    def test_password_pdf_is_separate(self):
        with pymupdf.open() as d:
            d.new_page()
            b=d.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='reader')
        self.assertEqual(audit.inspect(b,'.pdf')[0],'PDF 암호 필요')

    def test_broken_pdf_is_not_drm(self):
        self.assertEqual(audit.inspect(b'not a pdf','.pdf')[0],'문서 열기 실패')

    def test_archive_and_original_stay_unchanged(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td);raw=b'\x9b DRMONE protected by Fasoo DRM'
            (p/'example.hwp').write_bytes(raw)
            with zipfile.ZipFile(p/'source.zip','w') as z:z.writestr('exam.pdf',raw)
            result=audit.audit([p])
            self.assertEqual(len(result['records']),2)
            self.assertEqual({r['status'] for r in result['records']},{'DRM 확인'})
            self.assertEqual(len({r['sha256'] for r in result['records']}),1)
            self.assertEqual((p/'example.hwp').read_bytes(),raw)
            self.assertFalse(result['errors'])


if __name__=='__main__':unittest.main()
