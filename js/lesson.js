// 레슨 진행기: 문제를 차례로 풀고, 틀린 문제는 뒤로 보내 다시 풀게 한다.
import { h, confetti, toast } from './util.js';
import { mountQ } from './ex.js';
import { speak, stopSpeak } from './tts.js';
import { store, srsMark, srsTouch } from './store.js';

const PRAISE = ['Nice one! 👏', 'Spot on!', 'Nailed it!', 'Way to go!', 'Perfect!', 'You got it!'];
const ENCOURAGE = ["No worries! 다시 나와요", "Close one! 이렇게 기억해 봐요", "Don't sweat it! 조금만 더"];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

// opts: { title, questions, onExit(), onFinish(result), xpBase }
export function runLesson(root, opts) {
  const total = opts.questions.length;
  const queue = opts.questions.slice();
  let done = 0, graded = 0, firstOk = 0, mistakeKeys = new Set(), retry = new Map();
  let fastCount = 0;
  let comp = null, current = null, state = 'q'; // q → fb
  root.innerHTML = '';
  const bar = h('i'); bar.style.width = '0%';
  const hd = h('div', { class: 'lhd' }, h('button', { class: 'x', 'aria-label': '나가기', onclick: () => { stopSpeak(); if (confirm('레슨을 그만둘까요? 진행 상황은 저장되지 않아요.')) opts.onExit(); } }, '✕'), h('div', { class: 'pbar' }, bar));
  const body = h('div', { class: 'lbody' });
  const fb = h('div', { class: 'fb idle' });
  const btn = h('button', { class: 'btn pri' }, '확인');
  fb.append(btn);
  root.append(hd, body, fb);

  function progress() { bar.style.width = Math.min(100, Math.round((done / total) * 100)) + '%'; }

  function next() {
    stopSpeak();
    if (comp && comp.stop) comp.stop();
    if (!queue.length) { finish(); return; }
    current = queue.shift();
    window.__q = current;
    state = 'q';
    body.innerHTML = ''; body.scrollTop = 0;
    fb.className = 'fb idle'; fb.innerHTML = ''; fb.append(btn);
    const hooks = {
      ready: (b) => { btn.disabled = !b; },
      submit: () => { if (!btn.disabled && state === 'q') check(); },
      done: (res) => settle(res),
      timeout: () => { if (state === 'q' && comp && comp.check) settle(comp.check()); },
    };
    comp = mountQ(current, hooks);
    body.append(comp.el);
    if (comp.noCheck && !comp.teach) { btn.style.display = 'none'; }
    else { btn.style.display = ''; }
    if (comp.teach) { btn.disabled = false; btn.textContent = '계속'; btn.className = 'btn teal'; }
    else { btn.disabled = true; btn.textContent = '확인'; btn.className = 'btn pri'; }
    btn.onclick = comp.teach ? () => { if (current.key) srsTouch(current.key); done++; progress(); next(); } : check;
    if (comp.autoplay) setTimeout(() => speak(typeof comp.autoplay === 'string' ? comp.autoplay : current.audio, false, current.region), 350);
  }

  function check() {
    if (state !== 'q') return;
    const res = comp.check();
    settle(res);
  }

  function settle(res) {
    if (state !== 'q') return;
    state = 'fb';
    const q = current;
    const isGraded = q.t !== 'speak' && q.t !== 'match';
    const first = !retry.has(q);
    if (q.t === 'match') {
      graded++; if (res.mistakes === 0) firstOk++;
      (q.keys || []).forEach((k) => srsMark(k, res.mistakes === 0));
    } else if (isGraded) {
      if (first) { graded++; if (res.correct) firstOk++; }
      if (q.key) srsMark(q.key, res.correct);
      if (!res.correct) { retry.set(q, true); queue.push(q); mistakeKeys.add(q.key); }
    } else if (q.t === 'speak') {
      if (q.key) srsMark(q.key, res.rating >= 1);
    }
    if (res.fast) fastCount++;
    done++; progress();
    if (res.silent) {
      // 말하기·짝 맞추기는 바로 다음으로
      if (q.t === 'match') { toast(res.correct ? 'Perfect match! 👏' : '완성! (몇 번 틀렸어요)', 1100); }
      setTimeout(next, q.t === 'match' ? 700 : 150);
      return;
    }
    fb.className = 'fb ' + (res.correct ? 'ok' : 'no');
    fb.innerHTML = '';
    fb.append(h('div', { class: 'tt' }, res.correct ? rnd(PRAISE) : rnd(ENCOURAGE)));
    if (!res.correct || res.extra) fb.append(h('div', { class: 'ans' }, res.correct ? res.extra : ['정답: ', h('b', null, res.ans), res.extra ? h('div', { style: { color: 'var(--sub)', fontSize: '13px' } }, res.extra) : null]));
    const go = h('button', { class: 'btn ' + (res.correct ? 'pri' : 'bad'), onclick: next }, '계속');
    fb.append(go);
    if (res.say) speak(res.say, false, res.region || current.region);
  }

  function finish() {
    stopSpeak();
    const acc = graded ? firstOk / graded : 1;
    const stars = acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : 1;
    const xp = (opts.xpBase || 10) + firstOk + fastCount;
    store.addXp(xp);
    if (stars >= 2) confetti();
    opts.onFinish({ acc, stars, xp, graded, firstOk, fast: fastCount });
  }

  progress();
  next();
}
