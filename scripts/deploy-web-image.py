"""Upload a locally checked web-only image without restarting API/judge."""
import pathlib,paramiko,hashlib,shlex,subprocess,json,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
root=pathlib.Path(__file__).resolve().parents[1];private=root.parent/'private';image=root/'artifacts/web-typography.tar';digest=hashlib.file_digest(image.open('rb'),'sha256').hexdigest()
c=paramiko.SSHClient();c.load_host_keys(str(private/'ssh/known_hosts'));c.set_missing_host_key_policy(paramiko.RejectPolicy());c.connect('176.53.244.36',username='root',key_filename=str(private/'ssh/fairround_ed25519'),look_for_keys=False,allow_agent=False)
def run(cmd):
 _,out,err=c.exec_command(cmd,timeout=300);data=out.read();error=err.read();assert out.channel.recv_exit_status()==0,error.decode();print(data.decode(),end='')
try:
 s=c.open_sftp();s.put(str(image),'/opt/fairround/artifacts/web-typography.tar.part');assert s.stat('/opt/fairround/artifacts/web-typography.tar.part').st_size==image.stat().st_size;s.close()
 run('echo '+shlex.quote(digest+'  /opt/fairround/artifacts/web-typography.tar.part')+' | sha256sum -c - && mv /opt/fairround/artifacts/web-typography.tar.part /opt/fairround/artifacts/web-typography.tar && docker load -i /opt/fairround/artifacts/web-typography.tar')
 s=c.open_sftp();
 for name in ['apps/web/app/style.css','apps/web/components/application.tsx','apps/web/components/live-screens.tsx','apps/web/components/arena.tsx','apps/web/components/replay.tsx']:s.put(str(root/name),'/opt/fairround/current/'+name)
 revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip();receipt={'apiRevision':'3748fbf','webRevision':revision,'imageSha256':digest}
 with s.open('/opt/fairround/current/DEPLOYED_VERSION.json','w') as f:f.write(json.dumps(receipt))
 s.close();run('cd /opt/fairround/current && docker compose up -d --no-deps --wait web')
 (root/'artifacts/web-deploy-receipt.json').write_text(json.dumps(receipt,indent=2))
finally:c.close()
