import base64
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import io
from contextlib import redirect_stderr
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
if __name__=='__main__':unittest.main()
