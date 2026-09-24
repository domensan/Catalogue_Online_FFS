const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({});
vm.runInContext(readFileSync('apps-script/Code.gs', 'utf8'), context);
const note = { id: '11111111-1111-4111-8111-111111111111', page: 48, x: 0, y: 1, name: 'Reviewer', text: 'Check this image', ownerToken: 'a'.repeat(64) };
assert(context.validate_(note));
for (const change of [{page: 0}, {page: 49}, {x: -1}, {y: NaN}, {name: ''}, {text: ' '}, {text: 'a'.repeat(2001)}, {id: 'bad'}]) {
  assert(!context.validate_({...note, ...change}));
}
assert.equal(context.literal_('=IMPORTXML("url")'), '\'=IMPORTXML("url")');
console.log('PASS: comment validation, page bounds, and literal spreadsheet text');

// Exercise the actual read/write handlers around a row deletion, without touching Sheets.
const headers = ['ID', 'Created at', 'Page', 'X', 'Y', 'Name', 'Comment', 'Status', 'Owner hash'];
const rows = [headers];
const sheet = {
  getLastRow: () => rows.length,
  getRange: (row, column, count = 1, width = 1) => ({
    getValue: () => rows[row - 1]?.[column - 1] || '',
    clearContent: () => rows.splice(row - 1, count),
    getValues: () => rows.slice(row - 1, row - 1 + count).map(r => r.slice(column - 1, column - 1 + width)),
  }),
  appendRow: row => rows.push(row),
  deleteRow: row => rows.splice(row - 1, 1),
};
let locked = false;
Object.assign(context, {
  console,
  Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, token) => [...require('node:crypto').createHash(algorithm).update(token).digest()] },
  SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
  LockService: { getScriptLock: () => ({ waitLock() { locked = true; }, hasLock: () => locked, releaseLock() { locked = false; } }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
});
const post = value => context.doPost({ postData: { contents: JSON.stringify(value) } });
assert(post(note).ok);
assert(post(note).ok);
assert.equal(rows.length, 2, 'retry does not duplicate');
rows.splice(1, 1); // Owner deletes the comment row, preserving headers.
assert.equal(context.doGet().comments.length, 0);
const nextNote = { ...note, id: '22222222-2222-4222-8222-222222222222' };
assert(post(nextNote).ok);
assert.equal(rows.length, 2);
assert.equal(context.doGet().comments[0].id, nextNote.id);
assert.equal(locked, false);
console.log('PASS: deleting the only comment row preserves subsequent saves and reads');

assert(!JSON.stringify(context.doGet()).includes(note.ownerToken), 'never expose raw ownership keys');
assert(!JSON.stringify(context.doGet()).includes(context.ownerHash_(note.ownerToken)), 'never expose key hashes');
assert(!post({action: 'delete', id: nextNote.id, ownerToken: 'b'.repeat(64)}).ok, 'wrong browser cannot delete');
assert.equal(context.doGet().comments.length, 1);
assert(!post({...nextNote, ownerToken: 'b'.repeat(64)}).ok, 'cannot claim an existing ID');
assert(post({action: 'delete', id: nextNote.id, ownerToken: note.ownerToken}).deleted);
assert.equal(context.doGet().comments.length, 0);
assert(post({action: 'delete', id: nextNote.id, ownerToken: note.ownerToken}).deleted, 'delete retry succeeds');
assert(post(note).ok, 'saving still works after deletion');
assert(!post({ action: 'reset', id: note.id, ownerToken: note.ownerToken }).ok, 'no public reset');
context.resetComments();
assert.equal(rows.length, 1, 'reset retains headers only');
assert(post(nextNote).ok, 'saving works after reset');
console.log('PASS: server-enforced ownership, private keys, safe retries, editor-only reset and later saves');
