import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const production=process.argv.includes('--production');
const path=process.env.ENV_DESTINATION||'.env';
if(existsSync(path)){console.log('Environment already exists; preserved.');process.exit(0);}
const domain=process.env.DOMAIN||'fairround.176.53.244.36.sslip.io';
const content={POSTGRES_PASSWORD:randomBytes(24).toString('hex'),JWT_SECRET:randomBytes(48).toString('hex'),DEMO_MODE:'true',COOKIE_SECURE:production?'true':'false',PUBLIC_URL:production?'https://'+domain:'http://localhost:8080',HTTP_PORT:production?'80':'8080',HTTPS_PORT:production?'443':'8443',SITE_ADDRESS:production?domain:':80',JUDGE_CONCURRENCY:production?'1':'2'};
writeFileSync(path,Object.entries(content).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
console.log('Environment created; secret values are not printed.');
