"""Transfer a locally verified release; no server-side application build."""
import argparse, pathlib, subprocess, hashlib, json, datetime, shlex, time, paramiko, sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
sys.stderr.reconfigure(encoding='utf-8',errors='replace')

parser=argparse.ArgumentParser()
parser.add_argument('--host',default='176.53.244.36')
parser.add_argument('--key',default='../private/ssh/fairround_ed25519')
parser.add_argument('--known-hosts',default='../private/ssh/known_hosts')
parser.add_argument('--env',default='../private/production.env')
parser.add_argument('--images',default='artifacts/fairround-images.tar.gz')
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
images=(root/args.images).resolve();env=(root/args.env).resolve()
assert images.is_file() and env.is_file(), 'Prepare images and private production env first'
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
release=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+revision[:8]
source=root/'artifacts'/f'source-{release}.tar.gz'
subprocess.run(['git','archive','--format=tar.gz','-o',str(source),'HEAD'],cwd=root,check=True)
client=paramiko.SSHClient();client.load_host_keys(str((root/args.known_hosts).resolve()));client.set_missing_host_key_policy(paramiko.RejectPolicy())
client.connect(args.host,username='root',key_filename=str((root/args.key).resolve()),allow_agent=False,look_for_keys=False,timeout=20)
def run(command):
    stdin,stdout,stderr=client.exec_command(command,timeout=900)
    # Drain both streams so large apt/docker logs cannot block the SSH channel.
    channel=stdout.channel
    while not channel.exit_status_ready() or channel.recv_ready() or channel.recv_stderr_ready():
        if channel.recv_ready(): print(channel.recv(65536).decode(errors='replace'),end='',flush=True)
        if channel.recv_stderr_ready(): print(channel.recv_stderr(65536).decode(errors='replace'),end='',flush=True)
        time.sleep(.1)
    code=channel.recv_exit_status()
    if code: raise RuntimeError('Remote command failed, exit '+str(code))
def upload(local,remote):
    size=local.stat().st_size;digest=hashlib.file_digest(local.open('rb'),'sha256').hexdigest()
    sftp=client.open_sftp();last=[0]
    def progress(sent,total):
        percent=int(sent/max(1,total)*100)
        if percent>=last[0]+10: print(local.name,str(percent)+'%',flush=True);last[0]=percent
    sftp.put(str(local),remote+'.part',callback=progress);assert sftp.stat(remote+'.part').st_size==size;sftp.close()
    run('echo '+shlex.quote(digest+'  '+remote+'.part')+' | sha256sum -c - && mv '+shlex.quote(remote+'.part')+' '+shlex.quote(remote))
try:
    run('mkdir -p /opt/fairround/artifacts /opt/fairround/releases /opt/fairround/shared && chmod 700 /opt/fairround/shared')
    upload(source,'/opt/fairround/artifacts/source-'+release+'.tar.gz')
    target='/opt/fairround/releases/'+release
    run('mkdir -p '+shlex.quote(target)+' && tar -xzf '+shlex.quote('/opt/fairround/artifacts/source-'+release+'.tar.gz')+' -C '+shlex.quote(target))
    sftp=client.open_sftp()
    try:
        existing=sftp.open('/opt/fairround/shared/.env','rb').read()
        assert existing==env.read_bytes(),'Existing production env differs; refusing overwrite'
    except FileNotFoundError:
        sftp.put(str(env),'/opt/fairround/shared/.env');sftp.chmod('/opt/fairround/shared/.env',0o600)
    sftp.close()
    run('bash '+shlex.quote(target+'/deploy/install-docker.sh'))
    image_target='/opt/fairround/artifacts/'+images.name
    upload(images,image_target)
    run('docker load -i '+shlex.quote(image_target))
    run('ln -s /opt/fairround/shared/.env '+shlex.quote(target+'/.env')+' && cd '+shlex.quote(target)+' && docker compose config --quiet && docker compose pull postgres redis proxy && docker compose up -d --no-build')
    domain=next(line.split('=',1)[1] for line in env.read_text().splitlines() if line.startswith('PUBLIC_URL='))
    for attempt in range(40):
        import urllib.request
        try:
            with urllib.request.urlopen(domain+'/api/health',timeout=10) as response:
                health=json.loads(response.read())
                if health.get('status')=='ok': break
        except Exception: time.sleep(3)
    else: raise RuntimeError('HTTPS health check failed; current release link not changed')
    run('ln -sfn '+shlex.quote(target)+' /opt/fairround/current && cd '+shlex.quote(target)+' && docker compose ps')
    receipt={'host':args.host,'release':release,'revision':revision,'url':domain,'imagesSha256':hashlib.file_digest(images.open('rb'),'sha256').hexdigest(),'httpsHealth':'ok'}
    (root/'artifacts/deploy-receipt.json').write_text(json.dumps(receipt,indent=2))
    print('Verified HTTPS deployment:',domain,flush=True)
finally:client.close()
