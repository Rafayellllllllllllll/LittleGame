/* 推理板：点选两条线索建立关联，也支持拖拽；撤销只删关联，不删线索。 */
function renderBoard() {
  const chips = document.getElementById("boardChips");
  const linksBox = document.getElementById("boardLinks");
  document.getElementById("linkCount").textContent = S.links.length + " / 4";
  if (!S.clues.length) { chips.innerHTML = '<p class="empty">先去调查，拿到线索后它们会出现在这里。</p>'; }
  else {
    chips.innerHTML = S.clues.map(id => '<button class="chip' + (S.boardSel === id ? " selected" : "") + '" draggable="true" data-chip="' + id + '">' + CLUES[id].title + '</button>').join("");
    chips.querySelectorAll("[data-chip]").forEach(el => {
      el.onclick = () => pickChip(el.dataset.chip);
      el.ondragstart = e => { e.dataTransfer.setData("text/plain", el.dataset.chip); };
      el.ondragover = e => e.preventDefault();
      el.ondrop = e => { e.preventDefault(); linkClues(e.dataTransfer.getData("text/plain"), el.dataset.chip); };
    });
  }
  if (!S.links.length) { linksBox.innerHTML = '<p class="empty">还没有建立关联。先试试：录音带和来访者的说法，有没有对不上的地方？</p>'; }
  else {
    linksBox.innerHTML = S.links.map(k => '<div class="link-row">' + (LINK_NAMES[k] || k) + ' <button class="btn ghost" data-unlink="' + k + '" style="padding:4px 10px;min-height:0">撤销</button></div>').join("");
    linksBox.querySelectorAll("[data-unlink]").forEach(b => b.onclick = () => {
      S.links = S.links.filter(x => x !== b.dataset.unlink); renderBoard(); saveSoon(); toast("已撤销这条关联。");
    });
  }
}
function pickChip(id) {
  AudioFX.click();
  if (!S.boardSel) { S.boardSel = id; }
  else if (S.boardSel === id) { S.boardSel = null; }
  else { const a = S.boardSel; S.boardSel = null; linkClues(a, id); return; }
  renderBoard(); saveSoon();
}
function linkClues(a, b) {
  if (!a || !b || a === b) { toast("选两条不同的线索才能建立关联。"); return; }
  const k = linkKey(a, b);
  if (S.links.includes(k)) { toast("这条关联已经建立过了。"); renderBoard(); return; }
  if (VALID_LINKS.some(pair => linkKey(pair[0], pair[1]) === k)) {
    S.links.push(k); AudioFX.success(); vibrate(25);
    toast("关联成立：" + LINK_NAMES[k]);
    if (S.links.length >= 4) toast("4 组关联都连对了。最终推理会多一条提醒。");
  } else {
    AudioFX.fail();
    toast("这两条线索暂时连不起来。看看它们的来源和时间，是不是同一件事？");
  }
  renderBoard(); saveSoon();
}
