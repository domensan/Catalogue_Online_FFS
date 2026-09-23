"""Generate a static site and exact-Unicode page manifest; standard library only."""
import json
import re
import shutil
import struct
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def collect_pages():
    pages = {}
    for path in (ROOT / 'img').glob('*.png'):
        match = re.fullmatch(r'Cat_FFS_2027_V2_Página_(\d{2,})\.png', unicodedata.normalize('NFC', path.name))
        if not match:
            continue
        number = int(match[1])
        if number in pages:
            raise ValueError(f'Página duplicada: {number}')
        data = path.read_bytes()
        if data[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError(f'PNG inválido: {path.name}')
        width, height = struct.unpack('>II', data[16:24])
        pages[number] = {'src': path.relative_to(ROOT).as_posix(), 'width': width, 'height': height}
    if not pages or sorted(pages) != list(range(1, max(pages) + 1)):
        raise ValueError('Las páginas deben ser consecutivas desde 01, sin huecos.')
    return [pages[n] for n in sorted(pages)]


def build():
    pages = collect_pages()
    (ROOT / 'pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2) + '\n')
    output = ROOT / '_site'
    if output.exists():
        shutil.rmtree(output)
    (output / 'img').mkdir(parents=True)
    for name in ('index.html', 'styles.css', 'app.js', 'pages.json'):
        shutil.copy2(ROOT / name, output / name)
    shutil.copytree(ROOT / 'vendor', output / 'vendor')
    for page in pages:
        shutil.copy2(ROOT / page['src'], output / page['src'])
    (output / '.nojekyll').touch()
    print(f'Sitio generado: {len(pages)} páginas en _site/')


if __name__ == '__main__':
    build()
