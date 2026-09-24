// FFS Catalog review: public read/add only; manage comments in the private Sheet.
const SPREADSHEET_ID = '1LMfiDG1WuCj6wvtCitj4_iDcCddZ72R1o2OqZFYkLA4';
const TAB = 'Comments';
const HEADERS = ['ID', 'Created at', 'Page', 'X', 'Y', 'Name', 'Comment', 'Status'];

function setup() {
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = book.getSheetByName(TAB) || book.insertSheet(TAB);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setColumnWidth(7, 400);
  }
  commentsSheet_();
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
    return json_({ ok: true, comments });
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

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const body = event && event.postData && event.postData.contents;
    if (!body || body.length > 16000) return json_({ ok: false, error: 'Invalid comment.' });
    const note = JSON.parse(body);
    if (!validate_(note)) return json_({ ok: false, error: 'Enter a name and a valid comment.' });
    lock.waitLock(10000);
    const sheet = commentsSheet_();
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : [];
    // Retrying an interrupted request must not create a second comment.
    if (!ids.includes(note.id)) {
      sheet.appendRow([note.id, new Date().toISOString(), note.page, note.x, note.y,
        literal_(note.name), literal_(note.text), 'Open']);
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
