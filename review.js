function setupReview({ flip, pages, viewer, book }) {
  const toggle = document.querySelector('#review-toggle');
  const status = document.querySelector('#review-status');
  const endpoint = 'https://script.google.com/macros/s/AKfycbxgEUhXzPtsFjo6nI_f4XCQqYiVDQbaGbQQMTVGFrTvk1QgSBI8DlpdfSts_P4YZ4ZcAA/exec';
  let enabled = false;
  let notes = [];
  let selected;
  let opener;
  let saving = false;
  let loading = false;
  let supportsDelete = false;
  const keyFor = id => `ffs-comment-owner:${id}`;
  function ownerToken(id) {
    try { return localStorage.getItem(keyFor(id)); } catch { return null; }
  }
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh comments';
  refresh.hidden = true;
  status.after(refresh);
  refresh.className = 'review-refresh';

  async function request(options = {}) {
    const response = await fetch(endpoint, { ...options, credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Connection failed');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  async function load() {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    status.textContent = 'Loading shared comments…';
    try {
      const data = await request();
      if (!Array.isArray(data.comments) || !data.comments.every(n => n && typeof n.id === 'string' && typeof n.text === 'string' && typeof n.name === 'string' && Number.isInteger(n.page) && n.page >= 1 && n.page <= pages.length && Number.isFinite(n.x) && n.x >= 0 && n.x <= 1 && Number.isFinite(n.y) && n.y >= 0 && n.y <= 1)) throw new Error('Invalid comments');
      supportsDelete = data.version === 2;
      notes = data.comments;
      status.textContent = 'Shared comments. Click a spot to add a comment. Refresh to see updates from other reviewers.';
      draw();
    } catch {
      status.textContent = 'Unable to refresh comments. Previously loaded comments are still shown. Please try again.';
    } finally {
      loading = false;
      refresh.disabled = false;
    }
  }
  refresh.onclick = load;
  const layer = document.createElement('div');
  layer.className = 'review-layer';
  viewer.append(layer);
  const dialog = document.createElement('dialog');
  dialog.className = 'review-dialog';
  dialog.innerHTML = `<form><h2 id="note-title">Add comment</h2>
    <label for="note-name">Your name</label>
    <input id="note-name" autocomplete="name" maxlength="100" required>
    <p id="note-details" class="hint"></p>
    <label for="note-text">Comment</label>
    <textarea id="note-text" rows="4" maxlength="2000" required placeholder="What needs to be updated here?"></textarea>
    <p class="note-error" role="alert"></p>
    <div class="note-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit">Save</button><button type="button" data-action="delete" hidden>Delete comment</button></div>

    </form>`;
  dialog.setAttribute('aria-labelledby', 'note-title');
  document.body.append(dialog);
  const text = dialog.querySelector('textarea');
  const error = dialog.querySelector('.note-error');
  const name = dialog.querySelector('#note-name');
  const submit = dialog.querySelector('[type="submit"]');
  const cancel = dialog.querySelector('[data-action="cancel"]');
  const remove = dialog.querySelector('[data-action="delete"]');
  const details = dialog.querySelector('#note-details');

  async function save() {
    if (saving) return;
    if (!supportsDelete) { error.textContent = 'Comment service update required. Please refresh and try again later.'; return; }
    let token = ownerToken(selected.id);
    try {
      if (!token) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(keyFor(selected.id), token);
      }
    } catch { error.textContent = 'Enable browser storage to save a comment and keep your deletion key.'; return; }
    saving = true;
    submit.disabled = cancel.disabled = name.disabled = text.disabled = true;
    submit.textContent = 'Saving…';
    error.textContent = '';
    // Keep the same ID and payload on retries if the server saved but its reply was lost.
    selected.payload ||= { ...selected, name: name.value.trim(), text: text.value.trim(), ownerToken: token };
    try {
      const result = await request({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(selected.payload) });
      if (result.id !== selected.id) throw new Error('Save was not confirmed');
      const { ownerToken: privateKey, ...publicNote } = selected.payload;
      notes.push({ ...publicNote, createdAt: new Date().toISOString() });
      dialog.close();
      draw();
      status.textContent = 'Saved to the shared review sheet. Other reviewers can refresh to see your comment.';
    } catch {
      error.textContent = 'Save not confirmed. Your comment is still here. Click Retry save to check or finish saving the same comment.';
    } finally {
      saving = false;
      submit.disabled = cancel.disabled = name.disabled = text.disabled = false;
      name.readOnly = text.readOnly = Boolean(selected.payload);
      submit.textContent = 'Retry save';
    }
  }
  function openNote(note, index, anchor) {
    selected = note;
    opener = anchor;
    const existing = notes.some(n => n.id === note.id);
    text.value = note.text;
    name.value = note.name || '';
    name.readOnly = text.readOnly = existing;
    submit.hidden = existing;
    remove.hidden = !existing || !supportsDelete || !ownerToken(note.id);
    submit.textContent = 'Save';
    cancel.textContent = existing ? 'Close' : 'Cancel';
    details.textContent = existing ? `${note.resolved ? 'Resolved' : 'Open'} · ${note.createdAt ? new Date(note.createdAt).toLocaleString('en-US') : ''}` : 'Your name and comment will be visible to everyone with the catalog link. You can delete your own comments from this browser.';
    error.textContent = '';
    dialog.querySelector('h2').textContent = `${existing ? 'Comment' : 'Add comment'} · Page ${index + 1}`;

    dialog.showModal();
    const rect = anchor.getBoundingClientRect();
    dialog.style.left = `${Math.max(12, Math.min(rect.right + 12, innerWidth - dialog.offsetWidth - 12))}px`;
    dialog.style.top = `${Math.max(12, Math.min(rect.top, innerHeight - dialog.offsetHeight - 12))}px`;
    (existing ? cancel : name).focus();
  }
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (notes.some(note => note.id === selected.id)) return;
    if (!text.value.trim() || !name.value.trim()) { error.textContent = 'Enter your name and a comment before saving.'; return; }
    save();
  });
  remove.onclick = async () => {
    const token = ownerToken(selected.id);
    if (saving || !token || !confirm('Delete this comment for everyone? This cannot be undone.')) return;
    saving = true;
    remove.disabled = cancel.disabled = true;
    remove.textContent = 'Deleting…';
    error.textContent = '';
    try {
      const result = await request({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action: 'delete', id: selected.id, ownerToken: token }) });
      if (result.id !== selected.id || result.deleted !== true) throw new Error('Deletion not confirmed');
      notes = notes.filter(note => note.id !== selected.id);
      try { localStorage.removeItem(keyFor(selected.id)); } catch { /* Already deleted on the server. */ }
      dialog.close();
      draw();
      status.textContent = 'Comment deleted from the shared review sheet.';
    } catch { error.textContent = 'Deletion not confirmed. Please try again; retrying will not affect other comments.'; }
    finally {
      saving = false;
      remove.disabled = cancel.disabled = false;
      remove.textContent = 'Delete comment';
    }
  };
  cancel.onclick = () => dialog.close();
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
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
        if (loading) return;
        openNote({ id: crypto.randomUUID(), page: i + 1, x, y, text: '', resolved: false }, i, anchor);
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
        if (note.page !== i + 1) return;
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
    status.hidden = refresh.hidden = !enabled;
    if (enabled) load();
    document.querySelector('.hint').hidden = enabled;
    draw();
  };
  flip.on('changeState', event => { toggle.disabled = event.data !== 'read'; });
  flip.on('flip', () => requestAnimationFrame(draw));
  flip.on('changeOrientation', () => requestAnimationFrame(draw));
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(viewer);
  return { active: () => enabled };
}
