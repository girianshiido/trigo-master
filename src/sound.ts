import startOgg from './audio/start.ogg?url';
import startAac from './audio/start.m4a?url';
import correct1Ogg from './audio/correct-1.ogg?url';
import correct1Aac from './audio/correct-1.m4a?url';
import correct2Ogg from './audio/correct-2.ogg?url';
import correct2Aac from './audio/correct-2.m4a?url';
import correct3Ogg from './audio/correct-3.ogg?url';
import correct3Aac from './audio/correct-3.m4a?url';
import errorOgg from './audio/error.ogg?url';
import errorAac from './audio/error.m4a?url';
import finishOgg from './audio/finish.ogg?url';
import finishAac from './audio/finish.m4a?url';

import achievementOgg from './audio/achievement.ogg?url';
import achievementAac from './audio/achievement.m4a?url';

type Cue = 'achievement' | 'start' | 'correct-1' | 'correct-2' | 'correct-3' | 'error' | 'finish';
const files: Record<Cue, [string, string]> = {
  achievement: [achievementOgg, achievementAac], start: [startOgg, startAac], 'correct-1': [correct1Ogg, correct1Aac],
  'correct-2': [correct2Ogg, correct2Aac], 'correct-3': [correct3Ogg, correct3Aac],
  error: [errorOgg, errorAac], finish: [finishOgg, finishAac],
};

class Sounds {
  enabled = true;
  private context?: AudioContext;
  private output?: GainNode;
  private ready?: Promise<void>;
  private buffers = new Map<Cue, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private bytes = new Map<Cue, Promise<ArrayBuffer | null>>();
  constructor() {
    try { this.enabled = localStorage.getItem('trigo-master-sound') !== 'off'; } catch { /* Storage is optional. */ }
    const format = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 0 : 1;
    for (const [name, urls] of Object.entries(files)) {
      // Fetch small files early, but create/unlock the audio context on a gesture.
      this.bytes.set(name as Cue, fetch(urls[format]).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null));
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
  }
  private unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.gain.value = .65;
      this.output.connect(this.context.destination);
      this.ready = Promise.all([...this.bytes].map(async ([name, bytes]) => {
        const data = await bytes;
        if (data) {
          try { this.buffers.set(name, await this.context!.decodeAudioData(data)); } catch { /* Silent fallback if a codec is unavailable. */ }
        }
      })).then(() => {});
    }
    // resume() is invoked synchronously inside the originating user gesture.
    const resumed = this.context.state === 'suspended' ? this.context.resume() : Promise.resolve();
    return Promise.all([this.ready, resumed]).then(() => {});
  }
  play(cue: Cue): void {
    if (!this.enabled || document.hidden) return;
    const requested = performance.now();
    try {
      void this.unlock().then(() => {
        if (!this.enabled || document.hidden || performance.now() - requested > 350) return;
        const buffer = this.buffers.get(cue);
        if (!buffer || this.context?.state !== 'running') return;
        if (cue === 'finish') this.stop();
        while (this.sources.size >= 4) {
          const oldest = this.sources.values().next().value!;
          this.sources.delete(oldest);
          oldest.stop();
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.output!);
        this.sources.add(source);
        source.onended = () => { this.sources.delete(source); source.disconnect(); };
        source.start();
      }).catch(() => {});
    } catch { /* Gameplay remains available if audio is disabled by the browser. */ }
  }
  activate(): void {
    if (this.enabled) { try { void this.unlock().catch(() => {}); } catch { /* Optional audio. */ } }
  }
  private stop(): void {
    for (const source of this.sources) source.stop();
    this.sources.clear();
  }
  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop();
    try { localStorage.setItem('trigo-master-sound', this.enabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
    if (this.enabled) this.play('correct-1');
  }
}
export const sounds = new Sounds();
