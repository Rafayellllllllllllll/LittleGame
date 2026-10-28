/* 谜题引擎：每种题型一个渲染器，校验只认 PUZZLES 里写明的答案。 */
let puzzleState = {};

function hintButton(p) {
  const seen = S.hintsSeen[p.id] || 0;
  return '<button class="btn ghost" id="hintBtn">提示（' + seen + '/3 已看）</button><p class="muted" id="hintText">' +
    (seen ? "已看提示 " + seen + "： " + p.hints[seen - 1] : "卡住了可以看提示，提示分三级，越往后越直接。") + '</p>';
}
function bindHint(p) {
  document.getElementById("hintBtn").onclick = () => {
    const seen = S.hintsSeen[p.id] || 0;
    if (seen >= 3) { setModalFeedback("三级提示都看过了。答案其实已经在提示里了，再回线索档案对一下。"); return; }
    S.hintsSeen[p.id] = seen + 1;
    document.getElementById("hintText").textContent = "提示 " + (seen + 1) + "： " + p.hints[seen];
    document.getElementById("hintBtn").textContent = "提示（" + (seen + 1) + "/3 已看）";
    saveSoon();
  };
}
function finishPuzzle(p, ok) {
  if (isSolved(p.id)) { setModalFeedback("这道题已经解开过了，答案就是你上次解出来的那一个。", true); return; }
  if (ok) {
    if (isSolved(p.id)) { setModalFeedback("这道题已经解开过了。", true); return; }
    setModalFeedback(p.success, true);
    if (p.id === "p2") { addItem("photo"); addClue("photo_family"); addClue("photo_back"); }
    if (p.id === "p3") addClue("raincoat_stitch");
    if (p.id === "p4") { addClue("letter_key"); addClue("letter_mother"); }
    if (p.id === "p7") { addItem("brassKey"); }
    if (p.id === "p8") { unlock("truth"); S.dialogueNode = "done"; }
    solvePuzzle(p.id, p.achievement);
    setTimeout(() => { closeModal(); renderAll(); }, 1600);
  } else {
    AudioFX.fail(); vibrate(40);
    setModalFeedback(p.fail, false);
  }
}
function openPuzzle(id) {
  const p = PUZZLES.find(x => x.id === id);
  if (!p) return;
  if (!puzzleUnlocked(p) && !isSolved(id)) { toast(puzzleLockReason(p)); return; }
  if (isSolved(id)) toast("这道题已经解开了，打开是回顾模式。");
  puzzleState = {};
  let body = "<p>" + p.story + "</p>", actions = [];
  if (p.type === "choice") {
    puzzleState.sel = -1;
    body += p.options.map((o, i) => '<button class="opt-btn" data-opt="' + i + '">' + o + '</button>').join("") + hintButton(p);
    actions = [{ text: "确认答案", cls: "gold", onClick: () => finishPuzzle(p, puzzleState.sel === p.answer) }];
  } else if (p.type === "clock") {
    puzzleState.h = 23; puzzleState.m = 24;
    body += '<div class="clock-face"><div class="hand h" id="handH"></div><div class="hand m" id="handM"></div><div class="clock-center"></div></div>' +
      '<p style="text-align:center"><b id="clockRead">23:24</b>（钟面时间）</p>' +
      '<div class="stepper"><button id="hMinus">−</button><span>时</span><button id="hPlus">+</button><button id="mMinus">−</button><span>分</span><button id="mPlus">+</button></div>' + hintButton(p);
    actions = [{ text: "拨动机关", cls: "gold", onClick: () => finishPuzzle(p, puzzleState.h === p.answer.h && puzzleState.m === p.answer.m) }];
  } else if (p.type === "rotate") {
    puzzleState.side = "front"; puzzleState.rot = 0;
    body += '<p>当前：<b id="rotRead">正面 · 0°</b></p><p id="rotReveal" class="muted">什么也看不到。换个面、转个角度再看。</p>' +
      '<div style="display:flex;gap:10px"><button class="btn paper" id="flipBtn">翻面</button><button class="btn paper" id="rotBtn">旋转 90°</button></div>' + hintButton(p);
    actions = [{ text: "就是这个角度", cls: "gold", onClick: () => finishPuzzle(p, puzzleState.side === "back" && puzzleState.rot === 180) }];
  } else if (p.type === "order") {
    puzzleState.slots = [null, null, null, null];
    body += "<p>点一张碎片，它会放进第一个空格；点空格可以取回。</p><div id='orderSlots'></div><div id='orderPool'></div>" + hintButton(p);
    actions = [{ text: "确认顺序", cls: "gold", onClick: () => finishPuzzle(p, JSON.stringify(puzzleState.slots) === JSON.stringify(p.answer)) }];
  } else if (p.type === "match") {
    puzzleState.match = [0, 0, 0];
    body += p.faces.map((f, i) => "<label>" + f + "<select data-match='" + i + "'>" + p.options.map((o, j) => "<option value='" + j + "'>" + o + "</option>").join("") + "</select></label>").join("") + hintButton(p);
    actions = [{ text: "确认身份", cls: "gold", onClick: () => finishPuzzle(p, JSON.stringify(puzzleState.match) === JSON.stringify(p.answer)) }];
  } else if (p.type === "pair") {
    puzzleState.claim = 0; puzzleState.evidence = 0;
    body += "<label>哪句话是假话？<select id='pairClaim'>" + p.claims.map((c, i) => "<option value='" + i + "'>" + c + "</option>").join("") + "</select></label>" +
      "<label>哪条证据能反驳它？<select id='pairEv'>" + p.evidences.map((c, i) => "<option value='" + i + "'>" + c + "</option>").join("") + "</select></label>" + hintButton(p);
    actions = [{ text: "指出矛盾", cls: "gold", onClick: () => {
      const ok = puzzleState.claim === p.answer.claim && (puzzleState.evidence === p.answer.evidence || puzzleState.evidence === p.altEvidence);
      finishPuzzle(p, ok);
    } }];
  } else if (p.type === "combine") {
    body += "<p>去背包面板选两件道具，再点“组合这两件”；也可以直接在这里选：</p>" +
      "<label>第一件<select id='cb1'>" + S.items.map(id => "<option value='" + id + "'>" + ITEMS[id].name + "</option>").join("") + "</select></label>" +
      "<label>第二件<select id='cb2'>" + S.items.map(id => "<option value='" + id + "'>" + ITEMS[id].name + "</option>").join("") + "</select></label>" + hintButton(p);
    actions = [{ text: "组合", cls: "gold", onClick: () => {
      const a = document.getElementById("cb1").value, b = document.getElementById("cb2").value;
      finishPuzzle(p, (a === p.answer[0] && b === p.answer[1]) || (a === p.answer[1] && b === p.answer[0]));
    } }];
  } else if (p.type === "final") {
    puzzleState.final = [0, 0, 0];
    body += p.questions.map((qq, i) => "<label>" + qq.q + "<select data-final='" + i + "'>" + qq.options.map((o, j) => "<option value='" + j + "'>" + o + "</option>").join("") + "</select></label>").join("") +
      (S.links.length >= 4 ? "<p class='muted'>推理板提醒：你已经连对了 4 组关联，答案就藏在那些关联里。</p>" : "<p class='muted'>推理板提醒：连对 4 组关联会有额外提示（不是必需的）。</p>") + hintButton(p);
    actions = [{ text: "提交最终推理", cls: "gold", onClick: () => finishPuzzle(p, p.questions.every((qq, i) => puzzleState.final[i] === qq.answer)) }];
  }
  openModal(p.title + (isSolved(id) ? "（已解开 · 回顾）" : ""), body, actions);
  bindHint(p);
  /* 绑定各题型交互 */
  document.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => {
    puzzleState.sel = Number(b.dataset.opt);
    document.querySelectorAll("[data-opt]").forEach(x => x.classList.toggle("selected", x === b));
    AudioFX.click();
  });
  const hh = document.getElementById("handH"), mm = document.getElementById("handM");
  function drawClock() {
    if (!hh) return;
    hh.style.transform = "rotate(" + (((puzzleState.h % 12) + puzzleState.m / 60) * 30) + "deg)";
    mm.style.transform = "rotate(" + (puzzleState.m * 6) + "deg)";
    document.getElementById("clockRead").textContent = String(puzzleState.h).padStart(2, "0") + ":" + String(puzzleState.m).padStart(2, "0");
  }
  if (hh) {
    drawClock();
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => { fn(); drawClock(); AudioFX.click(); }; };
    bind("hPlus", () => puzzleState.h = (puzzleState.h + 1) % 24);
    bind("hMinus", () => puzzleState.h = (puzzleState.h + 23) % 24);
    bind("mPlus", () => puzzleState.m = (puzzleState.m + 1) % 60);
    bind("mMinus", () => puzzleState.m = (puzzleState.m + 59) % 60);
  }
  const flip = document.getElementById("flipBtn"), rot = document.getElementById("rotBtn");
  function drawRotate() {
    const read = document.getElementById("rotRead"), rev = document.getElementById("rotReveal");
    if (!read) return;
    read.textContent = (puzzleState.side === "back" ? "背面" : "正面") + " · " + puzzleState.rot + "°";
    if (puzzleState.side === "back" && puzzleState.rot === 180) { rev.textContent = "看到了：内袋有一圈新针脚，旁边绣着小字——“给小默”。"; rev.className = "feedback ok"; }
    else { rev.textContent = puzzleState.side === "back" ? "背面能摸到针脚，但字迹还转不过来。" : "正面什么也看不到。"; rev.className = "muted"; }
  }
  if (flip) { drawRotate(); flip.onclick = () => { puzzleState.side = puzzleState.side === "back" ? "front" : "back"; drawRotate(); AudioFX.click(); }; rot.onclick = () => { puzzleState.rot = (puzzleState.rot + 90) % 360; drawRotate(); AudioFX.click(); }; }
  function drawOrder() {
    const slots = document.getElementById("orderSlots"), pool = document.getElementById("orderPool");
    if (!slots) return;
    slots.innerHTML = puzzleState.slots.map((s, i) => '<div class="slot' + (s !== null ? " filled" : "") + '" data-slot="' + i + '">' + (s !== null ? p.fragments[s] : "空格 " + (i + 1)) + "</div>").join("");
    pool.innerHTML = p.fragments.map((f, i) => puzzleState.slots.includes(i) ? "" : '<button class="letter-frag" data-frag="' + i + '">' + f + "</button>").join("");
    slots.querySelectorAll("[data-slot]").forEach(el => el.onclick = () => { const i = Number(el.dataset.slot); if (puzzleState.slots[i] !== null) { puzzleState.slots[i] = null; drawOrder(); AudioFX.click(); } });
    pool.querySelectorAll("[data-frag]").forEach(el => el.onclick = () => { const empty = puzzleState.slots.indexOf(null); if (empty >= 0) { puzzleState.slots[empty] = Number(el.dataset.frag); drawOrder(); AudioFX.click(); } });
  }
  if (document.getElementById("orderSlots")) drawOrder();
  document.querySelectorAll("[data-match]").forEach(el => el.onchange = () => { puzzleState.match[Number(el.dataset.match)] = Number(el.value); });
  document.querySelectorAll("[data-final]").forEach(el => el.onchange = () => { puzzleState.final[Number(el.dataset.final)] = Number(el.value); });
  const pc = document.getElementById("pairClaim"), pe = document.getElementById("pairEv");
  if (pc) { pc.onchange = () => puzzleState.claim = Number(pc.value); pe.onchange = () => puzzleState.evidence = Number(pe.value); }
}
