import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
export default async function cleanup(){
 const target=process.env.TEST_BASE_URL||'http://localhost:3000',folder='artifacts/test-manifests';if(!existsSync(folder))return;
 const created=readdirSync(folder).filter(n=>n.endsWith('.json')).flatMap(n=>{const m=JSON.parse(readFileSync(folder+'/'+n,'utf8'));return m.target===target?m.created:[];});
 const manifest=JSON.stringify({target,created});
 if(/localhost|127\.0\.0\.1/.test(target)){
  execFileSync('docker',['compose','cp','scripts/cleanup-test-data.ts','api:/app/scripts/cleanup-test-data.ts'],{stdio:'pipe'});
  execFileSync('docker',['compose','exec','-T','api','node','node_modules/tsx/dist/cli.mjs','scripts/cleanup-test-data.ts','--manifest=-','--apply'],{input:manifest,stdio:['pipe','pipe','pipe']});
 }else{
  if(process.env.TEST_ALLOW_PRODUCTION!=='1')throw Error('Refusing remote cleanup without explicit production test mode');
  execFileSync('python',['scripts/cleanup-e2e-remote.py'],{input:manifest,stdio:['pipe','pipe','pipe']});
 }
 console.log('E2E cleanup: recorded object IDs removed; unrelated records preserved.');
}
