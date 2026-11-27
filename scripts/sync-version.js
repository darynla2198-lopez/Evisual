#!/usr/bin/env node
// Un solo número de versión: package.json manda.
// Copia la versión a sw.js, version.json e index.html (APP_V y la lista de Novedades).
// Las notas de cada versión se escriben solo en version.json.
//
//   node scripts/sync-version.js          actualiza los archivos
//   node scripts/sync-version.js --check  solo revisa (falla si algo no coincide)
//
// Con "npm version 1.0.3" (o "npm version 1.0.3-beta.1") se ejecuta solo.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = f => path.join(root, f);
const read = f => fs.readFileSync(file(f), 'utf8');
const check = process.argv.includes('--check');

const version = require(file('package.json')).version;
const errors = [];
const changed = [];

// version.json: la primera nota debe ser la de esta versión.
const vj = JSON.parse(read('version.json'));
const notes = Array.isArray(vj.notes) ? vj.notes : [];
if (!notes.length || notes[0].v !== version) {
  errors.push(`version.json no tiene notas para ${version}. Agrega arriba de "notes" una entrada {"v": "${version}", "d": "AAAA-MM-DD", "n": ["..."]}.`);
}
if (errors.length && !check) { console.error('- ' + errors.join('\n- ')); process.exit(1); }
const date = (notes[0] && notes[0].v === version && notes[0].d) || vj.date;

function update(name, before, after) {
  if (before === after) return;
  if (check) errors.push(`${name} no coincide con la versión ${version}.`);
  else { fs.writeFileSync(file(name), after); changed.push(name); }
}

update('version.json', read('version.json'),
  JSON.stringify({ ...vj, version, date }, null, 2) + '\n');

const sw = read('sw.js');
if (!/const VERSION = '[^']*';/.test(sw)) errors.push('sw.js: no encontré la línea const VERSION.');
update('sw.js', sw, sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));

const html = read('index.html');
if (!/const APP_V=\(NAT&&NAT\.version\)\|\|'[^']*'/.test(html)) errors.push('index.html: no encontré APP_V.');
if (!/^const NOTES=.*;$/m.test(html)) errors.push('index.html: no encontré la línea const NOTES.');
const notesJs = JSON.stringify(notes.map(({ v, d, n }) => ({ v, d, n })));
update('index.html', html,
  html.replace(/const APP_V=\(NAT&&NAT\.version\)\|\|'[^']*'/, `const APP_V=(NAT&&NAT.version)||'${version}'`)
      .replace(/^const NOTES=.*;$/m, () => `const NOTES=${notesJs};`));

if (errors.length) {
  console.error('Versión ' + version + ':\n- ' + errors.join('\n- '));
  if (check) console.error('Ejecuta: npm run version:sync');
  process.exit(1);
}
console.log(check ? `Todo coincide con la versión ${version}.`
  : changed.length ? `Versión ${version} copiada a: ${changed.join(', ')}.` : `Todo ya estaba en la versión ${version}.`);
