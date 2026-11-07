"""Rebuild editable PPTX, a static PDF, and all review previews in one command."""
import os,pathlib,subprocess,json,shutil,zipfile,hashlib
import fitz
from PIL import Image,ImageDraw
root=pathlib.Path(__file__).resolve().parents[2];os.chdir(root);p=root/'presentation'
def run(args,**kwargs):subprocess.run(args,check=True,**kwargs)
dimensions={f.name:list(Image.open(f).size) for f in (p/'assets').iterdir() if f.suffix.lower() in ['.png','.jpg']};(p/'assets/dimensions.json').write_text(json.dumps(dimensions,indent=2))
if subprocess.run(['docker','image','inspect','fairround-presentation-tools'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:run(['docker','build','-t','fairround-presentation-tools','-f','presentation/build/Dockerfile','presentation'])
env={**os.environ,'PDF_STATIC':'1'};run(['node','presentation/build/build.cjs'],env=env);run(['python','presentation/build/grayscale.py','FairRound-static.pptx'])
run(['docker','run','--rm','-v',str(p).replace('\\','/')+':/work','fairround-presentation-tools','/work/FairRound-static.pptx'])
shutil.copyfile(p/'FairRound-static.pdf',p/'FairRound.pdf');doc=fitz.open(p/'FairRound.pdf');assert len(doc)==14
sheet=Image.new('RGB',(1600,1000),'#ddd');(p/'previews').mkdir(exist_ok=True)
for i,page in enumerate(doc):
 page.get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(str(p/'previews'/f'{i+1:02}.png'));im=Image.open(p/'previews'/f'{i+1:02}.png');im.thumbnail((400,225));sheet.paste(im,((i%4)*400,(i//4)*250));ImageDraw.Draw(sheet).text(((i%4)*400+5,(i//4)*250+230),str(i+1),fill='black')
sheet.save(p/'previews/contact-revised.png');doc.close();(p/'FairRound-static.pdf').unlink();(p/'FairRound-static.pptx').unlink()
env=dict(os.environ);env.pop('PDF_STATIC',None);run(['node','presentation/build/build.cjs'],env=env);run(['python','presentation/build/grayscale.py'])
with zipfile.ZipFile(p/'FairRound.pptx') as z:
 assert len([n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')])==14
 video=next(n for n in z.namelist() if n.endswith('.mp4'));assert hashlib.sha256(z.read(video)).digest()==hashlib.sha256((p/'FairRound-demo-short.mp4').read_bytes()).digest()
print('Verified: 14 PDF pages, 14 editable slide XMLs, matching embedded MP4, 14 previews')
