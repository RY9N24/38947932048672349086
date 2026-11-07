"""Apply native OOXML grayscale to stock-photo picture objects, not screenshots."""
import pathlib,zipfile,xml.etree.ElementTree as ET,sys
p=pathlib.Path(__file__).resolve().parents[1]/(sys.argv[1] if len(sys.argv)>1 else 'FairRound.pptx')
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(p) as source:
 files={n:source.read(n) for n in source.namelist()}
count=0
for name,data in list(files.items()):
 if name.startswith('ppt/slides/slide') and name.endswith('.xml'):
  root=ET.fromstring(data)
  for pic in root.findall('.//p:pic',ns):
   meta=pic.find('p:nvPicPr/p:cNvPr',ns)
   if meta is not None and meta.get('descr','').startswith('photo:'):
    blip=pic.find('p:blipFill/a:blip',ns)
    ET.SubElement(blip,'{'+ns['a']+'}grayscl');count+=1
    if meta.get('descr')=='photo:clock.jpg':
     rect=pic.find('p:blipFill/a:srcRect',ns)
     if rect is None:rect=ET.SubElement(pic.find('p:blipFill',ns),'{'+ns['a']+'}srcRect')
     rect.attrib.update({'l':'2222','r':'69444','t':'18333','b':'32917'})
  files[name]=ET.tostring(root,encoding='utf-8',xml_declaration=True)
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as target:
 for name,data in files.items():target.writestr(name,data)
assert count==2,count
print('Native grayscale applied to',count,'stock photographs')
