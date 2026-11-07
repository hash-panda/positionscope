#!/usr/bin/env python3
"""Signed, isolated Squirrel.Mac upgrade rehearsal. No production profiles or APIs.
Copies the just-built app into disposable bundles with a DIFFERENT app identity,
replaces their entry point with a synthetic harness, and signs both using the
already imported certificate. They are never distributed or called notarized.
"""
import argparse, hashlib, json, os, plistlib, shutil, subprocess, tempfile, time
from pathlib import Path


def run(argv, **kwargs):
    result = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        # The commands contain a signing identity/keychain path; keep logs bounded.
        raise RuntimeError(f'Updater rehearsal command failed: {Path(argv[0]).name}, exit {result.returncode}')
    return result.stdout


def verify(app, identity, keychain, root, output):
    with tempfile.TemporaryDirectory(prefix='positionscope-upgrade-', dir=os.environ.get('RUNNER_TEMP')) as temp:
        directory = Path(temp)
        installed = directory / 'installed' / 'PositionScope Update Test.app'
        candidate = directory / 'candidate' / installed.name
        harness = r'''
const {app,autoUpdater}=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__ROOT__,work=__WORK__;
app.setName('PositionScope Update Test');app.setPath('userData',path.join(work,'synthetic-profile'));
const {UpdateInstaller,serveVerifiedUpdate,writeVerifiedPackage}=require(path.join(root,'dist/main/services/update-install.js'));
function record(value){fs.writeFileSync(path.join(work,'state.json'),JSON.stringify(value));}
process.on('uncaughtException',()=>{record({error:'uncaught'});app.exit(1);});
process.on('unhandledRejection',()=>{record({error:'unhandled'});app.exit(1);});
autoUpdater.on('error',error=>{
 const text=String(error?.message||'').toLowerCase();
 const category=['signature','permission','transport','connection','read-only','directory','application'].find(x=>text.includes(x))||'other';
 fs.writeFileSync(path.join(work,'native-error.json'),JSON.stringify({category,code:Number.isFinite(error?.code)?error.code:null}));
});
app.whenReady().then(async()=>{
 if(app.getVersion()==='0.0.2'){record({version:app.getVersion(),restarted:true});app.quit();return;}
 const release=fs.readFileSync(path.join(work,'release.json')),verification=fs.readFileSync(path.join(work,'verification.json'));
 const io={read:async url=>url.endsWith('/latest')?release:verification,
 download:async(target,file,progress)=>writeVerifiedPackage(fs.createReadStream(path.join(work,'candidate.zip')),file,target,progress),serve:serveVerifiedUpdate};
 const updater=new UpdateInstaller('0.0.1',process.arch,true,work,autoUpdater,io,state=>{
  record({state:state.state,version:app.getVersion()});
  if(state.state==='ready')setTimeout(()=>updater.restart(),100);
  if(state.state==='unavailable')setTimeout(()=>app.exit(2),100);
 });
 await updater.check();await updater.download();
});
app.on('window-all-closed',()=>{});
'''.replace('__ROOT__', json.dumps(str(root))).replace('__WORK__', json.dumps(str(directory)))
        for bundle, version in ((installed, '0.0.1'), (candidate, '0.0.2')):
            bundle.parent.mkdir(parents=True)
            shutil.copytree(app, bundle, symlinks=True)
            resources = bundle / 'Contents/Resources'
            (resources / 'app.asar').unlink()
            shutil.rmtree(resources / 'app.asar.unpacked', ignore_errors=True)
            entry = resources / 'app'; entry.mkdir()
            (entry / 'package.json').write_text(json.dumps({'name':'positionscope-update-test','version':version,'main':'main.cjs'}))
            (entry / 'main.cjs').write_text(harness)
            plist = bundle / 'Contents/Info.plist'
            info = plistlib.loads(plist.read_bytes())
            info.update(CFBundleIdentifier='app.funagent.positionscope.update-test',CFBundleName='PositionScope Update Test',CFBundleDisplayName='PositionScope Update Test',CFBundleShortVersionString=version,CFBundleVersion=version)
            info.pop('ElectronAsarIntegrity', None)
            plist.write_bytes(plistlib.dumps(info))
            run(['codesign','--force','--timestamp','--sign',identity,'--keychain',str(keychain),'--options','runtime','--entitlements',str(root/'build/entitlements.mac.plist'),str(bundle)])
            run(['codesign','--verify','--deep','--strict',str(bundle)])
        run(['ditto','-c','-k','--keepParent',str(candidate),str(directory/'candidate.zip')])
        data=(directory/'candidate.zip').read_bytes(); digest=hashlib.sha256(data).hexdigest();size=len(data);del data
        arch=run(['lipo','-archs',str(installed/'Contents/MacOS/PositionScope')]).decode().strip().replace('x86_64','x64')
        # Record is deliberately synthetic; native code signature verification is real.
        verification={'version':'0.0.2','architecture':arch,'app_id':'app.funagent.positionscope','minimum_macos_version':'13.0','signature_verified':True,'staple_validated':True,'gatekeeper_assessment':'accepted','app_notarization':'11111111-1111-1111-1111-111111111111','artifacts':{f'PositionScope-0.0.2-{arch}.zip':digest}}
        record=json.dumps(verification).encode();(directory/'verification.json').write_bytes(record)
        names=[f'PositionScope-0.0.2-{a}.{ext}' for a in ('arm64','x64') for ext in ('dmg','zip')]+[f'PositionScope-0.0.2-{a}-verification.json' for a in ('arm64','x64')]+['SHA256SUMS.txt']
        release={'tag_name':'v0.0.2','draft':False,'prerelease':False,'html_url':'https://github.com/hash-panda/positionscope/releases/tag/v0.0.2','assets':[{'name':name,'state':'uploaded','size':size if name.endswith('.zip') else len(record),'browser_download_url':f'https://github.com/hash-panda/positionscope/releases/download/v0.0.2/{name}','digest':'sha256:'+(digest if name.endswith('.zip') else hashlib.sha256(record).hexdigest())} for name in names]}
        (directory/'release.json').write_text(json.dumps(release))
        process=subprocess.Popen([str(installed/'Contents/MacOS/PositionScope')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env={k:v for k,v in os.environ.items() if not k.startswith(('APPLE_','CSC_'))})
        try:
            deadline=time.monotonic()+180
            state={}
            while time.monotonic()<deadline:
                if (directory/'state.json').exists():
                    try: state=json.loads((directory/'state.json').read_text())
                    except json.JSONDecodeError: pass
                    if state.get('error') or state.get('state')=='unavailable':
                        diagnostic=json.loads((directory/'native-error.json').read_text()) if (directory/'native-error.json').exists() else {'category':'harness'}
                        raise RuntimeError('Signed native updater rehearsal failed: '+json.dumps(diagnostic))
                    if state.get('restarted') is True:break
                time.sleep(1)
            else:raise RuntimeError('Signed native updater rehearsal timed out at '+str(state.get('state','launch')))
            if state.get('version')!='0.0.2':raise RuntimeError('Updated version mismatch')
            info=plistlib.loads((installed/'Contents/Info.plist').read_bytes())
            if info.get('CFBundleShortVersionString')!='0.0.2':raise RuntimeError('Installed bundle was not replaced')
            run(['codesign','--verify','--deep','--strict',str(installed)])
            output.write_text(json.dumps({'platform':'darwin','architecture':arch,'synthetic_profile_only':True,'separate_test_identity':True,'stream_hash_verified':True,'native_signature_checked':True,'installed_bundle_replaced':True,'new_version_relaunched':True,'real_user_profile_tested':False},indent=2)+'\n')
        finally:
            if process.poll() is None:process.terminate();process.wait(timeout=10)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--app',type=Path,required=True);parser.add_argument('--keychain',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    verify(args.app,os.environ['APPLE_SIGNING_IDENTITY'],args.keychain,Path(__file__).resolve().parent.parent,args.output)
