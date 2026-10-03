import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatTable } from '../src/formatter.js';

test('formatBytes formats byte counts correctly', () => {
  assert.equal(formatBytes(0), '-');
  assert.equal(formatBytes(-10), '-');
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
  assert.equal(formatBytes(1024 * 1024 * 15.5), '15.5 MB');
  assert.equal(formatBytes(1024 * 1024 * 1024 * 2.2), '2.2 GB');
});

test('formatTable produces formatted aligned text', () => {
  const headers = ['COL1', 'COL2'];
  const rows = [
    ['Alpha', '100'],
    ['BetaLonger', '2000'],
  ];
  const output = formatTable(headers, rows);
  assert.ok(output.includes('COL1'));
  assert.ok(output.includes('BetaLonger'));
  assert.ok(output.includes('2000'));
});

test('formatTable handles empty rows gracefully', () => {
  const output = formatTable(['COL1'], []);
  assert.equal(output, '');
});
