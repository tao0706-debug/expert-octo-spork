"""Replace only the small right-hand inscription; preserve all other scroll materials."""
import base64
import io
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Path('/workspace/generated_images/exec-7afff9a7-8f48-4a2b-929d-929a43599a06.png')
cache=root/'assets/scroll/colophon-shoujin.webp'
image=Image.open(source) if source.exists() else Image.open(cache)
image.save(cache,'WEBP',lossless=True,method=6)
path=root/'assets/scroll-materials.js'
payload=json.loads(path.read_text().split('=',1)[1].strip().rstrip(';'))
preserved={key:payload[key] for key in ['paper','title','seals']}
buf=io.BytesIO();image.save(buf,'WEBP',lossless=True,method=6)
payload['inscription']='data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()
assert all(payload[key]==value for key,value in preserved.items())
path.write_text('window.SCROLL_MATERIALS='+json.dumps(payload,separators=(',',':'))+';\n')
print('Updated inscription only. Paper, title, and seals preserved byte-for-byte.')
