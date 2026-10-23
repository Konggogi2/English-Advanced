// 문제 유형별 화면. 각 함수는 { el, check?, auto? } 를 돌려준다.
import { h, shuffle, normEn, lev } from './util.js';
import { speak, stopSpeak, canRecord, startRecord, speakSeq } from './tts.js';
import { REG } from './gen.js';

const rgBadge = (r) => (r && r !== 'ALL' ? h('span', { class: 'rg ' + r }, REG[r]) : h('span', { class: 'rg ALL' }, REG.ALL));
const spk = (text, cls = '', region = 'ALL') => h('button', { class: 'spk ' + cls, 'aria-label': '듣기', onclick: (e) => { e.stopPropagation(); speak(text, cls.includes('slow'), region); } }, cls.includes('slow') ? '🐢' : '🔊');
const title = (q) => h('div', { class: 'q-t' }, q.prompt, q.sub && q.t !== 'mc' ? h('small', null, q.sub) : null);
const bigListen = (q) => h('div', { class: 'bubble', style: { justifyContent: 'center', gap: '18px' } }, spk(q.audio, 'lg', q.region), spk(q.audio, 'lg slow', q.region));

function mc(q, hooks) {
  let sel = -1, tmr = null, t0 = Date.now();
  const el = h('div');
  el.append(title(q));
  if (q.hideShow && q.audio) el.append(bigListen(q));
  else if (q.show != null) {
    el.append(h('div', { class: 'bubble' }, q.audio ? spk(q.audio, '', q.region) : null, h('div', null, q.region && !q.cloze && q.t === 'mc' && q.prompt.startsWith('이 표현') ? rgBadge(q.region) : null, h('span', { class: q.cloze ? '' : 'phr' }, q.show), q.sub ? h('div', { class: 'ko' }, q.sub) : null)));
  }
  const box = h('div', { class: 'opts' });
  const btns = q.opts.map((o, i) => h('button', { class: 'opt', onclick: () => {
    if (box.dataset.lock) return;
    sel = i; btns.forEach((b, j) => b.classList.toggle('sel', j === i));
    if (q.speakOpts) speak(o, false, q.region);
    hooks.ready(true);
  } }, o));
  btns.forEach((b) => box.append(b));
  el.append(box);
  if (q.timed) {
    const bar = h('div', { class: 'tbar' }, h('i'));
    el.insertBefore(bar, box);
    const fill = bar.firstChild;
    fill.style.transition = `width ${q.timed}s linear`;
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = '0%'; }));
    tmr = setTimeout(() => { if (!box.dataset.lock) hooks.timeout(); }, q.timed * 1000);
  }
  return {
    el,
    stop() { clearTimeout(tmr); },
    check() {
      clearTimeout(tmr);
      box.dataset.lock = '1';
      const ok = sel === q.ans;
      const fast = ok && q.timed && Date.now() - t0 < 4500;
      btns.forEach((b, j) => { b.classList.remove('sel'); if (j === q.ans) b.classList.add('ok'); else if (j === sel) b.classList.add('no'); });
      return { correct: ok, ans: q.opts[q.ans], say: q.say, fast, region: q.region, extra: q.why };
    },
    autoplay: q.autoplay && q.audio,
  };
}

function type(q, hooks) {
  const el = h('div');
  el.append(title(q), bigListen(q));
  const inp = h('input', { class: 'inp', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'Type what you hear' });
  inp.addEventListener('input', () => hooks.ready(inp.value.trim().length > 0));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) hooks.submit(); });
  el.append(inp);
  return {
    el,
    check() {
      inp.disabled = true;
      const v = normEn(inp.value);
      const exact = q.ans.some((a) => normEn(a) === v);
      const close = !exact && q.ans.some((a) => { const n = normEn(a); return n.length >= 18 && lev(n, v) <= 2; });
      return { correct: exact || close, ans: q.ans[0], say: q.say, region: q.region, extra: (close ? '거의 맞았어요! 철자를 확인해 보세요.\n' : '') + (q.show ? '뜻: ' + q.show : '') };
    },
    autoplay: true,
  };
}

