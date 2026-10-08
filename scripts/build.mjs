import { build } from 'esbuild';
const shared = { bundle: true, format: 'esm', target: 'es2022', packages: 'external', sourcemap: true };
await build({ ...shared, entryPoints: ['src/index.ts', 'src/setup.ts', 'src/backend.ts', 'src/safety.ts', 'src/workflows.ts', 'src/html.ts', 'src/refactor.ts'], outdir: 'dist', platform: 'node' });
await build({ ...shared, entryPoints: ['src/client.tsx'], outfile: 'dist/client.js', platform: 'browser', external: ['react'] });
