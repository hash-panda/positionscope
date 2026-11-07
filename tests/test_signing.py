import base64
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import io
import tempfile
from contextlib import redirect_stderr, redirect_stdout
spec=importlib.util.spec_from_file_location('release_mac',Path(__file__).parents[1]/'scripts/release-signed-mac.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class SigningInputs(unittest.TestCase):
 def test_missing_secrets_fail_with_names_only(self):
  with self.assertRaisesRegex(ValueError,'APPLE_CERTIFICATE'):module.preflight({})
 def test_wrong_certificate_class_is_rejected(self):
  values={k:'synthetic' for k in module.REQUIRED};values['APPLE_CERTIFICATE']=base64.b64encode(b'fixture').decode()
  with self.assertRaisesRegex(ValueError,'Developer ID'):module.preflight(values)
 def test_validation_does_not_claim_real_certificate_verification(self):
  values={k:'synthetic' for k in module.REQUIRED};values['APPLE_CERTIFICATE']=base64.b64encode(b'fixture').decode();values['APPLE_SIGNING_IDENTITY']='Developer ID Application: synthetic'
  module.preflight(values)
class BuilderDiagnostics(unittest.TestCase):
 def test_failed_builder_diagnostics_redact_credentials(self):
  result=SimpleNamespace(returncode=1,stdout='fixture-private-value',stderr='build failed')
  output=io.StringIO()
  with patch.dict(module.os.environ,{'APPLE_CERTIFICATE_PASSWORD':'fixture-private-value'}), patch.object(module.subprocess,'run',return_value=result), redirect_stderr(output):
   with self.assertRaisesRegex(RuntimeError,'pnpm exec failed'):module.run(['pnpm','exec','builder'],diagnostics=True)
  self.assertNotIn('fixture-private-value',output.getvalue())
  self.assertIn('[REDACTED]',output.getvalue())
  self.assertIn('build failed',output.getvalue())
class StaplingFailurePolicy(unittest.TestCase):
 def result(self, code):
  return SimpleNamespace(returncode=code,stdout='synthetic-private-stdout',stderr='synthetic-private-stderr')
 def test_stapling_recovers_from_68_then_requires_validation_without_output_disclosure(self):
  output=io.StringIO()
  with patch.object(module.subprocess,'run',side_effect=[self.result(68),self.result(68),self.result(0),self.result(0)]) as execute, patch.object(module.time,'sleep') as sleep, redirect_stdout(output), redirect_stderr(output):
   module.staple_and_validate(Path('synthetic.app'))
  self.assertEqual([call.args[0][1:3] for call in execute.call_args_list],[['stapler','staple']]*3+[['stapler','validate']])
  self.assertEqual([call.args[0] for call in sleep.call_args_list],[15,30])
  self.assertNotIn('synthetic-private',output.getvalue())
  self.assertNotIn('synthetic.app',output.getvalue())
 def test_stapling_exhausts_three_attempts_and_never_validates_or_discloses_output(self):
  output=io.StringIO()
  with patch.object(module.subprocess,'run',return_value=self.result(68)) as execute, patch.object(module.time,'sleep') as sleep, redirect_stdout(output), redirect_stderr(output):
   with self.assertRaisesRegex(RuntimeError,'exit 68') as failure:module.staple_and_validate(Path('synthetic.app'))
  self.assertEqual(execute.call_count,3)
  self.assertEqual(sleep.call_count,2)
  self.assertTrue(all(call.args[0][2]=='staple' for call in execute.call_args_list))
  self.assertNotIn('synthetic-private',str(failure.exception)+output.getvalue())
 def test_other_stapling_failures_stop_immediately(self):
  for code in (1,65,66,73,77):
   with self.subTest(code=code), patch.object(module.subprocess,'run',return_value=self.result(code)) as execute, patch.object(module.time,'sleep') as sleep:
    with self.assertRaisesRegex(RuntimeError,f'exit {code}'):module.staple_and_validate(Path('synthetic.dmg'))
    self.assertEqual(execute.call_count,1);sleep.assert_not_called()
 def test_validation_failure_is_fatal_even_for_68(self):
  with patch.object(module.subprocess,'run',side_effect=[self.result(0),self.result(68)]) as execute, patch.object(module.time,'sleep') as sleep:
   with self.assertRaisesRegex(RuntimeError,'exit 68'):module.staple_and_validate(Path('synthetic.dmg'))
  self.assertEqual([call.args[0][2] for call in execute.call_args_list],['staple','validate'])
  sleep.assert_not_called()
 def test_notarization_rejection_is_not_retried_or_stapled(self):
  rejected=SimpleNamespace(returncode=0,stdout='{"status":"Invalid","id":"synthetic"}',stderr='')
  with patch.object(module.subprocess,'run',return_value=rejected) as execute, patch.object(module.time,'sleep') as sleep:
   with self.assertRaisesRegex(RuntimeError,'did not return Accepted'):module.notarize(Path('synthetic.zip'),'synthetic-profile',Path('synthetic-keychain'))
  self.assertEqual(execute.call_count,1);sleep.assert_not_called()
class BundleBranding(unittest.TestCase):
 def test_packaged_artwork_matches_and_rejects_default_or_changed_icons(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);resources=root/'Resources';source=root/'source'
   (resources/'brand').mkdir(parents=True);source.mkdir()
   expected=source/'app-icon.icns';expected.write_bytes(b'icns-brand-fixture')
   (resources/'icon.icns').write_bytes(expected.read_bytes())
   for name in ('trayTemplate.png','trayTemplate@2x.png'):
    (source/name).write_bytes(name.encode());(resources/'brand'/name).write_bytes(name.encode())
   evidence=module.verify_bundle_branding(resources,{'CFBundleIconFile':'icon.icns'},expected,source)
   self.assertTrue(evidence['packaged_app_icon_matches'])
   self.assertTrue(evidence['packaged_tray_icons_match'])
   with self.assertRaisesRegex(RuntimeError,'artwork'):
    module.verify_bundle_branding(resources,{'CFBundleIconFile':'electron.icns'},expected,source)
   (resources/'icon.icns').write_bytes(b'icns-electron-fixture')
   with self.assertRaisesRegex(RuntimeError,'artwork'):
    module.verify_bundle_branding(resources,{'CFBundleIconFile':'icon.icns'},expected,source)
   (resources/'icon.icns').write_bytes(expected.read_bytes())
   (resources/'brand/trayTemplate@2x.png').write_bytes(b'wrong')
   with self.assertRaisesRegex(RuntimeError,'menu-bar'):
    module.verify_bundle_branding(resources,{'CFBundleIconFile':'icon.icns'},expected,source)
if __name__=='__main__':unittest.main()
