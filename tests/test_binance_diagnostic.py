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
 def test_bounded_transport_reasons_never_echo_sensitive_errors(self):
  import urllib.error, ssl, socket
  marker='SECRET_PROXY_URL_AND_SIGNATURE'
  cases=[(TimeoutError(marker),'timeout'),(ConnectionRefusedError(marker),'connection_refused'),(socket.gaierror(marker),'dns_resolution_failed'),(ssl.SSLCertVerificationError(marker),'tls_certificate_verification_failed'),(ssl.SSLError(marker),'tls_connection_failed')]
  for cause,want in cases:
   r=m.failure(urllib.error.URLError(cause),'public_time');self.assertEqual(r['reason'],want);self.assertNotIn(marker,json.dumps(r))
  self.assertEqual(m.failure(urllib.error.URLError(marker),'positions')['reason'],'connection_or_proxy_error')
  self.assertNotIn(marker,json.dumps(m.failure(ValueError(marker),'positions')))
 def test_response_errors_are_separate_from_network_and_http(self):
  import urllib.error
  self.assertEqual(m.failure(json.JSONDecodeError('SECRET','SECRET',0),'positions')['reason'],'response_not_json')
  self.assertEqual(m.failure(m.OversizedResponse(),'positions')['reason'],'response_too_large')
  r=m.failure(urllib.error.HTTPError('SECRET',451,'SECRET',{},None),'public_time')
  self.assertEqual(r['http_status'],451);self.assertNotIn('SECRET',json.dumps(r))
 def test_network_only_never_requests_credentials_or_private_endpoint(self):
  from unittest.mock import patch
  import io
  for payload,want in [({'serverTime':123},'ok'),({'msg':'SECRET'},'failed')]:
   with patch.object(m.sys,'argv',['diagnose','--production','--check-network']),patch.object(m,'read_json',return_value=payload) as read,patch.object(m.getpass,'getpass',side_effect=AssertionError('must not prompt')),patch('sys.stdout',new_callable=io.StringIO) as out:
    m.main();r=json.loads(out.getvalue());self.assertEqual(r['status'],want);self.assertEqual(read.call_count,1);self.assertEqual(read.call_args.args[1].full_url,'https://fapi.binance.com/fapi/v1/time');self.assertNotIn('SECRET',out.getvalue())
 def test_preflight_failure_never_prompts_for_secrets(self):
  from unittest.mock import patch
  import io
  with patch.object(m.sys,'argv',['diagnose','--production']),patch.object(m,'read_json',side_effect=ConnectionRefusedError('SECRET')),patch.object(m.getpass,'getpass',side_effect=AssertionError('must not prompt')),patch('sys.stdout',new_callable=io.StringIO) as out:
   m.main();r=json.loads(out.getvalue());self.assertEqual(r['phase'],'public_time');self.assertEqual(r['reason'],'connection_refused');self.assertNotIn('SECRET',out.getvalue())
