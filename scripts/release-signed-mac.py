#!/usr/bin/env python3
"""Sign, notarize and verify macOS archives on an ephemeral GitHub runner.
Uses AIbubu's six Apple secret names; never prints command arguments or credentials.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile

REQUIRED = ('APPLE_CERTIFICATE','APPLE_CERTIFICATE_PASSWORD','APPLE_SIGNING_IDENTITY','APPLE_ID','APPLE_PASSWORD','APPLE_TEAM_ID')

def preflight(env):
    missing=[name for name in REQUIRED if not env.get(name)]
    if missing: raise ValueError('Missing GitHub secrets: '+', '.join(missing))
    if not env['APPLE_SIGNING_IDENTITY'].startswith('Developer ID Application:'):
        raise ValueError('APPLE_SIGNING_IDENTITY must be a Developer ID Application certificate')
    try: base64.b64decode(''.join(env['APPLE_CERTIFICATE'].split()),validate=True)
    except Exception: raise ValueError('APPLE_CERTIFICATE must be a base64-encoded PKCS#12 file') from None

def run(args,env=None,diagnostics=False):
    result=subprocess.run(args,env=env,capture_output=True,text=True)
    if result.returncode and diagnostics:
        # Only enabled for the builder process, whose environment excludes Apple credentials.
        output=result.stdout+'\n'+result.stderr
        for name,value in os.environ.items():
            if value and (name.startswith(('APPLE_','CSC_')) or name in ('GH_TOKEN','GITHUB_TOKEN')):
                output=output.replace(value,'[REDACTED]')
        print(output[-6000:],file=sys.stderr)
    if result.returncode: raise RuntimeError(f'{Path(args[0]).name} {args[1] if len(args)>1 else ""} failed (exit {result.returncode}); secret-bearing output withheld')
    return result.stdout

def notarize(artifact,profile,keychain):
    response=json.loads(run(['xcrun','notarytool','submit',str(artifact),'--keychain-profile',profile,'--keychain',str(keychain),'--wait','--output-format','json','--timeout','30m']))
    if response.get('status')!='Accepted': raise RuntimeError('Apple notarization did not return Accepted; no release will be published')
    return response['id']

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--arch',choices=['arm64','x64'],required=True);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    env=dict(os.environ);preflight(env)
    if args.check: print('Apple signing inputs present and structurally valid; certificate usability not yet verified');return
    if sys.platform!='darwin':raise RuntimeError('Signing requires a macOS runner')
    root=Path(__file__).resolve().parent.parent;os.chdir(root)
    version=json.loads((root/'package.json').read_text())['version'];identity=env['APPLE_SIGNING_IDENTITY']
    previous=shlex.split(run(['security','list-keychains','-d','user']))
    with tempfile.TemporaryDirectory(prefix='positionscope-sign-',dir=env.get('RUNNER_TEMP')) as directory:
        temporary=Path(directory);keychain=temporary/'signing.keychain-db';p12=temporary/'certificate.p12';password=secrets.token_urlsafe(32)
        try:
            p12.write_bytes(base64.b64decode(''.join(env['APPLE_CERTIFICATE'].split()),validate=True));p12.chmod(0o600)
            run(['security','create-keychain','-p',password,str(keychain)])
            run(['security','set-keychain-settings','-lut','21600',str(keychain)])
            run(['security','unlock-keychain','-p',password,str(keychain)])
            run(['security','import',str(p12),'-k',str(keychain),'-P',env['APPLE_CERTIFICATE_PASSWORD'],'-T','/usr/bin/codesign','-T','/usr/bin/security'])
            p12.unlink()
            run(['security','set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',password,str(keychain)])
            run(['security','list-keychains','-d','user','-s',str(keychain),*previous])
            if identity not in run(['security','find-identity','-v','-p','codesigning',str(keychain)]): raise RuntimeError('Developer ID Application identity not found in imported certificate')
            build_env={k:v for k,v in env.items() if not k.startswith('APPLE_') and k not in ('CSC_LINK','CSC_KEY_PASSWORD')}
            build_env.update(APPLE_SIGNING_IDENTITY=identity,CSC_KEYCHAIN=str(keychain),CSC_IDENTITY_AUTO_DISCOVERY='true')
            print('Stage: build and sign application',flush=True)
            run(['pnpm','exec','electron-builder','--config','build/electron-signed.cjs','--mac','dir','--'+args.arch,'--publish','never'],env=build_env,diagnostics=True)
            app=root/'release'/('mac-arm64' if args.arch=='arm64' else 'mac')/'PositionScope.app'
            run(['codesign','--verify','--deep','--strict',str(app)])
            info=subprocess.run(['codesign','-dv','--verbose=4',str(app)],capture_output=True,text=True,check=True).stderr
            if f'TeamIdentifier={env["APPLE_TEAM_ID"]}' not in info or 'Authority=Developer ID Application:' not in info: raise RuntimeError('Signed app identity/team mismatch')
            print('Stage: application signature verified; validate Apple notarization credentials',flush=True)
            profile='positionscope-notary'
            run(['xcrun','notarytool','store-credentials',profile,'--apple-id',env['APPLE_ID'],'--password',env['APPLE_PASSWORD'],'--team-id',env['APPLE_TEAM_ID'],'--keychain',str(keychain)])
            upload=temporary/'upload.zip';run(['ditto','-c','-k','--keepParent',str(app),str(upload)])
            print('Stage: submit application for Apple notarization',flush=True)
            app_submission=notarize(upload,profile,keychain)
            print('Stage: application notarization accepted; staple and assess Gatekeeper',flush=True)
            run(['xcrun','stapler','staple',str(app)]);run(['xcrun','stapler','validate',str(app)])
            run(['spctl','--assess','--type','execute','--verbose=2',str(app)])
            output=root/'release'/'signed';output.mkdir(parents=True,exist_ok=True)
            stem=f'PositionScope-{version}-{args.arch}'
            zip_path=output/f'{stem}.zip';run(['ditto','-c','-k','--keepParent',str(app),str(zip_path)])
            staging=temporary/'dmg';staging.mkdir();shutil.copytree(app,staging/app.name,symlinks=True);(staging/'Applications').symlink_to('/Applications')
            dmg=output/f'{stem}.dmg';run(['hdiutil','create','-volname','PositionScope','-srcfolder',str(staging),'-format','UDZO','-ov',str(dmg)])
            run(['codesign','--timestamp','--sign',identity,'--keychain',str(keychain),str(dmg)])
            print('Stage: submit signed DMG for Apple notarization',flush=True)
            dmg_submission=notarize(dmg,profile,keychain);run(['xcrun','stapler','staple',str(dmg)]);run(['xcrun','stapler','validate',str(dmg)])
            evidence={'version':version,'architecture':args.arch,'app_notarization':app_submission,'dmg_notarization':dmg_submission,'signature_verified':True,'staple_validated':True,'gatekeeper_assessment':'accepted','artifacts':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (zip_path,dmg)}}
            (output/f'{stem}-verification.json').write_text(json.dumps(evidence,indent=2)+'\n')
            print(f'Verified signed and notarized {args.arch} ZIP and DMG; no credentials included in artifacts')
        finally:
            run(['security','list-keychains','-d','user','-s',*previous])
            subprocess.run(['security','delete-keychain',str(keychain)],capture_output=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        print(str(error),file=sys.stderr);sys.exit(1)
