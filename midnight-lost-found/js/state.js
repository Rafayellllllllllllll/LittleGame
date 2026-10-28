/* 游戏状态模型：线索 / 物品 / 谜题 / 信任 / 选择 / 成就 / 结局。
   所有可序列化字段都在这里，存档就是这一个对象的快照。 */
const SAVE_KEY = "midnight-lost-found-save-v1";
const DEVICE_KEY = "midnight-lost-found-device";

function defaultState() {
  return {
    version: 1, startedAt: Date.now(), updatedAt: Date.now(),
    clues: [], items: [], solved: [], hintsSeen: {},
    links: [], trust: 40, flags: {},
    achievements: [], ending: null, dialogueNode: "intro",
    selectedItems: [], boardSel: null,
    settings: { sound: true, vibrate: true, large: false, motion: true }
  };
}
let S = defaultState();
let saveTimer = null;

function hasClue(id) { return S.clues.includes(id); }
function addClue(id) {
  if (!hasClue(id)) { S.clues.push(id); toast("新线索：" + (CLUES[id] ? CLUES[id].title : id)); }
  renderAll(); saveSoon();
}
function hasItem(id) { return S.items.includes(id); }
function addItem(id) {
  if (!hasItem(id)) { S.items.push(id); toast("获得道具：" + (ITEMS[id] ? ITEMS[id].name : id)); }
  renderAll(); saveSoon();
}
function isSolved(id) { return S.solved.includes(id); }
function solvePuzzle(id, achievement) {
  if (isSolved(id)) return;
  S.solved.push(id);
  if (achievement) unlock(achievement);
  AudioFX.success(); vibrate(30);
  renderAll(); saveSoon();
}
function unlock(id) {
  if (!S.achievements.includes(id)) {
    S.achievements.push(id);
    toast("成就解锁：" + (ACHIEVEMENTS[id] || id));
  }
}
function setTrust(delta, why) {
  const before = S.trust;
  S.trust = Math.max(0, Math.min(100, S.trust + delta));
  if (S.trust !== before) toast((delta > 0 ? "信任 +" : "信任 ") + delta + (why ? " · " + why : ""));
  renderAll(); saveSoon();
}
function saveNow() {
  try {
    S.updatedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    if (window.CloudSync) CloudSync.queue();
    return true;
  } catch (e) {
    toast("本地存档失败：浏览器存储空间不足或被禁用。可以用设置里的“导出存档备份”先保住进度。");
    return false;
  }
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.clues)) return null;
    return Object.assign(defaultState(), data);
  } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  S = defaultState();
}
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch (e) { return "dev-anon"; }
}
function exportSave() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "午夜失物招领处-存档.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
