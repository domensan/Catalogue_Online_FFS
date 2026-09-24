// Public read/add; deletion requires the private token held by the author browser.
const SPREADSHEET_ID = '1LMfiDG1WuCj6wvtCitj4_iDcCddZ72R1o2OqZFYkLA4';
const TAB = 'Comments';
const HEADERS = ['ID', 'Created at', 'Page', 'X', 'Y', 'Name', 'Comment', 'Status', 'Owner hash'];

function setup() {
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = book.getSheetByName(TAB) || book.insertSheet(TAB);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setColumnWidth(7, 400);
  }
  const oldHeaders = sheet.getRange(1, 1, 1, 8).getValues()[0];
  if (JSON.stringify(oldHeaders) === JSON.stringify(HEADERS.slice(0, 8)) && !sheet.getRange(1, 9).getValue()) {
    sheet.getRange(1, 9).setValue('Owner hash');
  }
  commentsSheet_();
}

// Run only from the Apps Script editor. Never exposed through doGet/doPost.
function resetComments() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setup();
    const sheet = commentsSheet_();
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).clearContent();
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}

function commentsSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TAB);
  if (!sheet || JSON.stringify(sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]) !== JSON.stringify(HEADERS)) {
    throw new Error('Run setup first and keep the Comments headers unchanged.');
  }
  return sheet;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try {
    const sheet = commentsSheet_();
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues() : [];
    const comments = rows.filter(row => row[0]).map(row => ({
      id: String(row[0]), createdAt: row[1], page: Number(row[2]),
      x: Number(row[3]), y: Number(row[4]), name: String(row[5]), text: String(row[6]),
      resolved: String(row[7]).trim().toLowerCase() === 'resolved'
    }));
    return json_({ ok: true, version: 2, comments });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'Unable to load comments. Please try again.' });
  }
}

function validate_(note) {
  return note && typeof note.id === 'string' && /^[a-f0-9-]{36}$/i.test(note.id)
    && Number.isInteger(note.page) && note.page >= 1 && note.page <= 48
    && Number.isFinite(note.x) && note.x >= 0 && note.x <= 1
    && Number.isFinite(note.y) && note.y >= 0 && note.y <= 1
    && typeof note.name === 'string' && note.name.trim().length > 0 && note.name.length <= 100
    && typeof note.text === 'string' && note.text.trim().length > 0 && note.text.length <= 2000;
}

// The apostrophe makes user input literal text, never a spreadsheet formula.
function literal_(value) {
  return "'" + value.trim();
}

function ownerHash_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
    .map(byte => (byte & 255).toString(16).padStart(2, '0')).join('');
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const body = event && event.postData && event.postData.contents;
    if (!body || body.length > 16000) return json_({ ok: false, error: 'Invalid comment.' });
    const note = JSON.parse(body);
    if (!note || typeof note.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(note.id)
        || typeof note.ownerToken !== 'string' || !/^[a-f0-9]{64}$/.test(note.ownerToken)) {
      return json_({ ok: false, error: 'Missing comment ownership key.' });
    }
    const action = note.action || 'create';
    if (!['create', 'delete'].includes(action)) return json_({ ok: false, error: 'Invalid action.' });
    if (action === 'create' && !validate_(note)) return json_({ ok: false, error: 'Enter a name and a valid comment.' });
    lock.waitLock(10000);
    const sheet = commentsSheet_();
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues() : [];
    const index = rows.findIndex(row => row[0] === note.id);
    const hash = ownerHash_(note.ownerToken);
    if (index !== -1 && rows[index][8] !== hash) return json_({ ok: false, error: 'Only the author can delete this comment.' });
    if (action === 'delete') {
      if (index !== -1) sheet.deleteRow(index + 2);
      SpreadsheetApp.flush();
      return json_({ ok: true, id: note.id, deleted: true });
    }
    // The same ID and ownership key make interrupted saves safe to retry.
    if (index === -1) {
      sheet.appendRow([note.id, new Date().toISOString(), note.page, note.x, note.y,
        literal_(note.name), literal_(note.text), 'Open', hash]);
      SpreadsheetApp.flush();
    }
    return json_({ ok: true, id: note.id });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'Unable to save. Please try again.' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
