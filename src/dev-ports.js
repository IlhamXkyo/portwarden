import { inspectPorts } from './inspector.js';
import { freePorts } from './killer.js';

export const DEV_PORT_CATALOG = [
  { port: 3000, label: 'Next.js / CRA / Rails', category: 'web' },
  { port: 3001, label: 'Secondary React / Node', category: 'web' },
  { port: 3002, label: 'Tertiary Web Dev', category: 'web' },
  { port: 4000, label: 'GraphQL / Hexo', category: 'web' },
  { port: 4200, label: 'Angular CLI', category: 'web' },
  { port: 5000, label: 'Flask / Express / ASP.NET', category: 'web' },
  { port: 5173, label: 'Vite (React/Vue/Svelte)', category: 'web' },
  { port: 5174, label: 'Vite Secondary', category: 'web' },
  { port: 8000, label: 'Django / FastAPI / PHP', category: 'web' },
  { port: 8080, label: 'Spring Boot / Tomcat', category: 'web' },
  { port: 8888, label: 'Jupyter / Dev Server', category: 'web' },
  { port: 9000, label: 'PHP-FPM / MinIO', category: 'web' },
  { port: 3306, label: 'MySQL', category: 'database' },
  { port: 5432, label: 'PostgreSQL', category: 'database' },
  { port: 6379, label: 'Redis', category: 'database' },
  { port: 27017, label: 'MongoDB', category: 'database' },
];

export function getDevPortMetadata(port) {
  return DEV_PORT_CATALOG.find((item) => item.port === port) || null;
}

export function scanDevPorts({ includeDatabases = true } = {}) {
  const targetPorts = DEV_PORT_CATALOG
    .filter((item) => includeDatabases || item.category === 'web')
    .map((item) => item.port);

  const inspected = inspectPorts(targetPorts);

  return inspected
    .filter((info) => info.occupied)
    .map((info) => {
      const meta = getDevPortMetadata(info.port);
      return {
        ...info,
        devLabel: meta ? meta.label : 'Custom Service',
        category: meta ? meta.category : 'web',
      };
    });
}

export async function sweepDevPorts(options = {}) {
  const { includeDatabases = false, ...killOptions } = options;
  const active = scanDevPorts({ includeDatabases });

  if (active.length === 0) {
    return [];
  }

  const portsToKill = active.map((item) => item.port);
  return freePorts(portsToKill, killOptions);
}
