"""Publish only the four reviewed public presentation files, never private data."""
import pathlib,hashlib,shlex,paramiko,sys,json
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
root=pathlib.Path(__file__).resolve().parents[1]
private=root.parent/'private'
client=paramiko.SSHClient();client.load_host_keys(str(private/'ssh/known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
client.connect('176.53.244.36',username='root',key_filename=str(private/'ssh/fairround_ed25519'),allow_agent=False,look_for_keys=False)
def run(cmd):
 _,out,err=client.exec_command(cmd,timeout=120);a=out.read().decode();b=err.read().decode();code=out.channel.recv_exit_status()
 if code:raise RuntimeError(b)
 print(a,end='')
try:
 run('mkdir -p /opt/fairround/shared/materials')
 sftp=client.open_sftp()
 for name in ['FairRound.pptx','FairRound.pdf','FairRound-demo.mp4','FairRound-demo-short.mp4']:
  p=root/'presentation'/name;target='/opt/fairround/shared/materials/'+name
  sftp.put(str(p),target+'.part');assert sftp.stat(target+'.part').st_size==p.stat().st_size
  digest=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
  run('echo '+shlex.quote(digest+'  '+target+'.part')+' | sha256sum -c - && mv '+shlex.quote(target+'.part')+' '+shlex.quote(target))
 for name in ['compose.yaml','deploy/Caddyfile']:
  sftp.put(str(root/name),'/opt/fairround/current/'+name)
 envpath='/opt/fairround/shared/.env'
 with sftp.open(envpath,'rb') as f:env=f.read().decode()
 if 'MATERIALS_DIR=' not in env:
  env=env.rstrip()+'\nMATERIALS_DIR=/opt/fairround/shared/materials\n'
  with sftp.open(envpath,'w') as f:f.write(env)
  sftp.chmod(envpath,0o600)
  (private/'production.env').write_text(env,encoding='utf-8')
 sftp.close()
 run('cd /opt/fairround/current && docker compose config --quiet && docker compose run --rm --no-deps proxy caddy validate --config /etc/caddy/Caddyfile && docker compose up -d --no-deps proxy && docker compose ps')
 run('free -m && df -h / && docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"')
finally:client.close()
