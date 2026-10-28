/* 通用 UI：弹窗、提示、场景、背包、线索、谜题列表、设置。 */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.hidden = false; el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; el.style.display = "none"; }, 3200);
}
function showView(id) {
  ["view-home", "view-game", "view-ending"].forEach(v => {
    const el = document.getElementById(v);
    el.hidden = (v !== id); el.style.display = (v === id ? "block" : "none");
  });
  const tb = document.getElementById("topbar");
  tb.hidden = (id === "view-home"); tb.style.display = (id === "view-home" ? "none" : "flex");
  const app = document.getElementById("app");
  app.hidden = false; app.style.display = "block";
}
function openModal(title, bodyHTML, actions) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHTML;
  const box = document.getElementById("modalActions"); box.innerHTML = "";
  (actions || []).forEach(a => {
    const b = document.createElement("button");
    b.className = "btn " + (a.cls || "paper"); b.textContent = a.text;
    b.onclick = () => { AudioFX.click(); a.onClick && a.onClick(); };
    box.appendChild(b);
  });
  setModalFeedback("");
  const bd = document.getElementById("modalBackdrop");
  bd.hidden = false; bd.style.display = "flex";
}
function closeModal() {
  const bd = document.getElementById("modalBackdrop");
  bd.hidden = true; bd.style.display = "none";
}
/* 页面内确认框：不用浏览器自带的 confirm()，那种框在部分环境里会被直接按取消，看起来像按钮死了。 */
function showConfirm(title, body, confirmText, onConfirm) {
  openModal(title, "<p>" + body + "</p>", [
    { text: confirmText, cls: "gold", onClick: () => { closeModal(); onConfirm(); } },
    { text: "取消", onClick: closeModal }
  ]);
}
function setModalFeedback(msg, ok) {
  const el = document.getElementById("modalFeedback");
  el.textContent = msg; el.className = "feedback" + (ok === true ? " ok" : ok === false ? " bad" : "");
}
function renderStats() {
  document.getElementById("clueStat").textContent = S.clues.length + "/14";
  document.getElementById("trustStat").textContent = S.trust;
  document.getElementById("puzzleStat").textContent = S.solved.length + "/8";
  document.getElementById("npcTrust").textContent = S.trust;
  const saveLine = document.getElementById("saveLine");
  if (saveLine) saveLine.textContent = S.updatedAt && S.clues.length + S.solved.length > 0
    ? "本地存档：已有进度（" + new Date(S.updatedAt).toLocaleString() + "），点“继续游戏”回来。"
    : "还没有本地存档";
  document.getElementById("achList").textContent = S.achievements.length
    ? S.achievements.map(a => ACHIEVEMENTS[a] || a).join("、") : "暂无";
}
function renderBag() {
  const box = document.getElementById("bagList");
  if (!S.items.length) { box.innerHTML = '<p class="empty">背包还是空的。去场景里调查，就会有东西放进来。</p>'; }
  else {
    box.innerHTML = S.items.map(id => '<button class="item-row' + (S.selectedItems.includes(id) ? " selected" : "") + '" data-bag="' + id + '"><b>' + ITEMS[id].name + '</b><span>' + ITEMS[id].desc + '</span></button>').join("");
    box.querySelectorAll("[data-bag]").forEach(b => b.onclick = () => toggleBagSelect(b.dataset.bag));
  }
  const cb = document.getElementById("combineBox");
  cb.hidden = S.selectedItems.length === 0;
  document.getElementById("combineSel").textContent = S.selectedItems.map(id => ITEMS[id].name).join(" + ") || "无";
}
function toggleBagSelect(id) {
  AudioFX.click(); vibrate(15);
  if (S.selectedItems.includes(id)) S.selectedItems = S.selectedItems.filter(x => x !== id);
  else if (S.selectedItems.length < 2) S.selectedItems.push(id);
  else { S.selectedItems = [S.selectedItems[1], id]; }
  document.getElementById("combineFeedback").textContent = "";
  renderBag(); saveSoon();
}
function renderClues() {
  const box = document.getElementById("clueList");
  if (!S.clues.length) { box.innerHTML = '<p class="empty">还没有线索。调查物品、解开谜题、和来访者对话都会留下线索。</p>'; return; }
  box.innerHTML = S.clues.map(id => '<div class="clue-row"><b>' + CLUES[id].title + '</b><span>' + CLUES[id].text + '</span><span class="muted">来源：' + CLUES[id].source + '</span></div>').join("");
  if (S.clues.length >= 14 && !S.achievements.includes("full_clues")) unlock("full_clues");
}
function puzzleUnlocked(p) {
  if (p.id === "p1") return hasItem("tape");
  if (p.id === "p2") return hasItem("logbook") || hasClue("clock_stop");
  if (p.id === "p3") return hasItem("raincoat");
  if (p.id === "p4") return hasItem("letter");
  if (p.id === "p5") return hasItem("photo");
  if (p.id === "p6") return hasClue("visitor_claim");
  if (p.id === "p7") return hasItem("raincoat") && hasItem("scissors");
  if (p.id === "p8") return ["p1","p2","p3","p4","p5","p6","p7"].every(isSolved);
  return true;
}
function puzzleLockReason(p) {
  const map = { p1: "先调查旧录音机，拿到录音带。", p2: "先调查墙上时钟和员工记录本。", p3: "先打开三号柜，拿到旧雨衣。", p4: "先打开上锁的抽屉，拿到残信碎片。", p5: "先解开时钟机关，拿到旧照片。", p6: "先和门口的来访者说说话。", p7: "需要同时有旧雨衣和剪刀。", p8: "先解开前面 7 个谜题，证据齐了才能做最终推理。" };
  return map[p.id] || "";
}
function renderPuzzles() {
  const box = document.getElementById("puzzleList");
  box.innerHTML = PUZZLES.map(p => {
    const solved = isSolved(p.id), open = puzzleUnlocked(p);
    return '<div class="puzzle-row"><div><b>' + p.title + '</b><br><span class="muted">' + (solved ? "已解开" : open ? "可以解了" : puzzleLockReason(p)) + '</span></div>' +
      '<button class="btn ' + (solved ? "paper" : "gold") + '" ' + (open ? "" : "disabled") + ' data-puzzle="' + p.id + '">' + (solved ? "回顾" : "解谜") + '</button></div>';
  }).join("");
  box.querySelectorAll("[data-puzzle]").forEach(b => b.onclick = () => openPuzzle(b.dataset.puzzle));
}
function renderSettings() {
  document.getElementById("setSound").checked = S.settings.sound;
  document.getElementById("setVibrate").checked = S.settings.vibrate;
  document.getElementById("setLarge").checked = S.settings.large;
  document.getElementById("setMotion").checked = S.settings.motion;
  document.body.classList.toggle("large", S.settings.large);
  document.body.classList.toggle("no-motion", !S.settings.motion);
}
function renderAll() { renderStats(); renderBag(); renderClues(); renderPuzzles(); renderBoard(); renderDialogue(); renderSettings(); }

