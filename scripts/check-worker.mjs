import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = await readFile('dist/server/index.js', 'utf8');
assert.doesNotMatch(source, /\bfrom\s*["']node:/, 'Hosted Worker must not require Node-only imports');
const { default: worker } = await import(pathToFileURL(resolve('dist/server/index.js')).href);
assert.equal(typeof worker.fetch, 'function');
const root = await worker.fetch(new Request('https://afterkey.test/'));
assert.equal(root.status, 200);
const html = await root.text();
assert.match(html, /AfterKey/i);
for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)) assert.equal((await worker.fetch(new Request(`https://afterkey.test${asset}`))).status, 200, asset);
assert.equal((await worker.fetch(new Request('https://afterkey.test/logo.svg'))).status, 200);
assert.equal((await worker.fetch(new Request('https://afterkey.test/.env'))).status, 404);
assert.equal((await worker.fetch(new Request('https://afterkey.test/api/cre-trigger'))).status, 405);
assert.equal((await worker.fetch(new Request('https://afterkey.test/api/cre-trigger', { method: 'POST', body: '{}' }))).status, 400);
console.log('Worker app/assets serve successfully; unsigned CRE requests are rejected.');
