import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('entry point renders the Hello World element without throwing', () => {
  assert.doesNotThrow(() => {
    const match = html.match(/<div id="hello-world">(.*?)<\/div>/);
    assert.ok(match, 'expected a queryable #hello-world element');
    assert.equal(match[1], 'Hello World');
  });
});
