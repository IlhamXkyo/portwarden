import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { validatePort, isSystemPid, inspectPort } from '../src/inspector.js';

test('validatePort accepts valid ports and rejects invalid ones', () => {
  assert.equal(validatePort(80), 80);
  assert.equal(validatePort('3000'), 3000);
  assert.equal(validatePort(65535), 65535);

  assert.throws(() => validatePort(0), /Invalid port number/);
  assert.throws(() => validatePort(70000), /Invalid port number/);
  assert.throws(() => validatePort(-1), /Invalid port number/);
  assert.throws(() => validatePort('invalid'), /Invalid port number/);
});

test('isSystemPid detects protected system PIDs', () => {
  assert.equal(isSystemPid(0), true);
  if (process.platform === 'win32') {
    assert.equal(isSystemPid(4), true);
  }
  assert.equal(isSystemPid(99999), false);
});

test('inspectPort identifies an actively listening socket', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const assignedPort = server.address().port;

  try {
    const info = inspectPort(assignedPort);
    assert.equal(info.port, assignedPort);
    assert.equal(info.occupied, true);
    assert.equal(info.pid, process.pid);
    assert.equal(typeof info.processName, 'string');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
