from pathlib import Path
import subprocess,json
root=Path.cwd();raw=sorted((root/'artifacts/demo-raw-revision').glob('*.webm'),key=lambda p:p.stat().st_mtime)
parts=[];chapters=[];offset=0
labels=['S1. Организатор создаёт задачу и контест','S2, S6. WA, OK, TLE и восстановление','S3. Дуэль: первый участник','S3. Дуэль: черновик и сдача','S4. Командная работа: капитан','S4. Командная работа: напарник','S5. Повтор, хэши и решение']
for i,p in enumerate(raw):
 out=root/f'artifacts/demo-part-{i}.mp4'; speed=4 if i==6 else 1.25
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(p),'-vf',f'setpts={speed}*PTS,fps=25','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p',str(out)],check=True)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(out)]))
 chapters.append(f'{int(offset)//60:02}:{int(offset)%60:02} — {labels[i]}');offset+=duration;parts.append(out)
(root/'artifacts/demo-concat.txt').write_text('\n'.join("file '"+str(p).replace('\\','/')+"'" for p in parts))
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i','artifacts/demo-concat.txt','-c','copy','-movflags','+faststart','presentation/FairRound-demo.mp4'],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i','presentation/FairRound-demo.mp4','-vf',f'setpts={75/offset}*PTS,fps=25','-an','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart','presentation/FairRound-demo-short.mp4'],check=True)
# Cover is the separately captured verdict scene, not the duel screenshot.
(root/'presentation/VIDEO.md').write_text('# Запись показа\n\nРеальный HTTPS-стенд, реальные действия Playwright. Без звука: комментарии — в SPEECH.md. Полная запись замедлена до 0,8× для чтения, повтор — до 0,25×. Короткая версия ускорена до 75 секунд. Данные исторического повтора синтетические.\n\n'+'\n\n'.join(chapters)+'\n\nСборка: python presentation/build/video.py. Сначала запуск захвата: node node_modules/@playwright/test/cli.js test --config presentation/build/capture.config.ts.\n',encoding='utf-8')
print('Full video seconds:',offset)
