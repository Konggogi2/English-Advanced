// 듣기: 브라우저 내장 음성합성. 미국(en-US)·호주(en-AU)·영국(en-GB) 억양을 골라 들을 수 있다.
import { store } from './store.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
const load = () => { try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; } };
if (synth) { load(); synth.addEventListener ? synth.addEventListener('voiceschanged', load) : (synth.onvoiceschanged = load); }

export const allVoices = () => { load(); return voices.filter((v) => /^en/i.test(v.lang)); };
export const ACCENTS = { US: ['en-US', '미국'], AU: ['en-AU', '호주'], UK: ['en-GB', '영국'] };

const norm = (l) => (l || '').toLowerCase().replace('_', '-');
const score = (v) => (v.localService ? 0 : 1) + (/natural|neural|online/i.test(v.name) ? -1 : 0) + (/google|microsoft|samantha|karen|daniel|moira/i.test(v.name) ? -0.5 : 0);

export function voiceFor(accent) {
  load();
  const pref = store.s.settings.voices && store.s.settings.voices[accent];
  if (pref) { const v = voices.find((x) => x.voiceURI === pref); if (v) return v; }
  const lang = (ACCENTS[accent] || ACCENTS.US)[0].toLowerCase();
  const exact = voices.filter((v) => norm(v.lang) === lang).sort((a, b) => score(a) - score(b));
  if (exact.length) return exact[0];
  const en = voices.filter((v) => norm(v.lang).startsWith('en')).sort((a, b) => score(a) - score(b));
  return en[0] || null;
}

// 어떤 억양을 쓸지: 설정이 auto 면 표현의 지역을 따른다
export function accentOf(region) {
  const a = store.s.settings.accent || 'auto';
  if (a !== 'auto') return a;
  return region === 'AU' || region === 'UK' ? region : 'US';
}

export function accentStatus() {
  load();
  const out = {};
  Object.keys(ACCENTS).forEach((k) => { out[k] = voices.some((v) => norm(v.lang) === ACCENTS[k][0].toLowerCase()); });
  return { supported: !!synth, anyEn: voices.some((v) => norm(v.lang).startsWith('en')), by: out };
}

let seq = 0;
export function speak(text, slow = false, region = 'ALL') {
  return new Promise((res) => {
    if (!synth) { res(false); return; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[🔊🙂😄😣]/gu, '').replace(/\s+/g, ' ').trim());
      const v = voiceFor(accentOf(region));
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = (ACCENTS[accentOf(region)] || ACCENTS.US)[0];
      const base = store.s.settings.rate || 0.95;
      u.rate = slow ? Math.max(0.5, base - 0.3) : base;
      const my = ++seq;
      u.onend = () => res(my === seq);
      u.onerror = () => res(false);
      synth.speak(u);
    } catch (e) { res(false); }
  });
}
export const stopSpeak = () => { try { synth && synth.cancel(); } catch (e) { /* */ } };

export async function speakSeq(texts, onLine, region) {
  for (let i = 0; i < texts.length; i++) {
    if (onLine) onLine(i);
    const ok = await speak(texts[i], false, region);
    if (!ok) break;
    await new Promise((r) => setTimeout(r, 350));
  }
  if (onLine) onLine(-1);
}

export const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
export async function startRecord() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((res) => { rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; });
  rec.start();
  return { stop: () => { try { rec.stop(); } catch (e) { /* */ } return done; } };
}
