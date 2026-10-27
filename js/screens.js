import { h, toast } from './util.js';
import { store } from './store.js';
import { STAGES, lessonQuestions, checkpointQuestions, reviewQuestions, listenTraining, speakTraining, hasLearned, dueCount, learnedKeys, ITEMS, UNITS, CHAPTERS, REG } from './gen.js';
import { runLesson } from './lesson.js';
import { speak, speakSeq, allVoices, accentStatus, ACCENTS } from './tts.js';

const app = () => document.getElementById('app');
let tab = 'home';
let route = { name: 'tabs' };

export function go(name, p = {}) { route = { name, ...p }; render(); }
export function setTab(t) { tab = t; route = { name: 'tabs' }; render(); }

export function render() {
  const a = app(); a.innerHTML = '';
  const t = store.s.settings.theme;
  if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  const r = route;
  if (r.name === 'unit') return unitScreen(a, r.id);
  if (r.name === 'lesson') return lessonScreen(a, r);
  if (r.name === 'result') return resultScreen(a, r);
  if (r.name === 'vocabu') return vocabUnit(a, r.id);
  tabsScreen(a);
}

// 챕터는 자유롭게 열 수 있고, 챕터 안에서는 첫 유닛부터 순서대로 열린다.
const isUnlocked = (u) => store.s.settings.open || CHAPTERS.some((c) => c.from === u.id) || store.unit(u.id - 1).st[3] > 0;
const unitStars = (u) => store.unit(u.id).st.reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
const unitDone = (u) => store.unit(u.id).st[5] >= 2;
const chUnlocked = (c) => store.s.settings.open || store.unit(c.to).st[3] > 0;
const chProgress = (c) => UNITS.filter((u) => u.id >= c.from && u.id <= c.to && unitDone(u)).length;
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
const rg = (r) => h('span', { class: 'rg ' + (r || 'ALL') }, REG[r || 'ALL']);

function tabsBar(a) {
  const mk = (id, ic, tx) => h('button', { class: tab === id ? 'on' : '', onclick: () => setTab(id) }, h('b', null, ic), tx);
  a.append(h('div', { class: 'tabs' }, mk('home', '🗺️', '여행'), mk('review', '🔁', '복습'), mk('dict', '📖', '표현집'), mk('more', '⚙️', '더보기')));
}

function tabsScreen(a) {
  const scr = h('div', { class: 'scr' });
  a.append(scr);
  if (tab === 'home') homeTab(scr);
  else if (tab === 'review') reviewTab(scr);
  else if (tab === 'dict') dictTab(scr);
  else moreTab(scr);
  tabsBar(a);
}

// ---------- 홈
const LEVELS = [['Tourist', 0], ['Visitor', 300], ['Regular', 900], ['Local', 1900], ['Insider', 3500], ['Native-ish', 5500], ['Fluent Pro', 8000]];
const levelOf = (xp) => { let i = 0; LEVELS.forEach(([, t], k) => { if (xp >= t) i = k; }); return { name: LEVELS[i][0], next: LEVELS[i + 1] ? LEVELS[i + 1][1] : null, base: LEVELS[i][1] }; };