function build(q, hooks) {
  const el = h('div');
  el.append(title(q));
  if (q.show) el.append(h('div', { class: 'bubble' }, h('div', null, q.show)));
  else if (q.audio) el.append(bigListen(q));
  const ansBox = h('div', { class: 'answer' });
  const tileBox = h('div', { class: 'tiles' });
  const chosen = [];
  const tiles = q.tokens.map((t, i) => h('button', { class: 'tile', onclick: () => add(i) }, t));
  function add(i) { if (tiles[i].classList.contains('used')) return; tiles[i].classList.add('used'); chosen.push(i); draw(); }
  function draw() {
    ansBox.innerHTML = '';
    chosen.forEach((i, k) => ansBox.append(h('button', { class: 'tile', onclick: () => { if (ansBox.dataset.lock) return; chosen.splice(k, 1); tiles[i].classList.remove('used'); draw(); } }, q.tokens[i])));
    hooks.ready(chosen.length > 0);
  }
  tiles.forEach((t) => tileBox.append(t));
  el.append(ansBox, tileBox);
  return {
    el,
    check() {
      ansBox.dataset.lock = '1';
      const got = normEn(chosen.map((i) => q.tokens[i]).join(' '));
      const ok = q.ans.some((a) => normEn(a) === got);
      return { correct: ok, ans: q.ans[0], say: q.say, region: q.region, extra: q.ko ? '뜻: ' + q.ko : '' };
    },
    autoplay: q.autoplay && q.audio,
  };
}

function match(q, hooks) {
  const el = h('div');
  el.append(h('div', { class: 'q-t' }, '표현과 뜻을 짝지어 보세요', h('small', null, '영어 표현을 누르면 소리가 나요')));
  const lefts = shuffle(q.pairs.map((p, i) => ({ t: p[0], i })));
  const rights = shuffle(q.pairs.map((p, i) => ({ t: p[1], i })));
  const grid = h('div', { class: 'pairs' });
  let selL = null, selR = null, left = q.pairs.length, mistakes = 0;
  const L = lefts.map((x) => h('button', { class: 'pair', onclick: () => pickSide('L', x.i, btnL(x.i)) }, x.t));
  const R = rights.map((x) => h('button', { class: 'pair', style: { fontSize: '14px' }, onclick: () => pickSide('R', x.i, btnR(x.i)) }, x.t));
  const btnL = (i) => L[lefts.findIndex((x) => x.i === i)];
  const btnR = (i) => R[rights.findIndex((x) => x.i === i)];
  function pickSide(side, i, b) {
    if (side === 'L') { speak(q.pairs[i][0]); if (selL != null) btnL(selL).classList.remove('sel'); selL = i; b.classList.add('sel'); }
    else { if (selR != null) btnR(selR).classList.remove('sel'); selR = i; b.classList.add('sel'); }
    if (selL != null && selR != null) {
      if (selL === selR) {
        const a = btnL(selL), c = btnR(selR);
        setTimeout(() => { a.classList.add('gone'); c.classList.add('gone'); }, 180);
        selL = selR = null; left--;
        if (left === 0) setTimeout(() => hooks.done({ correct: mistakes === 0, ans: '', silent: true, mistakes }), 450);
      } else {
        mistakes++;
        const a = btnL(selL), c = btnR(selR);
        [a, c].forEach((x) => { x.classList.remove('sel'); x.classList.add('wrong'); setTimeout(() => x.classList.remove('wrong'), 400); });
        selL = selR = null;
      }
    }
  }
  for (let k = 0; k < q.pairs.length; k++) grid.append(L[k], R[k]);
  el.append(grid);
  return { el, auto: true, noCheck: true };
}

function speakQ(q, hooks) {
  const el = h('div');
  el.append(h('div', { class: 'q-t' }, q.role ? '역할 연습: 소리 내어 말해 보세요' : '따라 말해 보세요 (Shadowing)', h('small', null, '듣고 → 소리 내어 따라 하고 → 스스로 평가해요. 억양과 리듬까지 흉내 내 보세요!')));
  el.append(h('div', { class: 'bubble', style: { flexDirection: 'column', alignItems: 'stretch' } },
    h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, h('div', { style: { flex: 1, fontSize: '19px', lineHeight: 1.45 } }, !q.role ? rgBadge(q.region) : null, q.tl, h('div', { class: 'ko' }, q.ko)), spk(q.tl, '', q.region), spk(q.tl, 'slow', q.region))));
  const recRow = h('div', { class: 'rec' });
  const rate = h('div', { class: 'rate' });
  let rec = null, url = null, audio = null;
  if (canRecord()) {
    const rb = h('button', { class: 'btn sm teal', onclick: async () => {
      if (rec) {
        const blob = await rec.stop(); rec = null; rb.textContent = '🎙 다시 녹음'; dot.remove();
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob); audio = new Audio(url); pb.style.display = '';
        return;
      }
      try { stopSpeak(); rec = await startRecord(); rb.textContent = '⏹ 녹음 끝내기'; recRow.append(dot); } catch (e) { rb.textContent = '🎙 마이크를 쓸 수 없어요'; rb.disabled = true; }
    } }, '🎙 내 목소리 녹음');
    const dot = h('span', { class: 'recdot' });
    const pb = h('button', { class: 'btn sm sun', style: { display: 'none' }, onclick: () => { if (audio) { audio.currentTime = 0; audio.play(); } } }, '▶ 내 목소리 듣기');
    recRow.append(rb, pb);
    el.append(recRow);
  }
  [['😣', '어려워요', 0], ['🙂', '괜찮아요', 1], ['😄', '자신 있어요', 2]].forEach(([e, t, v]) => {
    rate.append(h('button', { onclick: () => { stopSpeak(); if (rec) rec.stop(); hooks.done({ correct: true, silent: true, rating: v, ans: '' }); } }, e, h('small', null, t)));
  });
  el.append(rate);
  return { el, auto: true, noCheck: true, autoplay: q.tl };
}

