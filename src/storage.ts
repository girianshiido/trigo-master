import { validProfile, type Profile } from './progression';

export type Envelope = { format: 'trigo-master-save'; version: 1; id: string; iv: string; data: string };
// Client-side deterrent, not a server-backed anti-cheat secret. The stable key
// makes encrypted backups portable between the user's browsers and devices.
const keyPromise = crypto.subtle.digest('SHA-256', new TextEncoder().encode('Trigo Master / portable saves / AES-GCM / v1 / observatory'))
  .then(bytes => crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']));
function base64(bytes: Uint8Array): string {
  let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function unbase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text); return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export async function seal(profile: Profile): Promise<Envelope> {
  if (!validProfile(profile)) throw new Error('Sauvegarde invalide');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(profile.id) }, await keyPromise, new TextEncoder().encode(JSON.stringify(profile)));
  return { format: 'trigo-master-save', version: 1, id: profile.id, iv: base64(iv), data: base64(new Uint8Array(data)) };
}
export async function unseal(value: unknown): Promise<Profile> {
  if (!value || typeof value !== 'object') throw new Error('Format de sauvegarde inconnu');
  const e = value as Envelope;
  if (e.format !== 'trigo-master-save' || e.version !== 1 || typeof e.id !== 'string' || !/^[\w-]{1,80}$/.test(e.id) || typeof e.iv !== 'string' || typeof e.data !== 'string' || e.data.length > 2_000_000) throw new Error('Format de sauvegarde inconnu');
  try {
    const iv = unbase64(e.iv);
    if (iv.length !== 12) throw new Error('IV');
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(e.id) }, await keyPromise, unbase64(e.data));
    const profile: unknown = JSON.parse(new TextDecoder().decode(clear));
    if (!validProfile(profile) || profile.id !== e.id) throw new Error('Structure');
    return profile;
  } catch { throw new Error('Sauvegarde altérée ou illisible. Son intégrité ne peut pas être vérifiée.'); }
}
let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('trigo-master', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves', { keyPath: 'id' });
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Ferme les autres onglets du jeu puis réessaie.'));
  }).catch(error => { database = undefined; throw error; });
}
async function write(action: (store: IDBObjectStore) => void): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('saves', 'readwrite');
    action(transaction.objectStore('saves'));
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
let queue: Promise<void> = Promise.resolve();
export function save(profile: Profile): Promise<void> {
  profile.updatedAt = Date.now();
  const snapshot = structuredClone(profile);
  const pending = queue.catch(() => {}).then(async () => { const encrypted = await seal(snapshot); await write(store => { store.put(encrypted); }); });
  queue = pending; return pending;
}
export async function flush(): Promise<void> { await queue; }
export async function remove(id: string): Promise<void> { await flush().catch(() => {}); await write(store => { store.delete(id); }); }
export async function list(): Promise<{ profiles: Profile[]; damaged: string[] }> {
  await flush().catch(() => {});
  const database = await db();
  const values = await new Promise<Envelope[]>((resolve, reject) => {
    const request = database.transaction('saves', 'readonly').objectStore('saves').getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const profiles: Profile[] = [], damaged: string[] = [];
  await Promise.all(values.map(async value => { try { profiles.push(await unseal(value)); } catch { if (typeof value.id === 'string') damaged.push(value.id); } }));
  profiles.sort((a, b) => b.updatedAt - a.updatedAt);
  return { profiles, damaged };
}
export async function importSave(text: string): Promise<Profile> {
  if (text.length > 2_000_000) throw new Error('Ce fichier est trop volumineux.');
  const profile = await unseal(JSON.parse(text));
  // Import as a new slot so a backup never overwrites an existing adventure.
  profile.id = crypto.randomUUID(); profile.name = `${profile.name.slice(0, 29)} (importée)`;
  await save(profile); return profile;
}
