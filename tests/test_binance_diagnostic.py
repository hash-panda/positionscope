import importlib.util, pathlib, unittest, json
spec=importlib.util.spec_from_file_location('diagnose',pathlib.Path(__file__).parents[1]/'scripts/diagnose-binance.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class DiagnosticTests(unittest.TestCase):
 def test_private_values_are_never_reported(self):
  report=m.summarize([{'symbol':'SECRET_SYMBOL','positionAmt':'123.456','entryPrice':'SECRET_VALUE','positionSide':'SHORT','marginAsset':'SECRET_ASSET'}])
  text=json.dumps(report)
  for value in ['SECRET','123.456']:self.assertNotIn(value,text)
  self.assertIn('direction_mismatch',text);self.assertIn('invalid_format',text)
 def test_numeric_shapes(self):
  for value,want in [(None,'missing'),('', 'missing'),('abc','invalid_format'),(True,'invalid_type'),('1e999','non_finite'),('-1','negative'),('0','zero'),('.1','positive')]:self.assertEqual(m.kind(value),want)
 def test_zero_rows_and_invalid_envelope(self):
  self.assertEqual(m.summarize([{'positionAmt':'0'}])['field_states'],[])
  self.assertEqual(m.summarize({'SECRET':'PRIVATE'}),{'shape':'not_array'})
