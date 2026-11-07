const pptxgen = require('pptxgenjs');
const QRCode = require('qrcode');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const asset = name => path.join(root, 'assets', name);
const site = process.env.PUBLIC_DEMO_URL || 'https://fairround.176.53.244.36.sslip.io';
const pptx = new pptxgen();
pptx.layout='LAYOUT_WIDE';pptx.author='FairRound';pptx.subject='Прототип платформы алгоритмических соревнований';pptx.title='Честный раунд';pptx.company='Хакатон ФСП × Самарский Политех';pptx.lang='ru-RU';
pptx.theme={headFontFace:'IBM Plex Sans Condensed',bodyFontFace:'IBM Plex Sans',lang:'ru-RU'};
const C={paper:'F3F1EC',sheet:'FBFAF7',ink:'141414',muted:'5E5B55',rule:'D9D5CC',signal:'FF4D00',arena:'0F1011',light:'ECEAE4'};
const W=13.333333,H=7.5;
function text(s,t,x,y,w,h,size=20,opts={}){s.addText(t,{x,y,w,h,fontFace:'IBM Plex Sans',fontSize:size,color:s._dark?C.light:C.ink,margin:0,breakLine:false,paraSpaceAfterPt:0,verticalAnchor:'top',...opts});}
function line(s,x1,y1,x2,y2,color=C.rule,width=.7){s.addShape(pptx.ShapeType.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color,width}});}
function slide(n,label,title,dark=false){const s=pptx.addSlide();s._dark=dark;s.background={color:dark?C.arena:C.paper};const rule=dark?'37393B':C.rule;line(s,.55,.36,12.78,.36,rule);text(s,`${String(n).padStart(2,'0')} / 14 · ${label}`,.58,.49,8,.25,9,{fontFace:'IBM Plex Mono',color:dark?'AAA69E':C.muted});text(s,'ЧЕСТНЫЙ РАУНД',9.4,.49,3.35,.25,10,{fontFace:'IBM Plex Sans Condensed',align:'right'});if(title)text(s,title,.6,1.02,12.15,1.02,34,{fontFace:'IBM Plex Sans Condensed',bold:true,fit:'shrink'});return s;}
function picture(s,name,x,y,w,h,photo=false,crop){const p=asset(name);if(!fs.existsSync(p))throw Error('Missing real asset: '+p);const dimensions=JSON.parse(fs.readFileSync(asset('dimensions.json'),'utf8'));const [iw,ih]=dimensions[name];if(photo){s.addImage({path:p,x,y,w:iw/96,h:ih/96,sizing:{type:'cover',w,h},altText:'photo:'+name});}else{const scale=Math.min(w/iw,h/ih),dw=iw*scale,dh=ih*scale,dx=x+(w-dw)/2,dy=y+(h-dh)/2;s.addImage({path:p,x:dx,y:dy,w:dw,h:dh,altText:'screen:'+name});s.addShape(pptx.ShapeType.rect,{x:dx,y:dy,w:dw,h:dh,line:{color:s._dark?'37393B':C.rule,width:.6},fill:{color:C.paper,transparency:100}});}}

