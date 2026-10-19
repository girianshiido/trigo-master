const PREFIX = 'trigo-master-lock:';
const BUSY = 'Cette aventure est déjà ouverte dans un autre onglet. Reviens à l’accueil dans cet onglet avant de la charger ici.';
const UNAVAILABLE = 'Le navigateur ne permet pas de sécuriser cette partie. Autorise le stockage local du site, puis réessaie.';
const TTL = 120_000;
type Lease = { owner: string; expires: number };

// A local lease also covers browsers whose Web Locks service returns an internal error.
export class ProfileLock {
  private owner = crypto.randomUUID();
  private id: string | null = null;
  private unlock: (() => void) | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private leased = false;
  constructor(private onLost: () => void) {
    window.addEventListener('storage', event => {
      if (this.id && this.leased && event.key === PREFIX + this.id && !this.owns(this.id)) this.lost();
    });
  }
  private lease(id: string): Lease | null {
    const text = localStorage.getItem(PREFIX + id);
    if (!text) return null;
    try { const value = JSON.parse(text); return typeof value.owner === 'string' && Number.isFinite(value.expires) ? value : null; }
    catch { return null; }
  }
  private clearLease(id: string): void {
    try { if (this.lease(id)?.owner === this.owner) localStorage.removeItem(PREFIX + id); } catch { /* Storage can be revoked. */ }
  }
  owns(id: string): boolean {
    if (this.id !== id) return false;
    if (!this.leased) return Boolean(this.unlock);
    try { return this.lease(id)?.owner === this.owner; } catch { return Boolean(this.unlock); }
  }
  release(): void {
    clearInterval(this.timer); this.timer = undefined;
    const id = this.id; this.id = null;
    this.unlock?.(); this.unlock = undefined; this.leased = false;
    if (id) this.clearLease(id);
  }
  private lost(): void { this.release(); this.onLost(); }
  async acquire(id: string): Promise<void> {
    if (this.owns(id)) return;
    this.release();
    let leased = false, unlock: (() => void) | undefined;
    try {
      let lease: Lease | null = null;
      try { lease = this.lease(id); } catch { /* Web Locks may still work. */ }
      if (lease && lease.owner !== this.owner && lease.expires > Date.now()) throw new Error(BUSY);
      try { localStorage.setItem(PREFIX + id, JSON.stringify({ owner: this.owner, expires: Date.now() + TTL })); leased = true; } catch { /* Try Web Locks independently. */ }
      if (leased) {
        await new Promise(resolve => setTimeout(resolve, 60));
        if (this.lease(id)?.owner !== this.owner) throw new Error(BUSY);
      }
      let granted = false;
      if (navigator.locks) {
        granted = await new Promise<boolean>(resolve => {
          try {
            void navigator.locks.request(`trigo-master-save-${id}`, { ifAvailable: true }, lock => {
              if (!lock) { resolve(false); return; }
              return new Promise<void>(done => { unlock = done; resolve(true); });
            }).catch(() => resolve(false));
          } catch { resolve(false); }
        });
        if (!granted) {
          // Only an actual held lock warrants the other-tab message. Internal failures do not.
          let held = false;
          try { held = (await navigator.locks.query()).held?.some(lock => lock.name === `trigo-master-save-${id}`) ?? false; } catch { /* Use the lease. */ }
          if (held) throw new Error(BUSY);
        }
      }
      if (!granted && !leased) throw new Error(UNAVAILABLE);
      this.id = id; this.unlock = unlock; this.leased = leased;
      if (leased) this.timer = setInterval(() => {
        if (!this.owns(id)) { this.lost(); return; }
        try { localStorage.setItem(PREFIX + id, JSON.stringify({ owner: this.owner, expires: Date.now() + TTL })); }
        catch { if (!this.unlock) this.lost(); }
      }, 10_000);
    } catch (error) { unlock?.(); this.clearLease(id); throw error; }
  }
}
