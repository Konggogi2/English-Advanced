// 유닛 데이터(표현·예문·대화)에서 문제를 자동으로 만든다.
import { UNITS, CHAPTERS } from './data/index.js';
import { shuffle, normEn } from './util.js';
import { srsDue, store } from './store.js';

export const STAGES = [
  { id: 'e1', name: '표현 ①', icon: '💬', desc: '새 표현 익히기' },
  { id: 'e2', name: '표현 ②', icon: '🗯️', desc: '새 표현 익히기' },
  { id: 'us', name: '쓰임 연습', icon: '🧩', desc: '빈칸·듣기·받아쓰기·문장 만들기' },
  { id: 'dl', name: '스토리 대화', icon: '🎭', desc: '현지인과 대화하기' },
  { id: 'gm', name: '스피드 게임', icon: '⚡', desc: '제한 시간 안에 맞히기' },
  { id: 'ts', name: '유닛 테스트', icon: '🏆', desc: '왕관에 도전' },
];

export const tokensOf = (s) => String(s).replace(/\s+/g, ' ').trim().split(' ').map((t) => t.replace(/^[“"(]+|[”"),.?!;:…]+$/g, '')).filter(Boolean);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const ITEMS = {};
export const REG = { US: '🇺🇸 미국', AU: '🇦🇺 호주', UK: '🇬🇧 영국', ALL: '🌐 어디서나' };
export function indexItems() {
  for (const u of UNITS) {
    (u.ex || []).forEach(([phrase, ko, en, enKo, region, note, form]) => {
      ITEMS['e:' + phrase] = { key: 'e:' + phrase, phrase, ko, en, enKo, region: region || 'ALL', note: note || '', form: (form || phrase).replace(/[.!?]+$/, ''), unit: u.id };
    });
  }
}
indexItems();

export const surface = (it) => { const m = new RegExp(esc(it.form), 'i').exec(it.en); return m ? m[0] : it.form; };
export const blanked = (it) => it.en.replace(new RegExp(esc(it.form), 'i'), '_____');

const pool = (upTo) => Object.values(ITEMS).filter((x) => x.unit <= upTo);
const pickOthers = (it, field, k = 3, ofUnit = true) => {
  const cand = shuffle(pool(it.unit).filter((x) => x.key !== it.key && x[field] !== it[field]));
  cand.sort((a, b) => ((b.unit === it.unit) - (a.unit === it.unit)) * (ofUnit ? 1 : 0) + (Math.random() - 0.5) * 0.8);
  const out = [];
  for (const c of cand) { const v = typeof field === 'function' ? field(c) : c[field]; if (!out.includes(v)) out.push(v); if (out.length >= k) break; }
  return out;
};
const withAns = (opts, ans) => { const all = shuffle([ans, ...opts]); return { opts: all, ans: all.indexOf(ans) }; };

