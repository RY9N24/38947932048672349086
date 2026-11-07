"""Clean exact test IDs over the already trusted SSH connection."""
import pathlib,paramiko,sys,json,shlex
root=pathlib.Path(__file__).resolve().parents[1];private=root.parent/'private'
manifest=json.loads(sys.stdin.read())
assert manifest['target']=='https://fairround.176.53.244.36.sslip.io'
client=paramiko.SSHClient();client.load_host_keys(str(private/'ssh/known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy());client.connect('176.53.244.36',username='root',key_filename=str(private/'ssh/fairround_ed25519'),look_for_keys=False,allow_agent=False)
try:
 s=client.open_sftp();s.put(str(root/'scripts/cleanup-test-data.ts'),'/opt/fairround/shared/cleanup-test-data.ts');s.close()
 command='cd /opt/fairround/current && docker compose cp /opt/fairround/shared/cleanup-test-data.ts api:/app/scripts/cleanup-test-data.ts && docker compose exec -T api node node_modules/tsx/dist/cli.mjs scripts/cleanup-test-data.ts --manifest=- --apply'
 stdin,out,err=client.exec_command(command,timeout=120);stdin.write(json.dumps(manifest));stdin.channel.shutdown_write();output=out.read();error=err.read();assert out.channel.recv_exit_status()==0,error.decode();print('Remote manifest cleanup completed')
finally:client.close()
