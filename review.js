function setupReview({ flip, pages, viewer, book }) {
  const toggle = document.querySelector('#review-toggle');
  const status = document.querySelector('#review-status');
  const storageKey = 'ffs-catalog-review-v1';
  let enabled = false;
  let notes = [];
  let selected;
  let opener;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(stored) || !stored.every(n => n && typeof n.id === 'string' && typeof n.page === 'string' && typeof n.text === 'string' && Number.isFinite(n.x) && n.x >= 0 && n.x <= 1 && Number.isFinite(n.y) && n.y >= 0 && n.y <= 1)) throw new Error('Invalid notes');
    notes = stored;
  } catch {
    status.textContent = 'Unable to retrieve saved comments. They will not be overwritten. Check your browser storage.';
    status.hidden = false;
    return { active: () => false };
  }
  const layer = document.createElement('div');
  layer.className = 'review-layer';
  viewer.append(layer);
  const dialog = document.createElement('dialog');
  dialog.className = 'review-dialog';
  dialog.innerHTML = `<form><h2 id="note-title">Add comment</h2>
    <label for="note-text">Comment</label>
    <textarea id="note-text" rows="4" maxlength="2000" required placeholder="What needs to be updated here?"></textarea>
    <p class="note-error" role="alert"></p>
    <div class="note-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit">Save</button></div>
    <div class="note-actions"><button type="button" data-action="resolve">Mark as resolved</button><button type="button" data-action="delete">Delete comment</button></div>
    </form>`;
  dialog.setAttribute('aria-labelledby', 'note-title');
  document.body.append(dialog);
  const text = dialog.querySelector('textarea');
  const error = dialog.querySelector('.note-error');
  const resolve = dialog.querySelector('[data-action="resolve"]');
  const remove = dialog.querySelector('[data-action="delete"]');
  const pageKey = index => pages[index].src.normalize('NFC');

  function save(updated) {
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); }
    catch { error.textContent = 'Unable to save. Browser storage may be full or blocked. Your text is still here.'; return; }
    notes = updated;
    dialog.close();
    draw();
  }
  function openNote(note, index, anchor) {
    selected = note;
    opener = anchor;
    const existing = notes.some(n => n.id === note.id);
    text.value = note.text;
    error.textContent = '';
    dialog.querySelector('h2').textContent = `${existing ? 'Comment' : 'Add comment'} · Page ${index + 1}`;
    resolve.hidden = remove.hidden = !existing;
    resolve.textContent = note.resolved ? 'Reopen comment' : 'Mark as resolved';
    dialog.showModal();
    const rect = anchor.getBoundingClientRect();
    dialog.style.left = `${Math.max(12, Math.min(rect.right + 12, innerWidth - dialog.offsetWidth - 12))}px`;
    dialog.style.top = `${Math.max(12, Math.min(rect.top, innerHeight - dialog.offsetHeight - 12))}px`;
    text.focus();
  }
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (!text.value.trim()) { error.textContent = 'Enter a comment before saving.'; return; }
    const note = { ...selected, text: text.value.trim() };
    save(notes.some(n => n.id === note.id) ? notes.map(n => n.id === note.id ? note : n) : [...notes, note]);
  });
  dialog.querySelector('[data-action="cancel"]').onclick = () => dialog.close();
  resolve.onclick = () => save(notes.map(n => n.id === selected.id ? { ...n, resolved: !n.resolved } : n));
  remove.onclick = () => save(notes.filter(n => n.id !== selected.id));
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); else toggle.focus(); });

  function draw() {
    layer.replaceChildren();
    if (!enabled) return;
    const index = flip.getCurrentPageIndex();
    const visible = [index];
    if (flip.getOrientation() === 'landscape' && index > 0 && index + 1 < pages.length) visible.push(index + 1);
    const outer = viewer.getBoundingClientRect();
    for (const i of visible) {
      const rect = flip.getPage(i).getElement().getBoundingClientRect();
      const surface = document.createElement('div');
      surface.className = 'review-surface';
      Object.assign(surface.style, { left: `${rect.left - outer.left}px`, top: `${rect.top - outer.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      surface.tabIndex = 0;
      surface.setAttribute('role', 'group');
      surface.setAttribute('aria-label', `Annotate page ${i + 1}. Click a spot or press Enter to comment at the center.`);
      function create(x, y, anchor) {
        openNote({ id: crypto.randomUUID(), page: pageKey(i), x, y, text: '', resolved: false }, i, anchor);
      }
      surface.onclick = event => {
        if (event.target !== surface) return;
        const bounds = surface.getBoundingClientRect();
        create(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)), {getBoundingClientRect: () => ({ right: event.clientX, top: event.clientY })});
      };
      surface.onkeydown = event => {
        if (event.target === surface && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); create(.5, .5, surface); }
      };
      notes.forEach((note, number) => {
        if (note.page !== pageKey(i)) return;
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = `review-pin${note.resolved ? ' resolved' : ''}`;
        pin.textContent = number + 1;
        pin.style.left = `clamp(18px, ${note.x * 100}%, calc(100% - 18px))`;
        pin.style.top = `clamp(18px, ${note.y * 100}%, calc(100% - 18px))`;
        pin.title = note.text;
        pin.setAttribute('aria-label', `Comment ${number + 1}, ${note.resolved ? 'resolved' : 'open'}: ${note.text}`);
        pin.onclick = () => openNote(note, i, pin);
        surface.append(pin);
      });
      layer.append(surface);
    }
  }
  toggle.disabled = false;
  toggle.onclick = () => {
    enabled = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? 'Exit review' : 'Review mode';
    book.style.pointerEvents = enabled ? 'none' : '';
    flip.getSettings().showPageCorners = !enabled;
    status.hidden = !enabled;
    document.querySelector('.hint').hidden = enabled;
    draw();
  };
  flip.on('changeState', event => { toggle.disabled = event.data !== 'read'; });
  flip.on('flip', () => requestAnimationFrame(draw));
  flip.on('changeOrientation', () => requestAnimationFrame(draw));
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(viewer);
  return { active: () => enabled };
}
