import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { findAvailablePort, waitForPort } from '../src/finder.js';

test('findAvailablePort finds an unoccupied port', async () => {
  const port = await findAvailablePort(49152, 60000);
  assert.ok(port >= 49152 && port <= 60000);
});

test('waitForPort detects port state change', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const assignedPort = server.address().port;

  const waitReady = await waitForPort(assignedPort, { status: 'open', timeoutMs: 2000 });
  assert.equal(waitReady.success, true);
  assert.equal(waitReady.port, assignedPort);

  await new Promise((resolve) => server.close(resolve));

  const waitClosed = await waitForPort(assignedPort, { status: 'closed', timeoutMs: 2000 });
  assert.equal(waitClosed.success, true);
  assert.equal(waitClosed.port, assignedPort);
});