function note(s,t,x,y,w=2.5){line(s,x,y-.15,x+w,y-.15,s._dark?'55534E':C.rule);text(s,t,x,y,w,.6,13,{fontFace:'IBM Plex Mono',color:s._dark?'C6C1B7':C.muted,fit:'shrink'});}
function box(s,t,x,y,w,h=1){s.addShape(pptx.ShapeType.rect,{x,y,w,h,line:{color:C.ink,width:.8},fill:{color:C.paper}});text(s,t,x+.12,y+.18,w-.24,h-.25,16,{fontFace:'IBM Plex Sans Condensed',align:'center',valign:'mid'});}
function arrow(s,x,y,w,h=0){s.addShape(pptx.ShapeType.line,{x,y,w,h,line:{color:C.ink,width:1,endArrowType:'triangle'}});}
function table(s,rows,y,widths,fontSize=16){s.addTable(rows.map((row,r)=>row.map((cell,i)=>i===1?{text:cell,options:{fill:r===0?C.signal:C.sheet,bold:true}}:cell)),{x:.6,y,w:12.1,colW:widths,rowH:.64,fontFace:'IBM Plex Sans',fontSize,color:C.ink,fill:C.paper,border:{type:'solid',pt:.5,color:C.rule},margin:[10,10,10,10],bold:false,autoPage:false,verbose:false});}
async function main(){
 const qr=await QRCode.toDataURL(site,{margin:1,width:600,color:{dark:'#141414',light:'#F3F1EC'}});
 const videoQr=await QRCode.toDataURL(site+'/materials/FairRound-demo.mp4',{margin:1,width:500,color:{dark:'#ECEAE4',light:'#0F1011'}});
 let s=slide(1,'ПРОЕКТ','');
 text(s,'Честный\nраунд',.6,1.5,7,2.4,82,{fontFace:'IBM Plex Sans Condensed',bold:true});text(s,'Соревнование заканчивается.\nИстория решения остаётся.',.65,4.3,6.4,1,26);text(s,'ФСП × Самарский Политех\nХакатон · 7 ноября 2026',.65,6.3,6,.65,13,{fontFace:'IBM Plex Mono',color:C.muted});picture(s,'clock.jpg',7.6,1.1,5.1,5.85,true);
 s=slide(2,'ПРОБЛЕМА','Результат есть. Истории решения нет.');picture(s,'russian-icpc.jpg',.6,2.15,7.2,4.45,true);[['Задачи','в чате'],['Время','отдельно'],['Итог','в таблице']].forEach(([a,b],i)=>{text(s,a,8.4,2.15+i*1.45,4.2,.6,30,{fontFace:'IBM Plex Sans Condensed',bold:true});text(s,b,8.4,2.85+i*1.45,4.2,.5,22,{color:C.muted});line(s,8.4,3.42+i*1.45,12.7,3.42+i*1.45);});text(s,'Иллюстрация: финал ICPC, Санкт-Петербург, 2013 · АиФ. Не фото нашей команды.',.65,6.85,12,.35,11,{fontFace:'IBM Plex Mono',color:C.muted});
 s=slide(3,'РОЛИ','Организатор готовит раунд, участник решает');
 const roleScreens = [
  ['Организатор','role-organizer.png','Судейская · задачи и контесты'],
  ['Участник','role-participant.png','Арена · условие, редактор и отправки'],
 ];
 roleScreens.forEach(([title,image,caption],i)=>{
  const x=.65+i*6.15;
  text(s,title,x,2.02,5.85,.45,23,{fontFace:'IBM Plex Sans Condensed',bold:true});
  picture(s,image,x,2.66,5.85,3);
  text(s,caption,x,5.92,5.85,.45,17);
 });
 text(s,'Экраны демонстрационного стенда',.65,6.91,12,.3,11,{fontFace:'IBM Plex Mono',color:C.muted});
 s=slide(4,'ТАБЛО','Что видно на общем экране');
 picture(s,'board-overview.png',.65,2.0,8.35,4.8);
 [['Идут сейчас','Число контестов и дуэлей'],['Последние дуэли','Участники и итоговый счёт'],['Ближайший старт','18:00 · Вечерний контест']].forEach(([title,caption],i)=>{
  const y=2.55+i*1.18;
  line(s,9.22,y,12.65,y);
  text(s,title,9.22,y+.12,3.43,.42,21,{fontFace:'IBM Plex Sans Condensed',bold:true});
  text(s,caption,9.22,y+.56,3.43,.44,16);
 });
 s=slide(5,'ДУЭЛЬ','Соперник виден. Его код закрыт.',true);
 picture(s,'duel-detail.png',.65,2.74,12,2.4);
 text(s,'Серверный таймер',.65,2.12,7,.4,16,{fontFace:'IBM Plex Mono'});
 picture(s,'duel-clock.png',9.5,2.05,3.1,.55);
 text(s,'На экране: счёт и прогресс по задачам',.65,5.48,12,.55,24,{fontFace:'IBM Plex Sans Condensed',bold:true});
 text(s,'При обрыве связи таймер идёт. Подтверждённый черновик восстанавливается.',.65,6.43,12,.5,16,{fontFace:'IBM Plex Mono'});
 s=slide(6,'КОМАНДА','Общий зачёт, отдельные редакторы');
 picture(s,'team-detail.png',.65,2.08,8.1,4.32);
 [['Код напарника','Открывается только для чтения.'],['Мой код','Кнопка возвращает в свой редактор.'],['Общий зачёт','Успешная отправка засчитывается паре.']].forEach(([title,caption],i)=>{
  const y=2.53+i*1.2;
  line(s,9.0,y,12.67,y);
  text(s,title,9.0,y+.1,3.67,.4,21,{fontFace:'IBM Plex Sans Condensed',bold:true});
  text(s,caption,9.0,y+.52,3.67,.6,16);
 });
 s=slide(7,'ОТЛИЧИЕ','Контест — основа. Наш фокус — процесс.');
 table(s,[['Подтверждённый сценарий','Честный раунд','Яндекс Контест'],['Автопроверка решений','Python / C++','Есть'],['Личный и командный зачёт','Лично / пары','Есть']],2.05,[4.6,3.75,3.75],22);
 [['Дуэль по ссылке','Общий старт и закрытый код соперника'],['Пара в работе','Два редактора, распределение задач и чат'],['Разбор после финиша','Повтор редактора и решение организатора']].forEach(([a,b],i)=>{text(s,a,.7,4.6+i*.65,3.5,.45,22,{fontFace:'IBM Plex Sans Condensed',bold:true,color:C.signal});text(s,b,4.4,4.63+i*.65,8.1,.4,18);});text(s,'Сравнение только по подтверждённым функциям. Источники: CREDITS.md · 07.11.2026',.65,7.0,12,.25,10,{fontFace:'IBM Plex Mono',color:C.muted});
 s=slide(8,'ДЕМОНСТРАЦИЯ','От отправки к судейскому повтору',true);
 const clip=path.join(root,'FairRound-demo-short.mp4');
 if(process.env.PDF_STATIC){
  picture(s,'verdict-tle.png',.8,2.25,5.1,2.0);
  picture(s,'verdict-ok.png',6.9,2.25,5.1,2.0);
  text(s,'TLE · превышен лимит времени',.8,4.58,5.4,.62,24,{fontFace:'IBM Plex Sans Condensed'});
  text(s,'OK · новая отправка принята',6.9,4.58,5.1,.62,24,{fontFace:'IBM Plex Sans Condensed'});
  text(s,'В резервном показе откройте FairRound-demo-short.mp4',.8,6.0,10,.5,18);
 }else{
  s.addMedia({type:'video',path:clip,extn:'mp4',cover:'image/png;base64,'+fs.readFileSync(asset('demo-cover.png')).toString('base64'),x:1.85,y:1.91,w:8.16,h:5.1});
 }
 s.addImage({data:videoQr,x:11.05,y:5.4,w:1.5,h:1.5});
 text(s,'Полная запись S1–S6 по QR',.8,7.05,9,.25,12,{fontFace:'IBM Plex Mono'});
 s=slide(9,'ВИДЕОПОВТОР','Что увидел организатор в записи Сергея');
 text(s,'Отсчёт от ухода со вкладки',.65,2.05,7,.42,16,{fontFace:'IBM Plex Mono',color:C.muted});
 const replayEvents=[
  ['0:00','Ушёл со вкладки'],
  ['4:00','Вернулся во вкладку'],
  ['4:06','Вставил 912 символов извне'],
  ['4:36','Отправил решение · OK'],
 ];
 replayEvents.forEach(([time,event],i)=>{
  const y=2.66+i*.82;
  line(s,.65,y,7.8,y);
  text(s,time,.65,y+.13,1.6,.45,21,{fontFace:'IBM Plex Mono',bold:true});
  text(s,event,2.3,y+.12,5.5,.47,21,{bold:i===2});
 });
 text(s,'От вставки до отправки — 30 секунд',.65,6.18,7.2,.45,18,{fontFace:'IBM Plex Sans Condensed',bold:true});
 text(s,'Журнал сигналов и решение',8.05,2.04,4.6,.43,18,{fontFace:'IBM Plex Sans Condensed',bold:true});
 picture(s,'replay-journal.png',8.05,2.54,4.6,4.19);
 text(s,'Синтетическая история. Сигнал помогает выбрать момент для ручной проверки.',.65,6.98,12,.26,11,{fontFace:'IBM Plex Mono',color:C.muted});
 s=slide(10,'ПРИВАТНОСТЬ','Проверяем без камеры и записи экрана');[['В записи','Код и вставки\nФокус вкладки\nОтправки решений'],['За пределами записи','Камера и микрофон\nДругие сайты\nБуфер вне редактора']].forEach(([a,b],i)=>{const x=.65+i*4.2;text(s,a,x,2.3,3.9,.6,25,{fontFace:'IBM Plex Sans Condensed',bold:true});line(s,x,3.05,x+3.7,3.05);text(s,b,x,3.5,3.9,2.3,23,{lineSpacingMultiple:1.3});});text(s,'30',9.2,2.8,3.5,1.8,116,{fontFace:'IBM Plex Mono'});text(s,'дней хранения',9.35,4.95,3.1,.7,26,{fontFace:'IBM Plex Sans Condensed'});text(s,'Сначала согласие. Запись видят участник и организатор.',.65,6.7,12,.4,18,{color:C.muted});
 s=slide(11,'АРХИТЕКТУРА','Как отправка получает вердикт');
 box(s,'Отправка\nс сайта',.65,2.45,2.35);
 box(s,'Очередь\nRedis / BullMQ',3.66,2.45,2.45);
 box(s,'Judge\nворкер проверки',6.77,2.45,2.48);
 s.addShape(pptx.ShapeType.rect,{x:9.91,y:2.45,w:2.77,h:1,line:{color:C.signal,width:1},fill:{color:C.signal}});
 text(s,'Docker-контейнер\nзапускает решение',10.04,2.62,2.51,.66,16,{fontFace:'IBM Plex Sans Condensed',bold:true,align:'center'});
 arrow(s,3,2.95,.66);arrow(s,6.11,2.95,.66);arrow(s,9.25,2.95,.66);
 line(s,.65,4.14,12.68,4.14);
 text(s,'Judge возвращает вердикт на сайт',.65,4.43,12,.55,28,{fontFace:'IBM Plex Sans Condensed',bold:true});
 text(s,'У запуска нет сети. Действуют лимиты времени, памяти и процессов.',.65,5.22,11.7,.8,22);
 text(s,'На стенде один слот проверки. Сайт и judge работают на одном сервере.',.65,6.65,12,.5,15,{fontFace:'IBM Plex Mono',color:C.muted});
 s=slide(12,'СТАТУС','Что уже можно проверить');[['Работает','Контесты, дуэли, пары, проверка решений и повтор','1F7A4D'],['Демо-данные','Быстрый вход и исторические случаи для разбора','77746D'],['В планах','Отдельный judge, gVisor, рейтинг и подбор','F3F1EC']].forEach(([a,b,color],i)=>{const y=2.3+i*1.4;line(s,.65,y,12.7,y);s.addShape(pptx.ShapeType.ellipse,{x:.7,y:y+.42,w:.18,h:.18,line:{color:i===2?C.ink:color,width:1},fill:{color}});text(s,a,1.15,y+.32,3.1,.65,28,{fontFace:'IBM Plex Sans Condensed',bold:true});text(s,b,4.45,y+.37,8.1,.8,22);});text(s,'Проверки и ограничения: docs/STATUS.md и docs/LIMITATIONS.md',.65,6.95,12,.3,12,{fontFace:'IBM Plex Mono',color:C.muted});
 s=slide(13,'РАЗВИТИЕ','Как усилить изоляцию проверки');
 const isolation=[
  ['Сейчас','Сайт и judge на одном сервере','Решения запускаются в Docker с ограничениями.'],
  ['Шаг 1','Перенести judge на отдельный сервер','Убрать с машины проверки сайт и секреты приложения.'],
  ['Шаг 2','Запускать решения через gVisor','Системные вызовы программы обрабатывает дополнительный слой.'],
 ];
 isolation.forEach(([stage,title,detail],i)=>{
  const y=2.18+i*1.45;
  line(s,.65,y,12.7,y);
  text(s,stage,.65,y+.19,1.6,.53,16,{fontFace:'IBM Plex Mono',color:C.muted});
  text(s,title,2.35,y+.14,10.3,.49,25,{fontFace:'IBM Plex Sans Condensed',bold:true});
  text(s,detail,2.35,y+.72,10.3,.44,18);
 });
 text(s,'Отдельный сервер и gVisor пока в плане.',.65,6.86,12,.33,14,{fontFace:'IBM Plex Mono',color:C.muted});
 s=slide(14,'ПОПРОБОВАТЬ','Откройте свой раунд');s.addImage({data:qr,x:9.45,y:2.15,w:3.15,h:3.15});text(s,'fairround.176.53.244.36.sslip.io',.65,2.45,8.5,1.1,25,{fontFace:'IBM Plex Mono'});text(s,'Демо-доступ — первым блоком на /login',.65,4.05,8.2,.7,25,{fontFace:'IBM Plex Sans Condensed'});text(s,'Организатор · org@demo.local\nУчастник · user1@demo.local\nПароль демо: FairRound2026!',.65,5.2,8.2,1.0,16,{fontFace:'IBM Plex Mono',color:C.muted});text(s,'ПВГУС БРБ24',8.7,5.42,4.05,.25,17,{bold:true});['Шуруто Константин Львович','Калинин Николай Юрьевич','Евсеенко Никита Владимирович','Луньков Илья Павлович','Якимов Александр Борисович'].forEach((name,index)=>text(s,name,8.7,5.76+index*.255,4.05,.25,15));
 await pptx.writeFile({fileName:path.join(root,process.env.PDF_STATIC?'FairRound-static.pptx':'FairRound.pptx')});console.log('Created 14 editable slides');
}
main().catch(e=>{console.error(e);process.exit(1)});
