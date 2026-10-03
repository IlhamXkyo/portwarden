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
      execSync(`taskkill ${flag} /PID ${pid}`, { stdio: ['pipe', 'pipe', 'pipe'] });
      return { success: true };
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : '';
      if (stderr.toLowerCase().includes('access is denied')) {
        return {
          success: false,
          permissionDenied: true,
          error: `Access denied. Administrator privileges required to terminate PID ${pid}.`,
        };
      }

      if (!force) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: ['pipe', 'pipe', 'pipe'] });
          return { success: true };
        } catch (forceErr) {
          const forceStderr = forceErr.stderr ? forceErr.stderr.toString() : '';
          if (forceStderr.toLowerCase().includes('access is denied')) {
            return {
              success: false,
              permissionDenied: true,
              error: `Access denied. Administrator privileges required to terminate PID ${pid}.`,
            };
          }
        }
      }
      return { success: false, error: stderr.trim() || 'Failed to terminate process.' };
    }
  }

  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    return { success: true };
  } catch (err) {
    if (err.code === 'ESRCH') {
      return { success: true };
    }
    if (err.code === 'EPERM') {
      return {
        success: false,
        permissionDenied: true,
        error: `Permission denied. Root / sudo privileges required to terminate PID ${pid}.`,
      };
    }
    if (!force) {
      try {
        process.kill(pid, 'SIGKILL');
        return { success: true };
      } catch (forceErr) {
        if (forceErr.code === 'EPERM') {
          return {
            success: false,
            permissionDenied: true,
            error: `Permission denied. Root / sudo privileges required to terminate PID ${pid}.`,
          };
        }
      }
    }
    return { success: false, error: err.message };
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
  const killResult = killPid(info.pid, { force });

  if (!killResult.success && killResult.permissionDenied) {
    return {
      success: false,
      port,
      pid: info.pid,
      processName: info.processName,
      permissionDenied: true,
      error: killResult.error,
    };
  }

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
