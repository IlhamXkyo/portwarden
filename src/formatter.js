const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

export const c = {
  reset: (text) => (isColorSupported ? `\x1b[0m${text}\x1b[0m` : text),
  bold: (text) => (isColorSupported ? `\x1b[1m${text}\x1b[22m` : text),
  dim: (text) => (isColorSupported ? `\x1b[2m${text}\x1b[22m` : text),
  green: (text) => (isColorSupported ? `\x1b[32m${text}\x1b[39m` : text),
  red: (text) => (isColorSupported ? `\x1b[31m${text}\x1b[39m` : text),
  yellow: (text) => (isColorSupported ? `\x1b[33m${text}\x1b[39m` : text),
  cyan: (text) => (isColorSupported ? `\x1b[36m${text}\x1b[39m` : text),
  blue: (text) => (isColorSupported ? `\x1b[34m${text}\x1b[39m` : text),
  magenta: (text) => (isColorSupported ? `\x1b[35m${text}\x1b[39m` : text),
  bgGreen: (text) => (isColorSupported ? `\x1b[42m\x1b[30m${text}\x1b[39m\x1b[49m` : text),
  bgRed: (text) => (isColorSupported ? `\x1b[41m\x1b[37m${text}\x1b[39m\x1b[49m` : text),
  bgYellow: (text) => (isColorSupported ? `\x1b[43m\x1b[30m${text}\x1b[39m\x1b[49m` : text),
};

export function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let unitIndex = 0;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex += 1;
  }
  return `${val.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatTable(headers, rows) {
  if (rows.length === 0) return '';

  const colWidths = headers.map((header, i) => {
    const maxRowWidth = rows.reduce((max, row) => {
      const cell = String(row[i] ?? '');
      const visibleLength = cell.replace(/\x1b\[[0-9;]*m/g, '').length;
      return Math.max(max, visibleLength);
    }, 0);
    return Math.max(header.length, maxRowWidth);
  });

  const pad = (text, width) => {
    const str = String(text ?? '');
    const visibleLength = str.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = ' '.repeat(Math.max(0, width - visibleLength));
    return str + padding;
  };

  const headerLine = headers.map((h, i) => c.bold(pad(h, colWidths[i]))).join('   ');
  const dividerLine = colWidths.map((w) => c.dim('─'.repeat(w))).join('   ');
  const rowLines = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i])).join('   ')
  );

  return [headerLine, dividerLine, ...rowLines].join('\n');
}

export function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function printBanner() {
  console.log(c.bold(c.cyan('  PORTWARDEN')) + c.dim(' - Developer Port & Zombie Process Sentinel\n'));
}
