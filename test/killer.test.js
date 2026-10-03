import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { freePort } from '../src/killer.js';
import { inspectPort } from '../src/inspector.js';
import { findAvailablePort, waitForPort } from '../src/finder.js';

test('freePort frees an occupied port by terminating the process', async () => {
  const targetPort = await findAvailablePort(38000, 39000);

  // Spawn child server process
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
      import net from 'node:net';
      const server = net.createServer();
      server.listen(${targetPort}, '0.0.0.0', () => {
        console.log('READY');
      });
      setInterval(() => {}, 10000);
    `,
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] }
  );

  // Wait for child to be listening
  await waitForPort(targetPort, { status: 'open', timeoutMs: 5000 });

  const before = inspectPort(targetPort);
  assert.equal(before.occupied, true);
  assert.equal(before.pid, child.pid);

  // Free the port
  const result = await freePort(targetPort, { force: true });
  assert.equal(result.success, true);
  assert.equal(result.freed, true);
  assert.equal(result.port, targetPort);

  // Verify port is now free
  const after = inspectPort(targetPort);
  assert.equal(after.occupied, false);
});

test('freePort reports already free when port is unoccupied', async () => {
  const unusedPort = await findAvailablePort(48000, 48500);
  const result = await freePort(unusedPort);
  assert.equal(result.success, true);
  assert.equal(result.alreadyFree, true);
});
