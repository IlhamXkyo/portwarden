import readline from 'node:readline';
import { inspectPorts, validatePort } from './inspector.js';
import { freePorts } from './killer.js';
import { scanDevPorts, sweepDevPorts } from './dev-ports.js';
import { findAvailablePort, waitForPort } from './finder.js';
import { c, formatTable, printJson, printBanner } from './formatter.js';

function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    json: false,
    force: false,
    dryRun: false,
    yes: false,
    all: false,
    help: false,
    version: false,
    untilFree: false,
    untilReady: false,
    timeout: 3500,
  };
  const positionals = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--force' || arg === '-f') flags.force = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg === '--all') flags.all = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--version' || arg === '-v') flags.version = true;
    else if (arg === '--until-free') flags.untilFree = true;
    else if (arg === '--until-ready') flags.untilReady = true;
    else if (arg === '--timeout') {
      flags.timeout = Number(args[++i]) || 3500;
    } else {
      positionals.push(arg);
    }
  }

  return { flags, positionals };
}

function printHelp() {
  printBanner();
  console.log(`${c.bold('USAGE:')}
  portwarden <command|port> [options]

${c.bold('COMMANDS:')}
  ${c.cyan('<port...>')}                 Inspect one or more ports (e.g. portwarden 3000 8080)
  ${c.cyan('inspect <port...>')}         Explicitly inspect specified ports
  ${c.cyan('free <port...>')}            Kill process occupying port(s) and verify release
  ${c.cyan('kill <port...>')}            Alias for "free"
  ${c.cyan('dev')}                       Scan active standard development ports
  ${c.cyan('sweep')}                     Terminate all active dev server processes
  ${c.cyan('next [startPort]')}          Find next available unoccupied port (default: 3000)
  ${c.cyan('wait <port>')}               Wait until port opens or closes

${c.bold('OPTIONS:')}
  ${c.yellow('-f, --force')}             Force kill immediately without graceful attempt
  ${c.yellow('--dry-run')}               Preview actions without terminating processes
  ${c.yellow('-y, --yes')}               Skip interactive confirmation prompt
  ${c.yellow('--all')}                   Include database ports in sweep (Postgres, Redis, MySQL)
  ${c.yellow('--until-ready')}           Used with "wait": wait until server starts listening
  ${c.yellow('--until-free')}            Used with "wait": wait until server terminates
  ${c.yellow('--timeout <ms>')}          Timeout in milliseconds (default: 3500)
  ${c.yellow('--json')}                  Output machine-readable JSON
  ${c.yellow('-v, --version')}           Show version
  ${c.yellow('-h, --help')}              Show this help guide

${c.bold('EXAMPLES:')}
  portwarden 3000
  portwarden free 3000 8080 --force
  portwarden dev
  portwarden sweep --yes
  portwarden next 5173
  portwarden wait 3000 --until-ready --timeout 10000
`);
}

export async function runCli(argv = process.argv) {
  const { flags, positionals } = parseCliArgs(argv);

  if (flags.version) {
    console.log('portwarden v1.0.0');
    return 0;
  }

  if (flags.help || positionals.length === 0) {
    printHelp();
    return 0;
  }

  const [cmd, ...rest] = positionals;

  try {
    // Check if first positional is a number -> default to inspect
    if (/^\d+$/.test(cmd)) {
      const ports = [cmd, ...rest].map(Number);
      return await handleInspect(ports, flags);
    }

    switch (cmd.toLowerCase()) {
      case 'inspect': {
        const ports = rest.map(Number);
        if (ports.length === 0) {
          console.error(c.red('Error: Please provide at least one port number to inspect.'));
          return 1;
        }
        return await handleInspect(ports, flags);
      }

      case 'free':
      case 'kill': {
        const ports = rest.map(Number);
        if (ports.length === 0) {
          console.error(c.red('Error: Please provide at least one port number to free.'));
          return 1;
        }
        return await handleFree(ports, flags);
      }

      case 'dev': {
        return await handleDev(flags);
      }

      case 'sweep': {
        return await handleSweep(flags);
      }

      case 'next': {
        const start = rest[0] ? Number(rest[0]) : 3000;
        return await handleNext(start, flags);
      }

      case 'wait': {
        const port = Number(rest[0]);
        if (!port) {
          console.error(c.red('Error: Please specify port to wait for.'));
          return 1;
        }
        return await handleWait(port, flags);
      }

      default:
        console.error(c.red(`Unknown command: "${cmd}". Use --help for usage.`));
        return 1;
    }
  } catch (err) {
    if (flags.json) {
      printJson({ error: err.message });
    } else {
      console.error(c.red(`Error: ${err.message}`));
    }
    return 1;
  }
}

