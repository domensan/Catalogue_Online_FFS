const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({});
vm.runInContext(readFileSync('apps-script/Code.gs', 'utf8'), context);
const note = { id: '11111111-1111-4111-8111-111111111111', page: 48, x: 0, y: 1, name: 'Reviewer', text: 'Check this image' };
assert(context.validate_(note));
for (const change of [{page: 0}, {page: 49}, {x: -1}, {y: NaN}, {name: ''}, {text: ' '}, {text: 'a'.repeat(2001)}, {id: 'bad'}]) {
  assert(!context.validate_({...note, ...change}));
}
assert.equal(context.literal_('=IMPORTXML("url")'), '\'=IMPORTXML("url")');
console.log('PASS: comment validation, page bounds, and literal spreadsheet text');
