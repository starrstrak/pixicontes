// Enregistrement micro (MediaRecorder) avec niveau sonore, détection de silence, et repli reconnaissance du navigateur.
import { api, KidError } from './api';

export type RecResult = { text: string; silent: boolean };
export class Recorder {
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private stream?: MediaStream;
  private ac?: AudioContext;
  private t0 = 0;
  private peak = 0;
  private timer?: number;
  level = 0;
  static supported() { return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia; }

  async start(onLevel: (l: number) => void, onAutoStop: () => void) {
    if (!Recorder.supported()) throw new KidError('Pour parler à Pixi, il faut ouvrir l’app avec le cadenas (https). Demande à un grand, ou écris avec le clavier !', 'mic');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const n = (e as DOMException).name;
      throw new KidError(n === 'NotAllowedError' ? 'Pixi n’entend pas encore. Demande à un grand d’autoriser le micro !' : 'Je ne trouve pas de micro. Tu peux écrire avec le clavier !', 'mic');
    }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = []; this.peak = 0; this.t0 = Date.now();
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.ac = new AudioContext();
    const an = this.ac.createAnalyser(); an.fftSize = 512;
    this.ac.createMediaStreamSource(this.stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    let quietSince = Date.now(), spoke = false;
    this.timer = window.setInterval(() => {
      an.getByteTimeDomainData(buf);
      let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
      this.level = m / 128; this.peak = Math.max(this.peak, this.level);
      onLevel(this.level);
      if (this.level > 0.06) { quietSince = Date.now(); spoke = true; }
      // L'enfant hésite : on attend jusqu'à 3,5 s de calme après qu'il a parlé (8 s s'il n'a encore rien dit), max 30 s.
      const quiet = Date.now() - quietSince;
      if ((spoke && quiet > 3500) || (!spoke && quiet > 8000) || Date.now() - this.t0 > 30000) onAutoStop();
    }, 100);
  }
  async stop(lang: string): Promise<RecResult> {
    window.clearInterval(this.timer);
    const rec = this.rec!;
    const done = new Promise<void>((r) => { rec.onstop = () => r(); });
    if (rec.state !== 'inactive') rec.stop();
    await done;
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ac?.close();
    const seconds = (Date.now() - this.t0) / 1000;
    if (this.peak < 0.05 || seconds < 0.6) return { text: '', silent: true }; // silence : rien n'est envoyé (économie)
    const blob = new Blob(this.chunks, { type: rec.mimeType });
    const f = new FormData();
    f.append('lang', lang); f.append('seconds', seconds.toFixed(1)); f.append('audio', blob, 'voix');
    return api.form<RecResult>('/api/stt', f);
  }
  cancel() { window.clearInterval(this.timer); try { this.rec?.stop(); } catch { /* ignore */ } this.stream?.getTracks().forEach((t) => t.stop()); void this.ac?.close(); }
}

/** Repli : reconnaissance vocale du navigateur (si activée en admin). */
export function browserRecognize(lang: string): Promise<string> | null {
  const SR = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const C = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
  if (!C) return null;
  return new Promise((res) => {
    const r = new C();
    r.lang = { fr: 'fr-FR', de: 'de-DE', en: 'en-GB' }[lang] ?? 'fr-FR';
    r.onresult = (e: any) => res(e.results[0][0].transcript as string); // eslint-disable-line @typescript-eslint/no-explicit-any
    r.onerror = () => res('');
    r.onend = () => res('');
    r.start();
  });
}
