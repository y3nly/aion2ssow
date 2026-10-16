"""Guard upstream integration anchors and translation coverage before publishing."""
import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stats_build', ROOT / 'build.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        shutil.copyfile(ROOT / 'index.html', self.root / 'index.html')
        shutil.copytree(ROOT / 'extension', self.root / 'extension')

    def change(self, old, new):
        path = self.root / 'index.html'
        path.write_text(path.read_text(encoding='utf-8').replace(old, new), encoding='utf-8')

    def test_build_keeps_upstream_bytes_and_disables_remote_comments(self):
        before = (self.root / 'index.html').read_bytes()
        output = builder.build(self.root)
        self.assertEqual((self.root / 'index.html').read_bytes(), before)
        self.assertIn('const COMMENT_API="";', (output / 'index.html').read_text(encoding='utf-8'))

    def test_upstream_anchor_change_fails(self):
        self.change('function calc(', 'function renamedCalc(')
        with self.assertRaisesRegex(ValueError, 'integration changed'):
            builder.build(self.root)

    def test_new_static_and_dynamic_korean_text_is_reported(self):
        for old, new in [('<header>', '<header><h2>새로운 미번역 문구</h2>'),
                         ('function calc(', 'const newLabel="새로운 미번역 문구"; function calc(')]:
            with self.subTest(old=old):
                shutil.copyfile(ROOT / 'index.html', self.root / 'index.html')
                self.change(old, new)
                with self.assertRaisesRegex(ValueError, 'Untranslated upstream'):
                    builder.build(self.root)


if __name__ == '__main__':
    unittest.main()
