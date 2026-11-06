import { build } from 'vite';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const root = process.cwd(), dist = resolve(root, 'dist');
await build({ root });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const assets = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = resolve(directory, entry.name), url = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await collect(path, url);
    else if (entry.isFile()) assets[url] = [mime[extname(entry.name)] || 'application/octet-stream', (await readFile(path)).toString('base64')];
    else throw new Error('Public build output must contain regular files.');
  }
}
await collect(dist);
assets['/'] = assets['/index.html'];
if (!assets['/']) throw new Error('Missing built application.');
await mkdir(resolve(root, 'worker'), { recursive: true });
await writeFile(resolve(root, 'worker/assets.generated.ts'), `export default ${JSON.stringify(assets)} as Record<string, [string, string]>;\n`);
await build({ root, configFile: false, publicDir: false, ssr: { target: 'webworker', noExternal: true }, build: { ssr: 'worker/index.ts', outDir: dist, emptyOutDir: true, minify: true, rollupOptions: { output: { entryFileNames: 'server/index.js', inlineDynamicImports: true, format: 'es' } } } });
await mkdir(resolve(dist, '.openai'), { recursive: true });
await writeFile(resolve(dist, '.openai/hosting.json'), await readFile(resolve(root, '.openai/hosting.json')));
console.log(`Embedded ${Object.keys(assets).length} asset routes in the app and CRE relay Worker.`);
