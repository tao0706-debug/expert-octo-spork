"""Package the generated source sheets as 48 offline, individually selectable ink assets.
Run from the repository root. Cropping is asset extraction, not new image generation.
"""
import base64
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
(OUT / 'sources').mkdir(parents=True, exist_ok=True)
INPUT = Path('/workspace/generated_images')
SHEETS = [
    ('gothic', 'exec-86f84463-9a11-492c-964d-9d27c9facf4d.png',
     '悬空议会,有机圣堂,倒悬港口,螺旋水道,西班牙市集,镜像双城,曲线街区,断裂塔桥,浮空车站,自由之岛,迷宫广场,古典碎屿'),
    ('future', 'exec-1cee118a-70ab-4037-81aa-f8b7f9c3bc7b.png',
     '瀑布巨构,扭转天际线,折纸街城,倒置曼哈顿,轨道港,未来车库,流线博物馆,悬崖别墅,球形城市,未来货港,环轨结,悬挑都市'),
    ('geography', 'exec-756602d3-9eb8-45ea-8fda-6e35fa1ccdcb.png',
     '逆流之河,双面山城,漂浮群岛,倒悬山脊,工业丛林,回环石桥,层叠街市,飞艇之城,瀑布阶城,异构机场,沉没环城,碎石美术馆'),
]

def encoded(im, quality=93):
    buf = io.BytesIO()
    im.convert('RGB').save(buf, 'WEBP', quality=quality, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')

tiles = []
manifest = []
for group, source, names in SHEETS:
    cached = OUT / 'sources' / f'{group}.webp'
    image = Image.open(INPUT / source) if (INPUT / source).exists() else Image.open(cached)
    image.convert('RGB').save(cached, 'WEBP', quality=97, method=6)
    w, h = image.size
    for i, name in enumerate(names.split(',')):
        col, row = i % 4, i // 4
        box = (round(col*w/4), round(row*h/3), round((col+1)*w/4), round((row+1)*h/3))
        tile = image.crop(box)
        meta = dict(id=len(tiles), name=name, group=group, width=tile.width, height=tile.height,
                    source=f'sources/{group}.webp', box=list(box))
        tiles.append(dict(meta, src=encoded(tile)))
        manifest.append(meta)

panorama_cache = OUT / 'sources' / 'panorama.webp'
original = INPUT / 'exec-6fe97041-a1ba-4460-bd88-b0432ac27199.png'
panorama = Image.open(original) if original.exists() else Image.open(panorama_cache)
panorama.convert('RGB').save(panorama_cache, 'WEBP', quality=97, method=6)
# Extract broader panorama fragments, excluding the right-hand calligraphy.
w, h = panorama.size
region = (0, 0, round(w*.88), round(h*.94))
for i in range(12):
    col, row = i % 4, i // 4
    box = (round(col*region[2]/4), round(row*region[3]/3), round((col+1)*region[2]/4), round((row+1)*region[3]/3))
    tile = panorama.crop(box)
    meta = dict(id=len(tiles), name=f'失落地志·{i+1:02d}', group='panorama', width=tile.width, height=tile.height,
                source='sources/panorama.webp', box=list(box))
    tiles.append(dict(meta, src=encoded(tile)))
    manifest.append(meta)

payload = dict(version=3, description='Repainted gongbi-xieyi ink: 36 scene vignettes and 12 landscape fragments',
               panorama=encoded(panorama), tiles=tiles)
(OUT / 'ink-library.js').write_text('// Self-contained AI-painted materials. No fetch, CDN, API key or server needed.\nwindow.INK_ASSETS = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')
(OUT / 'manifest.json').write_text(json.dumps(dict(version=3, count=len(tiles), assets=manifest), ensure_ascii=False, indent=2))
print(f'Packaged {len(tiles)} assets: {(OUT / "ink-library.js").stat().st_size/1024/1024:.2f} MiB')
