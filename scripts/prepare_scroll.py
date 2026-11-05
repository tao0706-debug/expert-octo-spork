"""Extract and embed generated paper, brush calligraphy and seal impressions."""
import base64
import io
import json
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = Path('/workspace/generated_images')
out = root/'assets'/'scroll'
out.mkdir(exist_ok=True)
files = {
 'paper': 'exec-8201bade-49ea-4764-9c62-a64b26ba25cb.png',
 'letters': 'exec-0133f1f6-1908-476b-8a80-3fb97e66ebf9.png',
 'seals': 'exec-dd229cc4-8e23-42f8-a7f1-06ababfae424.png',
}
images = {}
for name, filename in files.items():
    path = source/filename
    img = Image.open(path) if path.exists() else Image.open(out/f'{name}.webp')
    img.save(out/f'{name}.webp', 'WEBP', lossless=name!='paper', quality=96, method=6)
    images[name] = img

def encode(img):
    b=io.BytesIO();img.save(b, 'WEBP', lossless=img.mode=='RGBA', quality=94, method=6)
    return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()

payload = dict(paper=encode(images['paper']), title=encode(images['letters'].crop((130,0,520,1024))),
               inscription=encode(images['letters'].crop((575,0,1536,1024))), seals=encode(images['seals']))
(root/'assets'/'scroll-materials.js').write_text('window.SCROLL_MATERIALS='+json.dumps(payload,separators=(',',':'))+';\n')
print('Embedded antique paper, brush title, inscription, six seal impressions')
