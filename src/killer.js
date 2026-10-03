import { execSync } from 'node:child_process';
import { inspectPort, isSystemPid } from './inspector.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function killPid(pid, { force = false } = {}) {
  if (isSystemPid(pid)) {
    throw new Error(`Refusing to terminate protected system process (PID ${pid}).`);
  }

  if (process.platform === 'win32') {
    const flag = force ? '/F /T' : '';
    try {
      execSync(`taskkill ${flag} /PID ${pid}`, { stdio: ['pipe', 'pipe', 'ignore'] });
      return true;
    } catch (err) {
      // If graceful failed, fallback to force kill
      if (!force) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: ['pipe', 'pipe', 'ignore'] });
          return true;
        } catch {
          // Process might have already exited
        }
      }
      return false;
    }
  }

  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    return true;
  } catch (err) {
    if (err.code === 'ESRCH') {
      return true;
    }
    if (!force) {
      try {
        process.kill(pid, 'SIGKILL');
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function freePort(port, options = {}) {
  const { force = false, dryRun = false, timeoutMs = 3500 } = options;

  const info = inspectPort(port);
  if (!info.occupied) {
    return {
      success: true,
      port,
      alreadyFree: true,
      message: `Port ${port} is already free.`,
    };
  }

  if (info.isSystemProcess) {
    return {
      success: false,
      port,
      pid: info.pid,
      processName: info.processName,
      error: `Port ${port} is held by protected system process "${info.processName}" (PID ${info.pid}). Operation aborted.`,
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      port,
      pid: info.pid,
      processName: info.processName,
      memoryFormatted: info.memoryFormatted,
      message: `[DRY-RUN] Would terminate "${info.processName}" (PID ${info.pid}) listening on port ${port}.`,
    };
  }

  const startTime = Date.now();
  killPid(info.pid, { force });

  const intervalMs = 150;
  while (Date.now() - startTime < timeoutMs) {
    await sleep(intervalMs);
    const check = inspectPort(port);
    if (!check.occupied) {
      return {
        success: true,
        freed: true,
        port,
        pid: info.pid,
        processName: info.processName,
        memoryFormatted: info.memoryFormatted,
        durationMs: Date.now() - startTime,
      };
    }
    if (!force && Date.now() - startTime > 1200) {
      killPid(info.pid, { force: true });
    }
  }

  return {
    success: false,
    port,
    pid: info.pid,
    processName: info.processName,
    error: `Timed out waiting for port ${port} to be released by PID ${info.pid}.`,
  };
}

export async function freePorts(ports, options = {}) {
  const results = [];
  for (const port of ports) {
    const res = await freePort(port, options);
    results.push(res);
  }
  return results;
}
