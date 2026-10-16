import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function collect(path = '') {
  const entries = await readdir(`docs/${path}`, { withFileTypes: true });
  const nested = await Promise.all(entries.filter(e => e.name !== 'sw.js' && !e.name.startsWith('.')).map(e => e.isDirectory() ? collect(`${path}${e.name}/`) : [`${path}${e.name}`]));
  return nested.flat();
}
const files = (await collect()).sort();
const hash = createHash('sha256');
hash.update(await readFile(new URL(import.meta.url)));
for (const file of files) hash.update(file).update(await readFile(`docs/${file}`));
const version = hash.digest('hex').slice(0, 14);
await writeFile('docs/sw.js', `// Trigo Master offline build ${version}\nconst CACHE='trigo-master-${version}';\nconst FILES=${JSON.stringify(files.map(f => './' + f))};\nself.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));\nself.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('trigo-master-') && k !== CACHE).map(k => caches.delete(k)))),self.clients.claim()])));\nself.addEventListener('message', event => {if(event.data?.type==='SKIP_WAITING') self.skipWaiting();});\nself.addEventListener('fetch', event => {\n const url=new URL(event.request.url);\n if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;\n if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>response.ok?response:caches.match(new URL('index.html',self.registration.scope))).catch(()=>caches.match(new URL('index.html',self.registration.scope))));return;}\n event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request,{ignoreVary:true})) || fetch(event.request)));\n});\n`);
console.log(`Offline cache ${version}: ${files.length} files`);
