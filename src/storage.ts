import { validProfile, type Profile } from './progression';

export type Envelope = { format: 'trigo-master-save'; version: 1; id: string; iv: string; data: string };
// Client-side deterrent, not a server-backed anti-cheat secret.
// Keep this stable key unchanged so existing local saves remain readable.
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
let primaryUnavailable = false;
const LOCAL_PREFIX = 'trigo-master-save:';
const DELETED_PREFIX = 'trigo-master-deleted:';
const STORAGE_ERROR = 'Impossible d’enregistrer sur cet appareil. Autorise le stockage local pour ce site, puis réessaie.';
function localRecords(): { values: Envelope[]; deleted: Set<string> } {
  const values: Envelope[] = [], deleted = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key.startsWith(DELETED_PREFIX)) deleted.add(key.slice(DELETED_PREFIX.length));
    if (!key.startsWith(LOCAL_PREFIX)) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key)!);
      if (!value || typeof value !== 'object' || value.id !== key.slice(LOCAL_PREFIX.length)) throw new Error('Identité');
      values.push(value);
    }
    catch { values.push({ id: key.slice(LOCAL_PREFIX.length) } as Envelope); }
  }
  return { values, deleted };
}
async function storeEncrypted(encrypted: Envelope): Promise<void> {
  if (!primaryUnavailable) {
    try {
      await write(store => { store.put(encrypted); });
      try { localStorage.removeItem(LOCAL_PREFIX + encrypted.id); localStorage.removeItem(DELETED_PREFIX + encrypted.id); } catch { /* IndexedDB already saved the encrypted record. */ }
      return;
    } catch { primaryUnavailable = true; }
  }
  try { localStorage.setItem(LOCAL_PREFIX + encrypted.id, JSON.stringify(encrypted)); localStorage.removeItem(DELETED_PREFIX + encrypted.id); }
  catch { throw new Error(STORAGE_ERROR); }
}
export function save(profile: Profile, canWrite?: () => boolean): Promise<void> {
  profile.updatedAt = Date.now();
  const snapshot = structuredClone(profile);
  const pending = queue.catch(() => {}).then(async () => {
    const encrypted = await seal(snapshot);
    if (canWrite && !canWrite()) throw new Error('L’accès à cette partie a été interrompu. Recharge-la avant de continuer.');
    await storeEncrypted(encrypted);
  });
  queue = pending; return pending;
}
export async function flush(): Promise<void> { await queue; }
export async function remove(id: string): Promise<void> {
  await flush().catch(() => {});
  let primaryDeleted = false;
  if (!primaryUnavailable) {
    try { await write(store => { store.delete(id); }); primaryDeleted = true; } catch { primaryUnavailable = true; }
  }
  try {
    // Keep an unavailable IndexedDB copy from reappearing when that service recovers.
    if (!primaryDeleted) localStorage.setItem(DELETED_PREFIX + id, '1');
    localStorage.removeItem(LOCAL_PREFIX + id);
    if (primaryDeleted) localStorage.removeItem(DELETED_PREFIX + id);
  } catch { if (!primaryDeleted) throw new Error(STORAGE_ERROR); }
}
export async function list(): Promise<{ profiles: Profile[]; damaged: string[] }> {
  await flush().catch(() => {});
  const values: Envelope[] = [];
  if (!primaryUnavailable) {
    try {
      const database = await db();
      values.push(...await new Promise<Envelope[]>((resolve, reject) => {
        const request = database.transaction('saves', 'readonly').objectStore('saves').getAll();
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      }));
    } catch { primaryUnavailable = true; }
  }
  let local: ReturnType<typeof localRecords>;
  try { local = localRecords(); } catch { if (primaryUnavailable) throw new Error(STORAGE_ERROR); local = { values: [], deleted: new Set() }; }
  if (!primaryUnavailable && local.deleted.size) {
    try {
      await write(store => { for (const id of local.deleted) store.delete(id); });
      for (const id of local.deleted) localStorage.removeItem(DELETED_PREFIX + id);
    } catch { /* Deletion markers continue to hide inaccessible old copies. */ }
  }
  values.push(...local.values);
  const byId = new Map<string, Profile>(), bad = new Set<string>();
  const decoded = await Promise.all(values.map(async value => {
    if (!value || local.deleted.has(value.id)) return null;
    try { return await unseal(value); }
    catch { if (typeof value.id === 'string') bad.add(value.id); return null; }
  }));
  for (const profile of decoded) if (profile) {
    const previous = byId.get(profile.id);
    if (!previous || profile.updatedAt >= previous.updatedAt) byId.set(profile.id, profile);
  }
  const profiles = [...byId.values()], damaged = [...bad].filter(id => !byId.has(id));
  profiles.sort((a, b) => b.updatedAt - a.updatedAt);
  return { profiles, damaged };
}
