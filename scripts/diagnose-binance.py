#!/usr/bin/env python3
"""Local read-only schema report. No raw values, symbols, keys or signatures output."""
import argparse, getpass, hashlib, hmac, json, math, re, time, sys, socket, ssl, errno
import urllib.request, urllib.parse, urllib.error
FIELDS = ('positionAmt','entryPrice','markPrice','unRealizedProfit','isolatedWallet','isolatedMargin','liquidationPrice','positionInitialMargin','maintMargin','updateTime')
PATTERN = re.compile(r'^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$', re.I)
def kind(value):
    if value is None or isinstance(value,str) and not value.strip(): return 'missing'
    if isinstance(value,bool) or not isinstance(value,(str,int,float)): return 'invalid_type'
    if isinstance(value,str) and not PATTERN.fullmatch(value.strip()): return 'invalid_format'
    n=float(value)
    if not math.isfinite(n): return 'non_finite'
    return 'negative' if n<0 else 'positive' if n>0 else 'zero'
def summarize(data):
    if not isinstance(data,list): return {'shape':'not_array'}
    patterns=set()
    for p in data:
        if not isinstance(p,dict): patterns.add(('response','invalid_row'));continue
        # Order-only zero rows are ignored by the application too.
        if kind(p.get('positionAmt'))=='zero':continue
        for f in FIELDS:patterns.add((f,kind(p.get(f))))
        side=p.get('positionSide');q=kind(p.get('positionAmt'))
        state='valid' if side in ('BOTH','LONG','SHORT') else 'invalid_enum'
        if side=='LONG' and q=='negative' or side=='SHORT' and q=='positive':state='direction_mismatch'
        patterns.add(('positionSide',state))
        patterns.add(('marginAsset','supported' if p.get('marginAsset')=='USDT' else 'unsupported'))
    return {'shape':'array','field_states':[{'field':f,'state':s} for f,s in sorted(patterns)]}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
class OversizedResponse(Exception): pass

def failure(error, phase):
    report={'status':'failed','phase':phase,'reason':'unexpected_error'}
    if isinstance(error,urllib.error.HTTPError):
        report.update(reason='http_error',http_status=error.code)
        # Never emit an upstream message, URL, headers, exception text or payload.
        return report
    reason=error.reason if isinstance(error,urllib.error.URLError) else error
    if isinstance(reason,ssl.SSLCertVerificationError):report['reason']='tls_certificate_verification_failed'
    elif isinstance(reason,ssl.SSLError):report['reason']='tls_connection_failed'
    elif isinstance(reason,(TimeoutError,socket.timeout)):report['reason']='timeout'
    elif isinstance(reason,socket.gaierror):report['reason']='dns_resolution_failed'
    elif isinstance(reason,ConnectionRefusedError):report['reason']='connection_refused'
    elif isinstance(reason,OSError):
        report['reason']={errno.ENETUNREACH:'network_unreachable',errno.EHOSTUNREACH:'host_unreachable',errno.ECONNRESET:'connection_reset'}.get(reason.errno,'network_error')
    elif isinstance(error,(json.JSONDecodeError,UnicodeDecodeError)):report['reason']='response_not_json'
    elif isinstance(error,OversizedResponse):report['reason']='response_too_large'
    elif isinstance(error,urllib.error.URLError):report['reason']='connection_or_proxy_error'
    return report

def read_json(opener,request):
    with opener.open(request,timeout=20) as response:
        body=response.read(4*1024*1024+1)
        if len(body)>4*1024*1024:raise OversizedResponse()
        return json.loads(body)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--production',action='store_true',help='Explicitly read your production positions locally; default is Demo.')
    parser.add_argument('--check-network',action='store_true',help='Only request public server time; no API credentials needed.')
    args=parser.parse_args()
    host='https://fapi.binance.com' if args.production else 'https://demo-fapi.binance.com'
    # Uses urllib system/environment proxy selection, not the Electron app settings.
    report={'diagnostic_version':2,'environment':'production' if args.production else 'demo',
            'proxy_detected':bool(urllib.request.getproxies().get('https'))}
    opener=urllib.request.build_opener(NoRedirect())
    try:
        data=read_json(opener,urllib.request.Request(host+'/fapi/v1/time',method='GET'))
        if not isinstance(data,dict) or type(data.get('serverTime')) is not int:
            report.update(status='failed',phase='public_time',reason='unexpected_response_shape')
            print(json.dumps(report));return
    except Exception as error:
        report.update(failure(error,'public_time'));print(json.dumps(report));return
    if args.check_network:
        report.update(status='ok',phase='public_time');print(json.dumps(report));return
    if not sys.stdin.isatty():
        print('Run in an interactive terminal; credentials are never accepted through piped input.');return
    print('Public connection passed. Read-only position request; credentials stay in this process.')
    key=getpass.getpass('API Key (hidden): ');secret=getpass.getpass('API Secret (hidden): ')
    if not key or not secret or not key.isascii() or not secret.isascii() or any(c.isspace() for c in key+secret):
        report.update(status='failed',phase='credentials',reason='empty_or_invalid_characters');print(json.dumps(report));return
    query=urllib.parse.urlencode({'timestamp':int(time.time()*1000),'recvWindow':5000})
    signature=hmac.new(secret.encode(),query.encode(),hashlib.sha256).hexdigest()
    request=urllib.request.Request(host+'/fapi/v3/positionRisk?'+query+'&signature='+signature,headers={'X-MBX-APIKEY':key},method='GET')
    try:
        report.update(summarize(read_json(opener,request)))
        report.update(status='ok' if report['shape']=='array' else 'failed',phase='position_schema')
    except Exception as error:report.update(failure(error,'positions'))
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':
    try:main()
    except (KeyboardInterrupt,EOFError):print('Cancelled; no report generated.')
