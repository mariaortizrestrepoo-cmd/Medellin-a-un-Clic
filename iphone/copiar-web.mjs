// Copia la versión con candado (herramientas-candado/dist, armada con build.mjs) a www/, que es lo que va DENTRO
// de la app de iPhone. Así la app abre sin internet desde el primer momento.
// OJO: dist/ debe armarse con la CONTENT_KEY real (la arma Claude del chat). Para pruebas se usa la llave de prueba.
import fs from 'node:fs'; import path from 'node:path';
const DIST = path.resolve('../herramientas-candado/dist'), WWW = path.resolve('www');
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('Falta herramientas-candado/dist: primero arme la versión con candado (build.mjs).'); process.exit(1); }
const FUERA = new Set(['_headers', '_redirects', 'assetlinks.json', '.well-known', 'sw.js']);   // solo sirven en Netlify
fs.rmSync(WWW, { recursive: true, force: true });
fs.cpSync(DIST, WWW, { recursive: true, filter: f => !FUERA.has(path.basename(f)) });
let n = 0; const contar = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? contar(path.join(d, e.name)) : n++); contar(WWW);
console.log('www/ listo:', n, 'archivos');
