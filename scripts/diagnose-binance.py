#!/usr/bin/env python3
"""Local read-only schema report. No raw values, symbols, keys or signatures output."""
import argparse, getpass, hashlib, hmac, json, math, re, time, sys
import urllib.request, urllib.parse, urllib.error
FIELDS = ('positionAmt','entryPrice','markPrice','unRealizedProfit','isolatedWallet','liquidationPrice','positionInitialMargin','maintMargin','updateTime')
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
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--production',action='store_true',help='Explicitly read your production positions locally; default is Demo.')
    args=parser.parse_args()
    if not sys.stdin.isatty():
        print('Run in an interactive terminal; credentials are never accepted through piped input.');return
    host='https://fapi.binance.com' if args.production else 'https://demo-fapi.binance.com'
    print('Read-only endpoint: '+host+'/fapi/v3/positionRisk. Credentials stay in this process; no raw response is printed.')
    key=getpass.getpass('API Key (hidden): ');secret=getpass.getpass('API Secret (hidden): ')
    query=urllib.parse.urlencode({'timestamp':int(time.time()*1000),'recvWindow':5000})
    signature=hmac.new(secret.encode(),query.encode(),hashlib.sha256).hexdigest()
    request=urllib.request.Request(host+'/fapi/v3/positionRisk?'+query+'&signature='+signature,headers={'X-MBX-APIKEY':key},method='GET')
    try:
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=20) as response:
            body=response.read(4*1024*1024+1)
            if len(body)>4*1024*1024:raise ValueError()
            report=summarize(json.loads(body))
        print(json.dumps(report,ensure_ascii=False,indent=2))
    except urllib.error.HTTPError as e:print(json.dumps({'status':'http_error','http_status':e.code}))
    except Exception:print(json.dumps({'status':'transport_or_response_unverified'}))
if __name__=='__main__':
    try:main()
    except (KeyboardInterrupt,EOFError):print('Cancelled; no report generated.')
