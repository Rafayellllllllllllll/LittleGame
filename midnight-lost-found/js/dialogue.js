/* NPC 对话：选项改变信任、出示证据改变状态，分支结果进 flags。 */
function renderDialogue() {
  const node = DIALOGUE[S.dialogueNode] || DIALOGUE.intro;
  document.getElementById("dlgSpeaker").textContent = node.speaker;
  document.getElementById("dlgText").textContent = node.text;
  const box = document.getElementById("dlgOptions");
  box.innerHTML = "";
  if (S.ending) { box.innerHTML = '<p class="muted">这一夜已经结束了。去首页可以再玩一次。</p>'; return; }
  let options = node.options;
  if (options === "present") {
    options = S.clues.map(id => ({ text: "出示：" + CLUES[id].title, clue: id }));
    options.push({ text: "先不出了，回去想想", next: "intro" });
  }
  options.forEach(opt => {
    if (opt.requiresClue && !hasClue(opt.requiresClue)) return;
    const b = document.createElement("button");
    b.textContent = opt.text;
    b.onclick = () => {
      AudioFX.click(); vibrate(15);
      if (opt.clue) { presentEvidence(opt.clue); return; }
      if (opt.trust) setTrust(opt.trust, opt.text.slice(0, 12));
      if (opt.flag) S.flags[opt.flag] = true;
      S.dialogueNode = opt.next || "intro";
      if (S.dialogueNode === "present" && !S.clues.length) S.dialogueNode = "intro";
      renderDialogue(); saveSoon();
    };
    box.appendChild(b);
  });
  /* 最终选择：只有解开谜题 8 后才出现 */
  if (isSolved("p8") && S.dialogueNode === "done") {
    const finalBox = document.createElement("div");
    finalBox.style.marginTop = "12px";
    finalBox.innerHTML = "<p><b>最后的选择：钥匙已经在你手里了。</b></p>";
    const mk = (text, fn) => { const b = document.createElement("button"); b.textContent = text; b.onclick = fn; finalBox.appendChild(b); };
    const canTruth = S.flags.letterShown && S.trust >= 50;
    mk(canTruth ? "说出他的名字，把钥匙递到他手里" : "说出他的名字，把钥匙递给他（需要：先出示过那封信，且信任 ≥ 50）", () => {
      if (!canTruth) { toast("他还没准备好听自己的名字。先在对话里出示那封信，让信任到 50 再来。当前信任 " + S.trust + "。"); return; }
      showEnding("truth");
    });
    mk("不说破，把钥匙轻轻放在柜台上", () => showEnding("gentle"));
    mk("先问他：你还记得妈妈缝雨衣的那个晚上吗？", () => showEnding("open"));
    box.appendChild(finalBox);
  }
}
function presentEvidence(clueId) {
  const good = { tape_2303: 10, photo_family: 10, letter_key: 15, photo_back: 10, ticket: 15 };
  const bad = ["umbrella"];
  if (good[clueId] !== undefined) {
    setTrust(good[clueId], "出示了 " + CLUES[clueId].title);
    if (clueId === "letter_key") S.flags.letterShown = true;
    document.getElementById("dlgText").textContent = "他看着这条证据，沉默了一会儿，然后轻轻点了点头：“……原来你们这里，都还留着。”";
    S.dialogueNode = "ask_past";
  } else {
    setTrust(-5, "证据不太对");
    document.getElementById("dlgText").textContent = "他皱了皱眉：“这和我丢的东西……好像不是一回事。”";
    S.dialogueNode = "intro";
  }
  renderDialogue(); saveSoon();
}
const ENDINGS = {
  truth: { kicker: "第一章 · 真结局", title: "记起名字的雨夜", text: "你说：“沈默，这是你妈妈留给你的钥匙。”他接过钥匙，手抖了一下，然后在登记表上，一笔一画写下：沈默。雨还在下，但招领处里，有一件东西终于回到了它主人的名字里。" },
  gentle: { kicker: "第一章 · 结局", title: "没有说破的体贴", text: "你没有说破，只是把钥匙放在柜台上，推到他面前。他看了很久，拿起来，放进口袋，轻声说：“谢谢。”他没有写名字，但走出门的时候，脚步比来时稳了很多。有些名字，不必当场认，让他自己带回去慢慢认，也很好。" },
  open: { kicker: "第一章 · 悬念结局", title: "雨还没有停", text: "你问起那个缝雨衣的晚上，他愣住了，接过钥匙，却没有接你的话。他走进雨里，登记表上还是空白。也许下一夜，他还会回来；也许他需要先一个人，把这个晚上想明白。招领处的工作，就是等——等失物，也等愿意认领它的人。" }
};
function renderEnding(kind) {
  const e = ENDINGS[kind]; if (!e) return;
  document.getElementById("endingKicker").textContent = e.kicker;
  document.getElementById("endingTitle").textContent = e.title;
  document.getElementById("endingText").textContent = e.text;
  document.getElementById("endingStats").textContent = "线索 " + S.clues.length + "/14 · 谜题 " + S.solved.length + "/8 · 信任 " + S.trust + " · 关联 " + S.links.length + "/4 · 提示看过 " + Object.keys(S.hintsSeen).length + " 道题";
}
function showEnding(kind) {
  const noHint = Object.keys(S.hintsSeen).length === 0;
  if (noHint) unlock("no_hint");
  S.ending = kind;
  renderEnding(kind);
  saveNow(); showView("view-ending");
  AudioFX.success();
}
