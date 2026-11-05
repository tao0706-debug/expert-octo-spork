"""Build a portable HTML file; accept versioned asset URLs used by public hosting."""
import re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
html = (root/'index.html').read_text(encoding='utf-8')
style = (root/'style.css').read_text(encoding='utf-8')
html = re.sub(r'<link rel="stylesheet" href="style\.css(?:\?[^\"]*)?">', lambda _: '<style>\n'+style+'\n</style>', html)
for name in ('assets/font-library.js','assets/ink-library.js','assets/scroll-materials.js','assets/wonders-library.js','app.js'):
    script = (root/name).read_text(encoding='utf-8').replace('</script','<\\/script')
    pattern = r'<script src="'+re.escape(name)+r'(?:\?[^\"]*)?"></script>'
    html = re.sub(pattern, lambda _, content=script: '<script>\n'+content+'\n</script>', html)
assert '<script src=' not in html, 'Unbundled script reference'
assert 'rel="stylesheet"' not in html, 'Unbundled stylesheet'
output = root/'无何有之乡.html'
output.write_text(html,encoding='utf-8')
print(f'{output.name}: {output.stat().st_size/1024/1024:.2f} MiB, no external resources')
