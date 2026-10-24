import base64
import importlib.util
from pathlib import Path
import unittest
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
if __name__=='__main__':unittest.main()