export function qTeach(it) { return { t: 'teach', key: it.key, phrase: it.phrase, ko: it.ko, en: it.en, enKo: it.enKo, region: it.region, note: it.note, say: it.phrase }; }
export function qMean(it) {
  const { opts, ans } = withAns(pickOthers(it, 'ko'), it.ko);
  return { t: 'mc', key: it.key, prompt: '이 표현의 뜻은?', show: it.phrase, region: it.region, audio: it.phrase, opts, ans, say: it.en };
}
export function qPhrase(it) {
  const { opts, ans } = withAns(pickOthers(it, 'phrase'), it.phrase);
  return { t: 'mc', key: it.key, prompt: '알맞은 영어 표현을 고르세요', show: it.ko, opts, ans, speakOpts: true, region: it.region, say: it.en };
}
export function qCloze(it) {
  if (!new RegExp(esc(it.form), 'i').test(it.en)) return null;
  const sf = surface(it);
  const others = shuffle(pool(it.unit).filter((x) => x.key !== it.key)).sort((a, b) => (b.unit === it.unit) - (a.unit === it.unit)).slice(0, 12).map(surface).filter((x) => x.toLowerCase() !== sf.toLowerCase());
  const { opts, ans } = withAns([...new Set(others)].slice(0, 3), sf);
  return { t: 'mc', key: it.key, prompt: '빈칸에 알맞은 표현은?', show: blanked(it), sub: it.enKo, region: it.region, opts, ans, say: it.en, cloze: true };
}
export function qListenMean(it) {
  const { opts, ans } = withAns(pickOthers(it, 'enKo'), it.enKo);
  return { t: 'mc', key: it.key, prompt: '듣고 알맞은 뜻을 고르세요', audio: it.en, region: it.region, autoplay: true, hideShow: true, opts, ans, say: it.en };
}
export function qDictation(it) {
  return { t: 'type', key: it.key, prompt: '들리는 문장을 영어로 써 보세요', sub: '🔊 보통 / 🐢 느리게 · 대소문자와 문장부호는 신경 쓰지 않아도 돼요', audio: it.en, region: it.region, autoplay: true, ans: [it.en], show: it.enKo, say: it.en };
}
export function qBuild(it, listen = false) {
  const toks = tokensOf(it.en);
  const used = new Set(toks.map((t) => t.toLowerCase()));
  const extra = shuffle(pool(it.unit).filter((x) => x.key !== it.key).flatMap((x) => tokensOf(x.en)).filter((t) => t.length > 1 && !used.has(t.toLowerCase()))).slice(0, toks.length > 6 ? 2 : 1);
  return { t: 'build', key: it.key, prompt: listen ? '들리는 문장을 순서대로 배열하세요' : '영어로 배열해 보세요', show: listen ? null : it.enKo, audio: listen ? it.en : null, autoplay: listen, region: it.region, tokens: shuffle([...toks, ...[...new Set(extra)]]), ans: [it.en], say: it.en, ko: it.enKo };
}
export function qRegion(it) {
  const ord = ['US', 'AU', 'UK', 'ALL'];
  return { t: 'mc', key: it.key, prompt: '이 표현은 주로 어디서 들을 수 있나요?', show: it.phrase, sub: it.ko, audio: it.phrase, region: it.region, opts: ord.map((k) => REG[k]), ans: ord.indexOf(it.region), say: it.en, why: it.note ? '📝 ' + it.note : '' };
}
export function qSpeak(it) { return { t: 'speak', key: it.key, tl: it.en, ko: it.enKo, region: it.region, say: it.en, phrase: it.phrase }; }
export function qMatch(items) { const seen = new Set(); const its = items.filter((x) => !seen.has(x.ko) && seen.add(x.ko)).slice(0, 5); return { t: 'match', pairs: its.map((x) => [x.phrase, x.ko]), keys: its.map((x) => x.key), region: 'ALL' }; }

const unitItems = (u) => (u.ex || []).map(([p]) => ITEMS['e:' + p]);

export function dlgQuestions(u, max = 4) {
  const d = u.dlg; if (!d) return [];
  const lines = d.lines, mine = d.me || 'B';
  const out = [];
  lines.forEach((l, i) => {
    if (l[0] !== mine || i === 0) return;
    const ctx = lines.slice(Math.max(0, i - 2), i);
    const sameD = lines.filter((x, j) => j !== i && x[1] !== l[1]).map((x) => x[1]);
    const elsewhere = Object.values(ITEMS).filter((x) => x.unit <= u.id).map((x) => x.en);
    const dist = shuffle([...new Set([...shuffle(sameD).slice(0, 3), ...shuffle(elsewhere)])]).filter((x) => x !== l[1]).slice(0, 3);
    const { opts, ans } = withAns(dist, l[1]);
    out.push({ t: 'dlg', key: 'd:' + u.id + ':' + i, ctx, opts, ans, say: l[1], ko: l[2], region: u.region || 'ALL' });
  });
  return shuffle(out).slice(0, max);
}
export function dialogSpeak(u, n = 3) {
  const d = u.dlg; if (!d) return [];
  return d.lines.filter((l) => l[0] === (d.me || 'B')).slice(0, n).map((l) => ({ t: 'speak', key: 'd:' + u.id + ':' + l[1], tl: l[1], ko: l[2], role: true, say: l[1], region: u.region || 'ALL' }));
}

const mixQ = (it, i) => {
  const fs = [qMean, qPhrase, (x) => qCloze(x) || qMean(x)];
  return fs[i % 3](it);
};

