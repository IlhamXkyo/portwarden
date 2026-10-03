import { execSync } from 'node:child_process';
import { formatBytes } from './formatter.js';

export function validatePort(port) {
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    throw new Error(`Invalid port number: "${port}". Port must be an integer between 1 and 65535.`);
  }
  return p;
}

export function isSystemPid(pid) {
  if (pid <= 0) return true;
  if (process.platform === 'win32' && (pid === 0 || pid === 4)) return true;
  if (process.platform !== 'win32' && pid === 1) return true;
  return false;
}

export function getListeningPortsWindows() {
  try {
    const output = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = output.split('\n');
    const portMap = new Map();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('TCP')) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 5) continue;

      const localAddr = parts[1];
      const state = parts[3];
      const pidStr = parts[4];

      if (state !== 'LISTENING') continue;

      const colonIndex = localAddr.lastIndexOf(':');
      if (colonIndex === -1) continue;

      const port = Number(localAddr.slice(colonIndex + 1));
      const address = localAddr.slice(0, colonIndex);
      const pid = Number(pidStr);

      if (!Number.isNaN(port) && !Number.isNaN(pid) && port > 0) {
        if (!portMap.has(port)) {
          portMap.set(port, {
            port,
            pid,
            localAddress: address,
            protocol: 'TCP',
            state: 'LISTENING',
          });
        }
      }
    }

    return portMap;
  } catch {
    return new Map();
  }
}

export function getListeningPortsUnix() {
  const portMap = new Map();
  try {
    const output = execSync('lsof -iTCP -sTCP:LISTEN -P -n -F pTcn', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    let currentPid = null;
    let currentCommand = null;

    for (const rawLine of output.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('p')) {
        currentPid = Number(line.slice(1));
      } else if (line.startsWith('c')) {
        currentCommand = line.slice(1);
      } else if (line.startsWith('n')) {
        const address = line.slice(1);
        const colonIndex = address.lastIndexOf(':');
        if (colonIndex !== -1) {
          const port = Number(address.slice(colonIndex + 1));
          if (!Number.isNaN(port) && port > 0 && currentPid) {
            portMap.set(port, {
              port,
              pid: currentPid,
              processName: currentCommand || 'unknown',
              localAddress: address.slice(0, colonIndex),
              protocol: 'TCP',
              state: 'LISTENING',
            });
          }
        }
      }
    }
  } catch {
    try {
      const ssOutput = execSync('ss -tulpn', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      for (const rawLine of ssOutput.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('LISTEN')) continue;
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          const local = parts[3];
          const colonIndex = local.lastIndexOf(':');
          if (colonIndex !== -1) {
            const port = Number(local.slice(colonIndex + 1));
            const pidMatch = line.match(/pid=(\d+)/);
            const pid = pidMatch ? Number(pidMatch[1]) : 0;
            if (!Number.isNaN(port) && port > 0) {
              portMap.set(port, {
                port,
                pid,
                localAddress: local.slice(0, colonIndex),
                protocol: 'TCP',
                state: 'LISTENING',
              });
            }
          }
        }
      }
    } catch {
      // Fallback exhausted
    }
  }
  return portMap;
}

export function getAllListeningPorts() {
  if (process.platform === 'win32') {
    return getListeningPortsWindows();
  }
  return getListeningPortsUnix();
}

export function getProcessDetailsWindows(pid) {
  if (!pid || pid <= 0) {
    return { processName: 'Unknown', path: '', memoryBytes: 0, memoryFormatted: '-' };
  }

  if (pid === 4) {
    return { processName: 'System', path: 'C:\\Windows\\System32\\ntoskrnl.exe', memoryBytes: 0, memoryFormatted: '-' };
  }

  try {
    const csv = execSync(`tasklist /FO CSV /NH /FI "PID eq ${pid}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const lines = csv.trim().split('\n');
    for (const rawLine of lines) {
      const parts = rawLine.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 5 && parts[1] === String(pid)) {
        const processName = parts[0];
        const memStr = parts[4].replace(/[^\d]/g, '');
        const memoryBytes = memStr ? Number(memStr) * 1024 : 0;
        return {
          processName,
          path: '',
          memoryBytes,
          memoryFormatted: formatBytes(memoryBytes),
        };
      }
    }
  } catch {
    // Process query failed
  }

  return { processName: 'Unknown', path: '', memoryBytes: 0, memoryFormatted: '-' };
}

export function getProcessDetailsUnix(pid) {
  if (!pid || pid <= 0) {
    return { processName: 'Unknown', path: '', memoryBytes: 0, memoryFormatted: '-' };
  }

  try {
    const output = execSync(`ps -p ${pid} -o comm=,rss=,args=`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const trimmed = output.trim();
    if (!trimmed) {
      return { processName: 'Unknown', path: '', memoryBytes: 0, memoryFormatted: '-' };
    }

    const parts = trimmed.split(/\s+/);
    const processName = parts[0] || 'Unknown';
    const rssKb = Number(parts[1]) || 0;
    const memoryBytes = rssKb * 1024;
    const commandLine = parts.slice(2).join(' ');

    return {
      processName,
      commandLine,
      memoryBytes,
      memoryFormatted: formatBytes(memoryBytes),
    };
  } catch {
    return { processName: 'Unknown', path: '', memoryBytes: 0, memoryFormatted: '-' };
  }
}

export function getProcessDetails(pid) {
  if (process.platform === 'win32') {
    return getProcessDetailsWindows(pid);
  }
  return getProcessDetailsUnix(pid);
}

export function inspectPort(port) {
  const validPort = validatePort(port);
  const listening = getAllListeningPorts();
  const entry = listening.get(validPort);

  if (!entry) {
    return {
      port: validPort,
      occupied: false,
      state: 'FREE',
    };
  }

  const proc = getProcessDetails(entry.pid);

  return {
    port: validPort,
    occupied: true,
    pid: entry.pid,
    processName: proc.processName || entry.processName || 'Unknown',
    commandLine: proc.commandLine || '',
    path: proc.path || '',
    memoryBytes: proc.memoryBytes || 0,
    memoryFormatted: proc.memoryFormatted || '-',
    protocol: entry.protocol || 'TCP',
    localAddress: entry.localAddress || '0.0.0.0',
    state: entry.state || 'LISTENING',
    isSystemProcess: isSystemPid(entry.pid),
  };
}

export function inspectPorts(ports) {
  return ports.map((p) => inspectPort(p));
}