async function handleInspect(ports, flags) {
  const results = inspectPorts(ports);

  if (flags.json) {
    printJson(results);
    return 0;
  }

  printBanner();
  const rows = [];
  for (const info of results) {
    if (info.occupied) {
      rows.push([
        c.bold(String(info.port)),
        c.red('OCCUPIED'),
        String(info.pid),
        c.cyan(info.processName),
        info.memoryFormatted,
        info.localAddress,
      ]);
    } else {
      rows.push([
        c.bold(String(info.port)),
        c.green('AVAILABLE'),
        '-',
        '-',
        '-',
        '-',
      ]);
    }
  }

  console.log(formatTable(['PORT', 'STATUS', 'PID', 'PROCESS', 'MEMORY', 'ADDRESS'], rows));
  console.log();
  return 0;
}

async function handleFree(ports, flags) {
  const results = await freePorts(ports, {
    force: flags.force,
    dryRun: flags.dryRun,
    timeoutMs: flags.timeout,
  });

  if (flags.json) {
    printJson(results);
    return 0;
  }

  printBanner();
  for (const res of results) {
    if (res.dryRun) {
      console.log(c.yellow(`[DRY-RUN] Would terminate "${res.processName}" (PID ${res.pid}) on port ${res.port}.`));
    } else if (res.alreadyFree) {
      console.log(c.green(`✓ Port ${res.port} is already free.`));
    } else if (res.success) {
      console.log(
        c.green(`✓ Port ${res.port} freed! Terminated ${c.bold(res.processName)} (PID ${res.pid}) in ${res.durationMs}ms.`)
      );
    } else {
      console.log(c.red(`✗ Failed to free port ${res.port}: ${res.error}`));
    }
  }
  console.log();
  return results.some((r) => !r.success) ? 1 : 0;
}

async function handleDev(flags) {
  const active = scanDevPorts({ includeDatabases: flags.all });

  if (flags.json) {
    printJson(active);
    return 0;
  }

  printBanner();
  if (active.length === 0) {
    console.log(c.green('✓ All common development ports are currently free and clear.\n'));
    return 0;
  }

  console.log(c.bold(`Active Development Ports (${active.length} found):\n`));
  const rows = active.map((item) => [
    c.bold(String(item.port)),
    c.cyan(item.devLabel),
    String(item.pid),
    c.yellow(item.processName),
    item.memoryFormatted,
    c.dim(item.category),
  ]);

  console.log(formatTable(['PORT', 'PRESET', 'PID', 'PROCESS', 'MEMORY', 'TYPE'], rows));
  console.log(`\nRun ${c.cyan('portwarden sweep')} to terminate dev servers.\n`);
  return 0;
}

async function handleSweep(flags) {
  const active = scanDevPorts({ includeDatabases: flags.all });

  if (active.length === 0) {
    if (flags.json) {
      printJson({ freed: 0, ports: [] });
    } else {
      printBanner();
      console.log(c.green('✓ No active development servers found to sweep.\n'));
    }
    return 0;
  }

  if (!flags.yes && !flags.force && !flags.dryRun) {
    printBanner();
    console.log(c.yellow(`Found ${active.length} active process(es) on development ports:`));
    for (const item of active) {
      console.log(`  - Port ${item.port}: ${item.processName} (PID ${item.pid}, ${item.devLabel})`);
    }
    const confirmed = await askConfirmation(`\nTerminate these ${active.length} process(es)? [y/N]: `);
    if (!confirmed) {
      console.log(c.dim('Sweep cancelled by user.\n'));
      return 0;
    }
  }

  const results = await sweepDevPorts({
    includeDatabases: flags.all,
    force: flags.force,
    dryRun: flags.dryRun,
  });

  if (flags.json) {
    printJson(results);
    return 0;
  }

  printBanner();
  console.log(c.bold(`Sweep results (${results.length} processed):\n`));
  for (const res of results) {
    if (res.dryRun) {
      console.log(c.yellow(`[DRY-RUN] Port ${res.port}: would kill ${res.processName} (PID ${res.pid})`));
    } else if (res.success) {
      console.log(c.green(`✓ Port ${res.port}: terminated ${res.processName} (PID ${res.pid})`));
    } else {
      console.log(c.red(`✗ Port ${res.port}: ${res.error}`));
    }
  }
  console.log();
  return 0;
}

async function handleNext(startPort, flags) {
  const port = await findAvailablePort(startPort);

  if (flags.json) {
    printJson({ availablePort: port, startPort });
    return 0;
  }

  printBanner();
  console.log(`Next available port starting from ${startPort}: ${c.bold(c.green(String(port)))}\n`);
  return 0;
}

async function handleWait(port, flags) {
  const status = flags.untilReady ? 'open' : 'closed';
  if (!flags.json) {
    console.log(c.dim(`Waiting for port ${port} to become ${status}...`));
  }

  const result = await waitForPort(port, {
    status,
    timeoutMs: flags.timeout,
  });

  if (flags.json) {
    printJson(result);
  } else {
    console.log(c.green(`✓ Port ${port} is now ${status} (elapsed: ${result.elapsedMs}ms).`));
  }
  return 0;
}
