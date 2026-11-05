"""Subset the licensed upright Kai font for offline UI use. Requires fontTools+woff2."""
import argparse
import base64
import json
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('source',nargs='?',default='/tmp/atlas-font-source/DyslexicKaiMono-Regular.ttf')
args=parser.parse_args()
source=Path(args.source)
if not source.exists():raise SystemExit('Obtain source and LICENSE from https://github.com/DraftingDreamer/FontDyslexicKai first.')
font=TTFont(source)
text=''.join((root/n).read_text() for n in ['index.html','app.js','style.css'])+''.join(chr(i) for i in range(32,127))
options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.notdef_outline=True
sub=subset.Subsetter(options=options);sub.populate(text=text);sub.subset(font)
# Respect the upstream reserved font name for this subsetted derivative.
for rec in list(font['name'].names):
 if rec.nameID in [1,4,6,16,17]:
  name={1:'Atlas ZhengKai',4:'Atlas ZhengKai Regular',6:'AtlasZhengKai-Regular',16:'Atlas ZhengKai',17:'Regular'}[rec.nameID]
  font['name'].setName(name,rec.nameID,rec.platformID,rec.platEncID,rec.langID)
font.flavor='woff2'
out=root/'assets/fonts/atlas-zhengkai.woff2';font.save(out)
(root/'assets/font-library.js').write_text('// Regular-script UI font, subset with upstream notices preserved.\nwindow.ATLAS_FONT = '+json.dumps('url(data:font/woff2;base64,'+base64.b64encode(out.read_bytes()).decode()+') format("woff2")')+';\n')
(root/'assets/fonts/NOTICE.txt').write_text('Atlas ZhengKai is a subsetted, renamed derivative of DyslexicKai Mono.\nCJK glyphs: Huiwen-ZhengKai, Copyright 2022 TerryWang, custom free commercial-use license.\nLatin glyphs: OpenDyslexic 3, Copyright Abelardo Gonzalez, SIL OFL 1.1.\nSource: https://github.com/DraftingDreamer/FontDyslexicKai\nSource commit: c7ff010c15af692d6d98df111404a6b867f972f6\nAll upstream copyright and license metadata are retained in the font.\nSee LICENSE.txt for the complete, unchanged upstream dual-license terms. Font files may not be sold.\n')
print(f'Embedded upright Kai font: {out.stat().st_size/1024:.1f} KiB, {len(set(text))} requested characters')