export function lessonQuestions(u, stage) {
  const its = unitItems(u);
  const half = Math.ceil(its.length / 2);
  const qs = [];
  if (stage === 0 || stage === 1) {
    const mine = stage === 0 ? its.slice(0, half) : its.slice(half);
    mine.forEach((it) => qs.push(qTeach(it)));
    shuffle(mine).forEach((it, i) => qs.push(mixQ(it, i)));
    qs.push(qMatch(shuffle(mine)));
    shuffle(mine).slice(0, 3).forEach((it) => qs.push(qListenMean(it)));
    shuffle(mine).slice(0, 2).forEach((it) => qs.push(qSpeak(it)));
    shuffle(mine).filter((x) => x.region !== 'ALL').slice(0, 1).forEach((it) => qs.push(qRegion(it)));
    shuffle(mine).slice(0, 3).forEach((it, i) => qs.push(i % 2 ? qPhrase(it) : (qCloze(it) || qMean(it))));
  } else if (stage === 2) {
    shuffle(its).slice(0, 6).forEach((it) => qs.push(qCloze(it) || qMean(it)));
    shuffle(its).slice(0, 3).forEach((it) => qs.push(qListenMean(it)));
    shuffle(its).slice(0, 4).forEach((it, i) => qs.push(qBuild(it, i % 2 === 1)));
    shuffle(its).slice(0, 3).forEach((it) => qs.push(qDictation(it)));
    shuffle(its).filter((x) => x.region !== 'ALL').slice(0, 2).forEach((it) => qs.push(qRegion(it)));
    shuffle(its).slice(0, 2).forEach((it) => qs.push(qSpeak(it)));
  } else if (stage === 3) {
    qs.push({ t: 'dteach', dlg: u.dlg, title: u.dlg.title, key: 'd:' + u.id, region: u.region || 'ALL' });
    dlgQuestions(u, 4).forEach((q) => qs.push(q));
    dialogSpeak(u, 3).forEach((q) => qs.push(q));
    shuffle(its).slice(0, 2).forEach((it) => qs.push(qBuild(it, true)));
    dlgQuestions(u, 2).forEach((q) => qs.push(q));
  } else if (stage === 4) {
    qs.push(...speedQuestions(u, 14));
  } else {
    qs.push(...testQuestions([u], 16));
  }
  return qs;
}

export function speedQuestions(u, n = 14) {
  const its = shuffle(unitItems(u));
  const out = [];
  for (let i = 0; i < n; i++) {
    const it = its[i % its.length];
    const q = [qMean, qPhrase, (x) => qCloze(x) || qMean(x), qListenMean][i % 4](it);
    q.timed = q.cloze ? 11 : 8; q.speed = true; out.push(q);
  }
  return out;
}

export function testQuestions(units, n = 16) {
  const its = shuffle(units.flatMap(unitItems));
  const out = [];
  its.slice(0, Math.ceil(n * 0.3)).forEach((it, i) => out.push([qMean, qPhrase, qListenMean][i % 3](it)));
  const c = its.slice(Math.ceil(n * 0.3), Math.ceil(n * 0.3) + Math.ceil(n * 0.25));
  c.forEach((it) => out.push(qCloze(it) || qMean(it)));
  its.slice(0, 4).forEach((it, i) => out.push(i % 2 ? qDictation(it) : qBuild(it, true)));
  const tagged = its.filter((x) => x.region !== 'ALL');
  tagged.slice(0, 2).forEach((it) => out.push(qRegion(it)));
  if (its.length >= 5) out.push(qMatch(its.slice(0, 5)));
  units.forEach((u) => dlgQuestions(u, 1).forEach((q) => out.push(q)));
  return shuffle(out).slice(0, n + 3);
}

export function checkpointQuestions(ch) {
  const units = UNITS.filter((u) => u.id >= ch.from && u.id <= ch.to);
  return testQuestions(units, 24);
}

export const learnedKeys = () => Object.keys(store.s.srs).filter((k) => ITEMS[k]);
const learnedItems = () => learnedKeys().map((k) => ITEMS[k]);
export function reviewQuestions(n = 12) {
  const keys = learnedKeys();
  const due = keys.filter((k) => srsDue(k));
  const weak = keys.filter((k) => !due.includes(k)).sort((a, b) => store.s.srs[a].box - store.s.srs[b].box);
  const chosen = shuffle(due).concat(weak).slice(0, n).map((k) => ITEMS[k]);
  const fs = [qMean, qPhrase, (x) => qCloze(x) || qMean(x), qListenMean, (x) => qBuild(x, true)];
  const out = chosen.map((it, i) => fs[i % fs.length](it));
  if (chosen.length >= 4) out.push(qMatch(chosen));
  return shuffle(out);
}
export function listenTraining(n = 12) {
  const its = shuffle(learnedItems());
  const fs = [qListenMean, qDictation, (x) => qBuild(x, true)];
  return its.slice(0, n).map((it, i) => fs[i % 3](it));
}
export function speakTraining(n = 10) { return shuffle(learnedItems()).slice(0, n).map(qSpeak); }
export const hasLearned = () => learnedKeys().length >= 4;
export const dueCount = () => learnedKeys().filter((k) => srsDue(k)).length;
export { UNITS, CHAPTERS };
