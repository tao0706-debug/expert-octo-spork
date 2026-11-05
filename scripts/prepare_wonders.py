"""Extract twelve generated mist passages and mythical creatures into offline assets."""
import base64
import io
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Path('/workspace/generated_images/exec-605e20d6-a536-4e14-b3aa-9ba6d7224e52.png')
cache=root/'assets/sources/wonders.webp'
image=Image.open(source) if source.exists() else Image.open(cache)
image.convert('RGB').save(cache,'WEBP',quality=97,method=6)
names=['雲鯨負城','飛鰩聖堂','踏雲靈鹿','長羽仙禽','負城靈龜','游天雙鯉','霧中長橋','浮島天梯','古木根橋','幻影雲軌','倒懸瀑布','渡水孤舟']
items=[]
w,h=image.size
for i,name in enumerate(names):
 col,row=i%4,i//4
 box=(round(col*w/4),round(row*h/3),round((col+1)*w/4),round((row+1)*h/3))
 tile=image.crop(box).convert('RGB');buf=io.BytesIO();tile.save(buf,'WEBP',quality=95,method=6)
 items.append(dict(id=i,name=name,kind='creature' if i<6 else 'passage',src='data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode(),box=box))
(root/'assets/wonders-library.js').write_text('window.INK_WONDERS='+json.dumps(dict(version=1,tiles=items),ensure_ascii=False,separators=(',',':'))+';\n')
print('Packaged six mythical creatures and six mist passages.')
