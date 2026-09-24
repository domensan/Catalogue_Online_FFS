"""Validate page order, dimensions and exact filenames before deploying."""
from build import ROOT, collect_pages, find_pdf

pages = collect_pages()
assert len(pages) >= 1
for number, page in enumerate(pages, 1):
    assert (ROOT / page['src']).is_file(), page['src']
    assert page['src'].endswith(f'_{number:02}.png'), page['src']
    assert page['width'] > 0 and page['height'] > 0
    assert abs(page['width'] / page['height'] - pages[0]['width'] / pages[0]['height']) < 0.01
pdf = find_pdf()
print(f'OK: {len(pages)} páginas consecutivas, rutas y proporciones verificadas. PDF: {pdf.name}')
