import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('release_notes',Path(__file__).parents[1]/'scripts/extract-release-notes.py')
notes=importlib.util.module_from_spec(spec);spec.loader.exec_module(notes)

class ReleaseNotesTests(unittest.TestCase):
    def test_only_matching_chapter_and_nested_sections(self):
        text='# 0.2.4（2026-11-07）\n\nCurrent\n## Checks\nPassed\n# 0.2.3\nOld\n'
        result=notes.extract(text,'0.2.4')
        self.assertIn('## Checks',result);self.assertNotIn('0.2.3',result);self.assertNotIn('Old',result)
    def test_missing_empty_duplicate_and_prefix_collision_fail(self):
        for text in ['# 0.2.40\nWrong', '# 0.2.4\n\n# 0.2.3\nOld', '# 0.2.4\nFirst\n# 0.2.4\nSecond']:
            with self.subTest(text=text),self.assertRaises(ValueError):notes.extract(text,'0.2.4')
    def test_preview_and_malformed_versions_rejected(self):
        for version in ['0.2.4-beta.1','0.02.4','v0.2.4','0.2.4\n']:
            with self.subTest(version=version),self.assertRaises(ValueError):notes.extract('# '+version+'\nBody',version)
    def test_current_repository_chapter(self):
        import json
        root=Path(__file__).parents[1];version=json.loads((root/'package.json').read_text())['version']
        body=notes.extract((root/'docs/release-notes.md').read_text(),version)
        self.assertEqual(len(__import__('re').findall(r'^# ',body,__import__('re').M)),1)
