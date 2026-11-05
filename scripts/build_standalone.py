"""Build a portable HTML file with all styles, logic and AI materials embedded."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + (root / 'style.css').read_text() + '\n</style>')
for name in ('assets/ink-library.js', 'assets/scroll-materials.js', 'app.js'):
    script = (root / name).read_text().replace('</script', '<\\/script')
    html = html.replace(f'<script src="{name}"></script>', '<script>\n' + script + '\n</script>')
output = root / '无何有之乡.html'
output.write_text(html)
print(f'{output.name}: {output.stat().st_size/1024/1024:.2f} MiB, no external resources')