function dlg(q, hooks) {
  const el = h('div');
  el.append(h('div', { class: 'q-t' }, '가장 자연스러운 대답을 고르세요'));
  const b = h('div', { class: 'dlgb' });
  q.ctx.forEach((l) => b.append(h('div', { class: 'msg' + (l[0] === 'B' ? ' me' : '') }, h('div', null, l[1], h('span', { class: 'ko' }, l[2])), spk(l[1], '', q.region))));
  b.append(h('div', { class: 'msg me', style: { opacity: .6 } }, '…'));
  el.append(b);
  const box = h('div', { class: 'opts' });
  let sel = -1;
  const btns = q.opts.map((o, i) => h('button', { class: 'opt', onclick: () => { if (box.dataset.lock) return; sel = i; btns.forEach((x, j) => x.classList.toggle('sel', i === j)); speak(o, false, q.region); hooks.ready(true); } }, o));
  btns.forEach((x) => box.append(x));
  el.append(box);
  return {
    el,
    check() {
      box.dataset.lock = '1';
      btns.forEach((x, j) => { x.classList.remove('sel'); if (j === q.ans) x.classList.add('ok'); else if (j === sel) x.classList.add('no'); });
      return { correct: sel === q.ans, ans: q.opts[q.ans], say: q.say, region: q.region, extra: '뜻: ' + q.ko };
    },
  };
}

function teach(q) {
  const el = h('div', { class: 'teach' });
  el.append(h('div', null, rgBadge(q.region)));
  el.append(h('div', { class: 'big', style: { fontSize: q.phrase.length > 22 ? '24px' : '30px', margin: '12px 0 4px' } }, q.phrase));
  el.append(h('div', { class: 'mean' }, q.ko));
  el.append(h('div', { style: { display: 'flex', gap: '14px', justifyContent: 'center' } }, spk(q.phrase, 'lg', q.region), spk(q.phrase, 'lg slow', q.region)));
  el.append(h('div', { class: 'card exs' }, h('div', { style: { fontSize: '12px', color: 'var(--sub)', marginBottom: '4px' } }, 'Example · 예문'),
    h('div', { class: 'ex' }, h('div', null, h('div', { class: 'tl' }, q.en), h('div', { class: 'ko' }, q.enKo)), spk(q.en, '', q.region), spk(q.en, 'slow', q.region))));
  if (q.note) el.append(h('div', { class: 'note2' }, '📝 ' + q.note));
  return { el, noCheck: true, teach: true, autoplay: q.phrase };
}

function dteach(q) {
  const el = h('div');
  el.append(h('div', { class: 'q-t' }, q.title || '대화 듣기', h('small', null, '내 역할은 오른쪽(B)이에요. 각 줄의 🔊를 눌러 들어 보세요')));
  el.append(h('button', { class: 'btn sm teal', style: { marginBottom: '10px' }, onclick: () => speakSeq(q.dlg.lines.map((l) => l[1]), null, q.region) }, '▶ 대화 전체 듣기'));
  const b = h('div', { class: 'dlgb' });
  q.dlg.lines.forEach((l) => b.append(h('div', null, h('div', { class: 'who', style: l[0] === 'B' ? { textAlign: 'right' } : null }, l[0] === 'B' ? 'Me' : (q.dlg.who || 'Local')), h('div', { class: 'msg' + (l[0] === 'B' ? ' me' : ''), style: l[0] === 'B' ? { marginLeft: 'auto' } : null }, h('div', null, l[1], h('span', { class: 'ko' }, l[2])), spk(l[1], '', q.region)))));
  el.append(b);
  return { el, noCheck: true, teach: true };
}

export function mountQ(q, hooks) {
  const f = { mc, type, build, match, speak: speakQ, dlg, teach, dteach }[q.t];
  return f(q, hooks);
}