/* 场景调查 */
function investigate(item) {
  AudioFX.click(); vibrate(20);
  if (item === "recorder") {
    addItem("tape"); addClue("tape_2303"); addClue("tape_2312");
    openModal("旧录音机", "<p>带子转得很慢，雨声底下有两段话。</p><p><b>23:03</b> 男声：“我把伞忘在三号柜了。”——这声音就是门口那个人。</p><p><b>23:12</b> 女声：“钥匙不在抽屉，在旧雨衣的口袋里。”她叫了一声“小默”。</p><p>录音带已经放进背包。时间线对不上来访者的说法，去谜题 1 看看。</p>",
      [{ text: "去解谜题 1", cls: "gold", onClick: () => { closeModal(); openPuzzle("p1"); } }, { text: "先收着", onClick: closeModal }]);
    unlock("first_step");
  } else if (item === "clock") {
    addClue("clock_stop");
    openModal("墙上时钟", "<p>指针停在 <b>23:24</b>，一动不动。表盘背面刻着：停表即真相的起点。</p><p>别忘了记录本那句话：这钟慢 7 分钟。真实的停表时间，要往后加。</p>",
      [{ text: "去解时钟机关", cls: "gold", onClick: () => { closeModal(); openPuzzle("p2"); } }, { text: "先收着", onClick: closeModal }]);
  } else if (item === "logbook") {
    addItem("logbook"); addClue("clock_slow"); addClue("log_2317");
    openModal("员工记录本", "<p>沈伯的字，写得很稳。</p><p>“这钟慢 7 分钟，别信它指的时间。”</p><p>最后一页：23:17，有人来登记，名字一栏是空的，只写着“找一件没有名字的东西”。</p><p>抽屉还锁着。也许解开时钟机关后，抽屉的事会有转机——先去看看三号柜和抽屉本身。</p>",
      [{ text: "去看抽屉", cls: "gold", onClick: () => { closeModal(); investigate("drawer"); } }, { text: "先收着", onClick: closeModal }]);
  } else if (item === "drawer") {
    if (!hasClue("log_2317")) {
      openModal("上锁的抽屉", "<p>抽屉锁着，钥匙孔旁边贴着一张小纸条：“先读记录本，再来开我。”</p><p>记录本在柜台左边，先去读它。</p>", [{ text: "去读记录本", cls: "gold", onClick: () => { closeModal(); investigate("logbook"); } }]);
    } else {
      addItem("scissors"); addItem("letter"); addClue("scissors");
      openModal("上锁的抽屉", "<p>你按记录本最后一页的折角提示拨了一下锁舌——其实它早就没锁死，只是没人敢碰。</p><p>里面有：<b>剪刀</b>、针线，和四张<b>残信碎片</b>。剪刀可以拆开缝死的内袋。</p>",
        [{ text: "去拼信（谜题 4）", cls: "gold", onClick: () => { closeModal(); openPuzzle("p4"); } }, { text: "先收着", onClick: closeModal }]);
    }
  } else if (item === "cabinet") {
    addItem("raincoat"); addClue("cabinet_3");
    openModal("三号柜", "<p>柜子里没有伞，只有一件旧雨衣，袖口磨得很厉害。</p><p>来访者说伞在三号柜，可柜子里是雨衣——他记错的到底是伞，还是别的？</p><p>雨衣已经放进背包。翻面、转一转，看看内袋。</p>",
      [{ text: "检查雨衣（谜题 3）", cls: "gold", onClick: () => { closeModal(); openPuzzle("p3"); } }, { text: "先收着", onClick: closeModal }]);
  } else if (item === "visitor") {
    addClue("visitor_claim"); addItem("umbrella");
    document.querySelector('[data-tab="npc"]').click();
    openModal("门口的来访者", "<p>他站在雨里，袖口还在滴水。登记表的名字一栏是空的。</p><p>他说：“我今晚 23:20 才第一次到这里，之前从没来过。”</p><p>这句话已经记进线索档案。对话面板已经打开，去和他聊聊——出示证据时要小心，逼得太紧会掉信任。</p>",
      [{ text: "去对话", cls: "gold", onClick: closeModal }]);
  } else if (item === "counter") {
    if (!isSolved("p4")) {
      openModal("柜台暗格", "<p>柜台下面有个暗格，指尖摸得到一条缝，但现在打不开。</p><p>提示：先把残信拼好（谜题 4），你会知道这个家还有什么没说完。</p>", [{ text: "知道了", onClick: closeModal }]);
    } else {
      addClue("ticket"); unlock("hidden_ticket");
      openModal("柜台暗格（隐藏物品）", "<p>暗格弹开了。里面是一张 <b>2016 年冬天的旧车票</b>，目的地是沈伯老家。</p><p>名字栏写着：“沈默”。这是全游戏唯一直接写着他全名的地方。</p><p>隐藏物品已收集。去线索档案看看，它和照片背面能不能连起来。</p>", [{ text: "收好", onClick: closeModal }]);
    }
  }
  saveSoon();
}
