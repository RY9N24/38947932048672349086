"""Create the explicitly requested private second-PC package outside the repository."""
import pathlib,subprocess,paramiko,zipfile,hashlib
root=pathlib.Path(__file__).resolve().parents[1];base=root.parent;private=base/'private'
c=paramiko.SSHClient();c.load_host_keys(str(private/'ssh/known_hosts'));c.set_missing_host_key_policy(paramiko.RejectPolicy());c.connect('176.53.244.36',username='root',key_filename=str(private/'ssh/fairround_ed25519'),allow_agent=False,look_for_keys=False)
try:
 _,out,err=c.exec_command('cd /opt/fairround/current && docker compose exec -T postgres pg_dump -U fairround fairround',timeout=60);dump=out.read();error=err.read();assert out.channel.recv_exit_status()==0,error.decode();assert b'PostgreSQL database dump' in dump
finally:c.close()
bundle=base/'repository.bundle';subprocess.run(['git','bundle','create',str(bundle),'--all'],cwd=root,check=True);subprocess.run(['git','bundle','verify',str(bundle)],cwd=root,check=True)
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0');revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip();archive=base/'FairRound-handover.zip'
intro=f'''FAIRROUND — ПЕРЕНОС НА ВТОРОЙ ПК
Версия: {revision}

1. Распакуйте архив в отдельную папку. Откройте project/START_HERE.md.
2. Рабочая папка — project. Запуск и проверки описаны в project/README.md.
3. Презентация, PDF, видео, речь и QA — project/presentation/. Название команды и участники указаны на слайде 14.
4. Сайт уже работает: https://fairround.176.53.244.36.sslip.io.
5. Сервер: root@176.53.244.36, ключ private/ssh/fairround_ed25519. Пароль root для входа не нужен.
6. private/production.env — секреты. private/backups/production.sql — копия текущей БД. Не импортировать поверх рабочего сайта без отдельного решения.
7. repository.bundle содержит полную историю Git. GitHub-аккаунт на новом ПК требует отдельной авторизации владельца.
8. Передача после приёмки: project/docs/REVISION_ACCEPTANCE.md и STATUS.md; снимки before/after.
9. Обычный Docker не гарантирует защиту от escape. Прочитать LIMITATIONS.md; усиленный judge пока не внедрён.
10. Архив содержит закрытый ключ. Не отправлять жюри, не загружать в GitHub. Для жюри — только presentation.
'''
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.writestr('START_TRANSFER.txt',intro)
 for name in tracked:
  if name:z.write(root/name,'project/'+name)
 z.write(bundle,'repository.bundle')
 for name in ['production.env','new-server.json','ssh/fairround_ed25519','ssh/fairround_ed25519.pub','ssh/known_hosts','ssh/README_TRANSFER.txt']:z.write(private/name,'private/'+name)
 z.writestr('private/backups/production.sql',dump)
 for p in (private/'backups').glob('before-revision-*.sql.gz'):z.write(p,'private/backups/'+p.name)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert z.read('private/ssh/fairround_ed25519')==(private/'ssh/fairround_ed25519').read_bytes()
 assert z.read('private/production.env')==(private/'production.env').read_bytes()
 assert z.read('project/START_HERE.md')==(root/'START_HERE.md').read_bytes()
 assert len(z.read('private/backups/production.sql'))>1000
 assert not any(n.endswith(('session.json', 'access.json')) for n in z.namelist())
digest=hashlib.file_digest(archive.open('rb'),'sha256').hexdigest();(base/'FairRound-handover.zip.sha256').write_text(digest+'  FairRound-handover.zip\n');print('Verified private handover:',archive,'bytes',archive.stat().st_size,'SHA256',digest)
