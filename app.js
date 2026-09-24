(async () => {
  const book = document.querySelector('#book');
  const viewer = document.querySelector('#viewer');
  const message = document.querySelector('#message');
  const previous = document.querySelector('#previous');
  const next = document.querySelector('#next');
  const counter = document.querySelector('#counter');
  try {
    const response = await fetch('pages.json');
    if (!response.ok) throw new Error('Unable to load the page list.');
    const pages = await response.json();
    if (!pages.length) throw new Error('The catalog has no pages.');
    const ratio = pages[0].width / pages[0].height;
    const elements = pages.map((page, index) => {
      const element = document.createElement('div');
      element.className = 'page';
      const img = document.createElement('img');
      img.alt = `Page ${index + 1} of the FFS 2027 catalog`;
      img.width = page.width;
      img.height = page.height;
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('error', () => {
        const error = document.createElement('p');
        error.className = 'page-error';
        error.textContent = `Unable to load page ${index + 1}. Reload the viewer to try again.`;
        element.append(error);
      }, { once: true });
      element.append(img);
      book.append(element);
      return element;
    });
    // Assign URLs only near the current spread; hidden pages never download eagerly.
    function preload(index) {
      for (let i = Math.max(0, index - 2); i <= Math.min(pages.length - 1, index + 4); i++) {
        const img = elements[i].querySelector('img');
        if (!img.hasAttribute('src')) img.src = pages[i].src;
      }
    }
    function dimensions() {
      const width = viewer.clientWidth;
      const height = viewer.clientHeight;
      const portrait = width < 700;
      const pageWidth = Math.min(width / (portrait ? 1 : 2), height * ratio);
      book.style.minWidth = '0';
      book.style.width = `${pageWidth * (portrait ? 1 : 2)}px`;
      book.style.height = `${pageWidth / ratio}px`;
      return { width: pageWidth, height: pageWidth / ratio, portrait };
    }
    const size = dimensions();
    const flip = new St.PageFlip(book, {
      width: size.width, height: size.height,
      size: 'stretch', minWidth: size.portrait ? size.width : 100, maxWidth: 1200, minHeight: 100, maxHeight: 1600,
      autoSize: false, usePortrait: true, showCover: true,
      flippingTime: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 650,
      maxShadowOpacity: 0.22, mobileScrollSupport: true,
    });
    function update() {
      const index = flip.getCurrentPageIndex();
      preload(index);
      counter.textContent = `Page ${index + 1} of ${pages.length}`;
      previous.disabled = index === 0;
      const lastVisible = index + (flip.getOrientation() === 'landscape' && index > 0 ? 1 : 0);
      next.disabled = lastVisible >= pages.length - 1;
    }
    flip.on('init', update);
    flip.on('flip', update);
    flip.on('changeOrientation', update);
    preload(0);
    flip.loadFromHTML(elements);
    // showCover preserves single-page covers but forces them rigid by default.
    for (const index of [0, pages.length - 1]) {
      flip.getPage(index).setDensity('soft');
      flip.getPage(index).setDrawingDensity('soft');
    }
    message.hidden = true;
    const review = setupReview({ flip, pages, viewer, book });
    previous.addEventListener('click', () => review.active() ? flip.turnToPrevPage() : flip.flipPrev());
    next.addEventListener('click', () => review.active() ? flip.turnToNextPage() : flip.flipNext());
    document.addEventListener('keydown', event => {
      if (document.querySelector('dialog[open]')) return;
      if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        (event.key === 'ArrowLeft' ? previous : next).click();
      }
    });
    new ResizeObserver(() => {
      const size = dimensions();
      flip.getSettings().minWidth = size.portrait ? size.width : 100;
      flip.update();
      update();
    }).observe(viewer);
  } catch (error) {
    message.hidden = false;
    message.textContent = 'Unable to open the catalog. Check your connection and reload the page.';
    counter.textContent = 'Catalog unavailable';
    console.error(error);
  }
})();
