import net from 'node:net';
import { validatePort, inspectPort } from './inspector.js';

function checkPortAvailability(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    try {
      server.listen(port, host);
    } catch {
      resolve(false);
    }
  });
}

export async function findAvailablePort(startPort = 3000, maxPort = 65535, host = '0.0.0.0') {
  const start = validatePort(startPort);
  const end = validatePort(maxPort);

  if (start > end) {
    throw new Error(`startPort (${start}) cannot be greater than maxPort (${end}).`);
  }

  for (let port = start; port <= end; port++) {
    const isAvailable = await checkPortAvailability(port, host);
    if (isAvailable) {
      return port;
    }
  }

  throw new Error(`No available ports found in range ${start}-${end}.`);
}

export async function waitForPort(port, options = {}) {
  const { status = 'closed', timeoutMs = 10000, intervalMs = 250 } = options;
  const targetPort = validatePort(port);
  const startTime = Date.now();

  const isTargetMet = () => {
    const info = inspectPort(targetPort);
    if (status === 'closed') {
      return !info.occupied;
    }
    return info.occupied;
  };

  while (Date.now() - startTime < timeoutMs) {
    if (isTargetMet()) {
      return {
        success: true,
        port: targetPort,
        status,
        elapsedMs: Date.now() - startTime,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for port ${targetPort} to become ${status}.`);
}