function todaysItem() {
  const keys = Object.keys(ITEMS);
  const d = new Date();
  return ITEMS[keys[(d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % keys.length]];
}

function homeTab(scr) {
  const s = store.s, lv = levelOf(s.xp);
  const prog = Math.min(100, Math.round((store.todayXp() / s.goal) * 100));
  const doneUnits = UNITS.filter(unitDone).length;
  scr.append(h('div', { class: 'stats' },
    h('div', { class: 'chip' }, h('b', null, '🔥 ' + store.streakNow()), '연속 학습일'),
    h('div', { class: 'chip' }, h('b', null, '⭐ ' + s.xp), lv.name),
    h('div', { class: 'chip' }, h('b', null, '👑 ' + doneUnits), `완료 / ${UNITS.length}`)));
  scr.append(h('div', { class: 'goal' }, h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 } }, h('span', null, '오늘의 목표'), h('span', null, `${Math.min(store.todayXp(), s.goal)} / ${s.goal} XP`)), h('div', { class: 'bar' }, h('i', { style: { width: prog + '%' } }))));
  const t = todaysItem();
  const due = dueCount();
  scr.append(h('div', { class: 'mascot' }, h('div', { class: 'm' }, '🐨'), h('div', { class: 't' }, h('b', null, 'Koa · 오늘의 표현'), h('br'), rg(t.region), h('b', { style: { fontSize: '16px' } }, t.phrase), h('div', null, t.ko), h('button', { class: 'btn sm teal', style: { marginTop: '6px' }, onclick: () => speak(t.en, false, t.region) }, '🔊 ' + t.en), due > 0 ? h('div', { style: { marginTop: '6px' } }, `복습할 표현이 ${due}개 있어요 🔁`) : null)));
  scr.append(h('div', { class: 'chnav' }, CHAPTERS.map((ch) => h('button', { class: 'chbtn', style: { borderColor: ch.color }, onclick: () => { const el = document.getElementById('ch-' + ch.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, h('b', null, ch.flag), h('span', null, ch.city), h('small', null, chProgress(ch) + '/' + UNITS.filter((u) => u.id >= ch.from && u.id <= ch.to).length)))));
  CHAPTERS.forEach((ch) => {
    const us = UNITS.filter((u) => u.id >= ch.from && u.id <= ch.to);
    scr.append(h('div', { class: 'sect', id: 'ch-' + ch.id, style: { background: ch.color } }, h('span', null, `${ch.flag} ${ch.name}`), h('small', null, ch.sub)));
    scr.append(h('div', { style: { fontSize: '13px', color: 'var(--sub)', margin: '6px 4px 0', lineHeight: 1.6 } }, ch.story));
    const path = h('div', { class: 'path' });
    us.forEach((u, i) => {
      const unlocked = isUnlocked(u), st = unitStars(u);
      const off = [0, 40, 60, 40, 0][i % 5] * (Math.floor((u.id - 1) / 5) % 2 ? -1 : 1);
      const wrap = h('div', { style: { transform: `translateX(${off}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } });
      const node = h('button', { class: 'node' + (unitDone(u) ? ' done' : unlocked ? '' : ' lock'), onclick: () => { if (!unlocked) { toast('이 챕터의 앞 유닛 “스토리 대화”까지 끝내면 열려요'); return; } go('unit', { id: u.id }); } },
        unlocked ? u.emoji : '🔒', h('span', { class: 'no' }, u.id), unitDone(u) ? h('span', { class: 'crown' }, '👑') : null);
      wrap.append(node, h('div', { class: 'nlabel' }, h('b', null, u.title), unlocked ? `${st}/6 단계` : ''));
      path.append(wrap);
    });
    const ok = chUnlocked(ch), stars = (s.cps || (s.cps = {}))[ch.id] || 0;
    path.append(h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } },
      h('button', { class: 'node cp' + (stars >= 2 ? ' done' : ok ? '' : ' lock'), onclick: () => { if (!ok) { toast('이 챕터의 마지막 유닛 대화까지 끝내면 열려요'); return; } go('lesson', { kind: 'cp', ch }); } }, ok ? '🛂' : '🔒', stars ? h('span', { class: 'crown' }, '★'.repeat(stars)) : null),
      h('div', { class: 'nlabel' }, h('b', null, ch.city + ' 여권 스탬프'), '챕터 종합 점검')));
    scr.append(path);
  });
  scr.append(h('div', { class: 'card', style: { textAlign: 'center', color: 'var(--sub)', fontSize: '13px' } }, UNITS.length + '개 유닛을 모두 마치면 미국·호주식 숙어와 슬랭, 전치사까지 자연스럽게 구사하는 상급자에 가까워져요. 🌏'));
}

// ---------- 유닛
function unitScreen(a, id) {
  const u = UNITS.find((x) => x.id === id);
  const ch = CHAPTERS.find((c) => id >= c.from && id <= c.to);
  const us = store.unit(id);
  const scr = h('div', { class: 'scr nonav' });
  scr.append(h('div', { class: 'hd' }, h('button', { class: 'back', onclick: () => go('tabs') }, '←'), h('h2', null, `Unit ${u.id} · ${u.title}`)));
  scr.append(h('div', { class: 'scene' }, h('div', { class: 'pl' }, `${ch.flag} ${u.place} · ${u.ko}`), h('div', { class: 'tx' }, u.scene), u.sceneEn ? h('div', { class: 'en' }, u.sceneEn) : null));
  if (u.tips) scr.append(h('div', { class: 'warn', html: '💡 ' + u.tips }));
  STAGES.forEach((stg, i) => {
    const prevOk = i === 0 || us.st[i - 1] > 0 || store.s.settings.open;
    const stars = us.st[i];
    scr.append(h('button', { class: 'stage' + (stars ? ' done' : '') + (prevOk ? '' : ' lock'), onclick: () => { if (!prevOk) { toast('앞 단계를 먼저 끝내 주세요'); return; } go('lesson', { kind: 'unit', id, stage: i }); } },
      h('div', { class: 'ic' }, stg.icon), h('div', { class: 'tx' }, h('b', null, stg.name), stg.desc), h('div', { class: 'stars', style: { color: stars ? '#e8a410' : '#bbb' } }, starStr(stars))));
  });
  scr.append(h('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => go('vocabu', { id }) }, '📖 이 유닛의 표현·대화 모아 보기'));
  a.append(scr);
}

function vocabUnit(a, id) {
  const u = UNITS.find((x) => x.id === id);
  const scr = h('div', { class: 'scr nonav' });
  scr.append(h('div', { class: 'hd' }, h('button', { class: 'back', onclick: () => go('unit', { id }) }, '←'), h('h2', null, `Unit ${u.id} 표현`)));
  const card = h('div', { class: 'card' });
  u.ex.forEach(([p, ko, en, enKo, region, note]) => card.append(h('div', { class: 'wrow', style: { alignItems: 'flex-start' } },
    h('div', { class: 'w' }, rg(region), h('span', { class: 'tl' }, p), h('div', { class: 'ko' }, ko), h('div', { class: 'ko', style: { color: 'var(--ink)', marginTop: '3px' } }, en), h('div', { class: 'ko' }, enKo), note ? h('div', { class: 'ko', style: { color: '#a46a00' } }, '📝 ' + note) : null),
    h('button', { class: 'spk', onclick: () => speak(en, false, region) }, '🔊'), h('button', { class: 'spk slow', onclick: () => speak(en, true, region) }, '🐢'))));
  scr.append(card);
  if (u.dlg) scr.append(h('div', { class: 'card' }, h('h3', null, '대화: ' + u.dlg.title), h('button', { class: 'btn sm teal', style: { marginBottom: '6px' }, onclick: () => speakSeq(u.dlg.lines.map((l) => l[1]), null, u.region) }, '▶ 전체 듣기'),
    u.dlg.lines.map((l) => h('div', { class: 'wrow' }, h('div', { class: 'w' }, h('div', { class: 'tl' }, (l[0] === 'B' ? '🙂 ' : '🧑 ') + l[1]), h('div', { class: 'ko' }, l[2])), h('button', { class: 'spk', onclick: () => speak(l[1], false, u.region) }, '🔊')))));
  a.append(scr);
}

// ---------- 레슨
function lessonScreen(a, r) {
  const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  a.append(wrap);
  let questions, title, onDone;
  if (r.kind === 'unit') {
    const u = UNITS.find((x) => x.id === r.id);
    questions = lessonQuestions(u, r.stage);
    title = `${u.title} · ${STAGES[r.stage].name}`;
    onDone = (res) => {
      const us = store.unit(r.id);
      if (r.stage === 5) { if (res.stars >= 2) us.st[5] = Math.max(us.st[5], res.stars); }
      else us.st[r.stage] = Math.max(us.st[r.stage], res.stars);
      store.save();
      go('result', { res, back: { name: 'unit', id: r.id }, title, nextStage: r.stage < 5 ? r.stage + 1 : null, id: r.id, test: r.stage === 5 });
    };
  } else if (r.kind === 'cp') {
    questions = checkpointQuestions(r.ch); title = r.ch.city + ' 여권 스탬프';
    onDone = (res) => { const c = store.s.cps || (store.s.cps = {}); c[r.ch.id] = Math.max(c[r.ch.id] || 0, res.stars); store.save(); go('result', { res, back: { name: 'tabs' }, title, stamp: res.stars >= 2 ? r.ch : null }); };
  } else if (r.kind === 'listen') {
    questions = listenTraining(12); title = '듣기 훈련';
    onDone = (res) => go('result', { res, back: { name: 'tabs' }, title });
  } else if (r.kind === 'speak') {
    questions = speakTraining(10); title = '말하기 훈련 (Shadowing)';
    onDone = (res) => go('result', { res, back: { name: 'tabs' }, title });
  } else {
    questions = reviewQuestions(12); title = '복습';
    onDone = (res) => go('result', { res, back: { name: 'tabs' }, title });
  }
  if (!questions.length) { toast('아직 복습할 내용이 없어요. 먼저 레슨을 해 보세요!'); setTab(tab); return; }
  runLesson(wrap, { title, questions, xpBase: r.kind === 'review' ? 8 : 10, onExit: () => go(r.kind === 'unit' ? 'unit' : 'tabs', { id: r.id }), onFinish: onDone });
}

function resultScreen(a, r) {
  const { res } = r;
  const scr = h('div', { class: 'scr nonav' });
  const msg = res.stars === 3 ? ['Absolutely nailed it!', '🎉'] : res.stars === 2 ? ['Nice work!', '😊'] : ['You made it! 다시 하면 별이 늘어요', '💪'];
  const extra = r.test ? (res.stars >= 2 ? '👑 왕관을 받았어요! 유닛 완료!' : '테스트는 ★2개 이상이면 왕관을 받아요. 다시 도전해 보세요!') : r.stamp ? `🛂 ${r.stamp.city} 여권 스탬프를 받았어요!` : '';
  scr.append(h('div', { class: 'result' }, h('div', { class: 'big' }, msg[1]), h('h2', { style: { margin: '8px 0' } }, msg[0]), h('div', { class: 'stars', style: { fontSize: '40px', color: '#e8a410' } }, starStr(res.stars)), extra ? h('div', { style: { marginTop: '8px', fontWeight: 800 } }, extra) : null,
    h('div', { class: 'xp' }, h('div', null, h('b', null, '+' + res.xp), 'XP'), h('div', null, h('b', null, Math.round(res.acc * 100) + '%'), '정확도'), h('div', null, h('b', null, '🔥' + store.streakNow()), '연속'))));
  if (r.nextStage != null && !r.test) scr.append(h('button', { class: 'btn pri', style: { marginBottom: '10px' }, onclick: () => go('lesson', { kind: 'unit', id: r.id, stage: r.nextStage }) }, `다음: ${STAGES[r.nextStage].name}`));
  scr.append(h('button', { class: 'btn', onclick: () => go(r.back.name === 'unit' ? 'unit' : 'tabs', r.back) }, r.back.name === 'unit' ? '유닛으로 돌아가기' : '홈으로'));
  a.append(scr);
}

// ---------- 복습
function reviewTab(scr) {
  const due = dueCount(), learned = learnedKeys().length;
  scr.append(h('div', { class: 'hd' }, h('h2', null, '복습')));
  scr.append(h('div', { class: 'card' }, h('h3', null, '간격 반복 복습'), h('div', { style: { fontSize: '14px', color: 'var(--sub)', lineHeight: 1.6 } }, '배운 표현을 잊어버릴 때쯤 다시 보여 줘요. 숙어는 “쓰는 느낌”으로 기억해야 오래가요.'),
    h('div', { class: 'row', style: { margin: '12px 0' } }, h('div', { class: 'chip' }, h('b', null, due), '지금 복습할 것'), h('div', { class: 'chip' }, h('b', null, learned), '배운 표현'))));
  scr.append(h('button', { class: 'btn pri', onclick: () => { if (!learned) { toast('먼저 유닛 1을 시작해 주세요'); return; } go('lesson', { kind: 'review' }); } }, due ? `복습 시작 (${Math.min(due, 12)}문제)` : '약한 표현 연습하기'));
  scr.append(h('div', { class: 'row', style: { marginTop: '12px' } },
    h('button', { class: 'btn teal', onclick: () => { if (!hasLearned()) { toast('유닛 1 레슨을 먼저 해 보세요'); return; } go('lesson', { kind: 'listen' }); } }, '🎧 듣기 훈련'),
    h('button', { class: 'btn sun', onclick: () => { if (!hasLearned()) { toast('유닛 1 레슨을 먼저 해 보세요'); return; } go('lesson', { kind: 'speak' }); } }, '🎤 쉐도잉')));
  scr.append(h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', null, '더 자연스럽게 말하려면'), h('div', { style: { fontSize: '14px', lineHeight: 1.7, color: 'var(--sub)' } },
    ['1) 🐢 느리게 듣고, 같은 속도로 따라 해 보세요.', '2) 🎙로 내 목소리를 녹음해 원어민 소리와 번갈아 들어 보세요.', '3) 표현만 외우지 말고 예문 전체를 입에 붙이세요.', '4) 같은 표현을 미국·호주 억양으로 번갈아 들어 보세요 (더보기 → 억양).'].map((t) => h('div', null, t)))));
}

// ---------- 표현집
function dictTab(scr) {
  scr.append(h('div', { class: 'hd' }, h('h2', null, '표현집')));
  const learnedSet = new Set(learnedKeys());
  const inp = h('input', { class: 'search', placeholder: '영어 표현 또는 한국어 뜻으로 검색', type: 'search' });
  const list = h('div');
  const only = h('select', null, h('option', { value: 'learned' }, '배운 표현만'), h('option', { value: 'all' }, '전체 표현'));
  const regSel = h('select', null, [['', '모든 지역'], ['US', '🇺🇸 미국'], ['AU', '🇦🇺 호주'], ['UK', '🇬🇧 영국'], ['ALL', '🌐 어디서나']].map(([v, t]) => h('option', { value: v }, t)));
  const rows = Object.values(ITEMS);
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    list.innerHTML = '';
    const rs = rows.filter((r) => (only.value === 'all' || learnedSet.has(r.key)) && (!regSel.value || r.region === regSel.value) && (!q || r.phrase.toLowerCase().includes(q) || r.ko.includes(q)));
    if (!rs.length) list.append(h('div', { class: 'card', style: { color: 'var(--sub)' } }, only.value === 'learned' ? '아직 배운 표현이 없어요. 유닛 1부터 시작해 보세요!' : '검색 결과가 없어요.'));
    rs.slice(0, 200).forEach((r) => list.append(h('div', { class: 'wrow' }, h('div', { class: 'w' }, rg(r.region), h('span', { class: 'tl' }, r.phrase), h('div', { class: 'ko' }, r.ko)), h('span', { class: 'lvl' }, 'U' + r.unit), h('button', { class: 'spk', onclick: () => speak(r.en, false, r.region) }, '🔊'))));
  };
  inp.addEventListener('input', draw); only.addEventListener('change', draw); regSel.addEventListener('change', draw);
  scr.append(inp, h('div', { class: 'row', style: { margin: '0 0 8px' } }, only, regSel), list);
  draw();
}

// ---------- 더보기
function moreTab(scr) {
  const s = store.s, lv = levelOf(s.xp);
  scr.append(h('div', { class: 'hd' }, h('h2', null, '더보기')));
  scr.append(h('div', { class: 'card' }, h('h3', null, `Level: ${lv.name}`), h('div', { style: { fontSize: '14px', color: 'var(--sub)' } }, `총 ${s.xp} XP` + (lv.next ? ` · 다음 레벨까지 ${lv.next - s.xp} XP` : ' · 최고 레벨!')), h('div', { class: 'goal', style: { border: 0, padding: 0, marginBottom: 0 } }, h('div', { class: 'bar' }, h('i', { style: { width: lv.next ? Math.round(((s.xp - lv.base) / (lv.next - lv.base)) * 100) + '%' : '100%' } })))));
  // 여권
  const cps = s.cps || {};
  scr.append(h('div', { class: 'card' }, h('h3', null, '🛂 My Passport'), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px' } }, CHAPTERS.map((c) => h('div', { class: 'stamp' + (cps[c.id] >= 2 ? ' got' : '') }, h('div', { class: 's' }, c.flag), c.city)))));
  // 억양/음성
  const st = accentStatus();
  const msg = !st.supported ? '❌ 이 브라우저는 음성 읽기를 지원하지 않아요. 크롬/사파리를 사용해 주세요.' : !st.anyEn ? '⚠️ 영어 음성을 찾지 못했어요. 기기 설정에서 영어 음성을 설치해 주세요.' : `미국 ${st.by.US ? '✅' : '❌'} · 호주 ${st.by.AU ? '✅' : '❌'} · 영국 ${st.by.UK ? '✅' : '❌'} (❌는 다른 영어 음성으로 대신 읽어요)`;
  const accSel = h('select', { onchange: () => { s.settings.accent = accSel.value; store.save(); } }, [['auto', '자동 (표현의 지역을 따라가기)'], ['US', '항상 미국'], ['AU', '항상 호주'], ['UK', '항상 영국']].map(([v, t]) => h('option', { value: v, selected: s.settings.accent === v }, t)));
  const voiceRows = Object.keys(ACCENTS).map((k) => {
    const vs = allVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(ACCENTS[k][0].toLowerCase().slice(0, 2)));
    const sel = h('select', { onchange: () => { (s.settings.voices || (s.settings.voices = {}))[k] = sel.value; store.save(); } }, h('option', { value: '' }, '자동'), vs.map((v) => h('option', { value: v.voiceURI, selected: (s.settings.voices || {})[k] === v.voiceURI }, `${v.name} (${v.lang})`)));
    return h('div', { class: 'switch' }, h('span', null, `${ACCENTS[k][1]} 음성`), sel);
  });
  scr.append(h('div', { class: 'card' }, h('h3', null, '🔊 듣기 · 억양'), h('div', { class: 'warn' }, msg),
    h('div', { class: 'tinyrow' }, h('button', { class: 'btn sm teal', onclick: () => speak("G'day mate! How's it going?", false, 'AU') }, '🇦🇺 호주'), h('button', { class: 'btn sm teal', onclick: () => speak("Hey! What's up? Long time no see.", false, 'US') }, '🇺🇸 미국'), h('button', { class: 'btn sm teal', onclick: () => speak("Cheers! I'm absolutely knackered.", false, 'UK') }, '🇬🇧 영국')),
    h('div', { class: 'switch' }, h('span', null, '억양'), accSel), voiceRows,
    h('div', { class: 'switch' }, h('span', null, '읽는 속도'), h('input', { type: 'range', min: 0.6, max: 1.15, step: 0.05, value: s.settings.rate, style: { width: '55%' }, oninput: (e) => { s.settings.rate = +e.target.value; store.save(); } })),
    h('div', { style: { fontSize: '12px', color: 'var(--sub)', marginTop: '8px', lineHeight: 1.6 } }, 'Android: 설정 → 일반 → 언어 및 입력 → 텍스트 음성 변환(Google) → 영어(호주·영국 등) 음성 데이터 설치.\niPhone: 설정 → 손쉬운 사용 → 말하기 콘텐츠 → 음성 → English (Australia, UK…) 다운로드.'.split('\n').map((t) => h('div', null, t)))));
  scr.append(h('div', { class: 'card' }, h('h3', null, '학습 설정'),
    h('div', { class: 'switch' }, h('span', null, '하루 목표'), (() => { const sel = h('select', { onchange: () => { s.goal = +sel.value; store.save(); } }, [30, 60, 100, 150].map((n) => h('option', { value: n, selected: s.goal === n }, n + ' XP' + (n === 30 ? ' (가볍게)' : n === 60 ? ' (보통)' : n === 100 ? ' (열심히)' : ' (집중)')))); return sel; })()),
    h('label', { class: 'switch' }, h('span', null, '모든 유닛 열어 두기(챕터 내 순서 잠금 해제)'), h('input', { type: 'checkbox', checked: s.settings.open, onchange: (e) => { s.settings.open = e.target.checked; store.save(); } })),
    h('div', { class: 'switch' }, h('span', null, '화면 색'), (() => { const sel = h('select', { onchange: () => { s.settings.theme = sel.value; store.save(); render(); } }, [['', '자동'], ['light', '밝게'], ['dark', '어둡게']].map(([v, t]) => h('option', { value: v, selected: s.settings.theme === v }, t))); return sel; })())));
  scr.append(h('div', { class: 'card' }, h('h3', null, '내 기록'), h('div', { style: { fontSize: '14px', lineHeight: 1.8 } }, `총 XP ${s.xp} · 최고 연속 ${s.best}일 · 완료 유닛 ${UNITS.filter(unitDone).length}/${UNITS.length} · 배운 표현 ${learnedKeys().length}`)));
  scr.append(h('button', { class: 'btn bad', onclick: () => { if (confirm('모든 진도를 지울까요? 되돌릴 수 없어요.')) { store.reset(); render(); toast('초기화했어요'); } } }, '진도 초기화'));
}
