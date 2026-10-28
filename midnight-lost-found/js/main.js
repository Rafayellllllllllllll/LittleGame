/* 启动与接线：加载、首页、场景雨滴、标签页、设置、存档操作。 */
function startRainCanvas() {
  const cv = document.getElementById("rainCanvas");
  const ctx = cv.getContext("2d");
  let drops = [];
  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    cv.width = r.width; cv.height = r.height;
    drops = Array.from({ length: 70 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, l: 8 + Math.random() * 14, s: 4 + Math.random() * 6 }));
  }
  resize(); window.addEventListener("resize", resize);
  (function loop() {
    if (S.settings.motion) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "rgba(160,200,220,.5)"; ctx.lineWidth = 1;
      drops.forEach(d => {
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + d.l); ctx.stroke();
        d.y += d.s; d.x -= 1;
        if (d.y > cv.height) { d.y = -20; d.x = Math.random() * cv.width; }
      });
    }
    requestAnimationFrame(loop);
  })();
}
function initTabs() {
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + t.dataset.tab));
    AudioFX.click();
  });
}
function initScene() {
  document.querySelectorAll(".hotspot, .scene-list button").forEach(b => b.onclick = () => investigate(b.dataset.item));
}
function startNewGame() {
  AudioFX.click(); AudioFX.startRain();
  clearSave(); S.startedAt = Date.now(); saveNow(); renderAll(); showView("view-game");
}
function initSettings() {
  const bind = (id, key, fn) => {
    document.getElementById(id).onchange = e => {
      S.settings[key] = e.target.checked; renderSettings(); saveSoon();
      if (fn) fn();
    };
  };
  bind("setSound", "sound", () => { if (S.settings.sound) AudioFX.startRain(); else AudioFX.stopRain(); });
  bind("setVibrate", "vibrate");
  bind("setLarge", "large");
  bind("setMotion", "motion");
  document.getElementById("btnExport").onclick = () => { exportSave(); toast("存档已导出，文件会下载到你的设备上。"); };
  document.getElementById("btnImport").onclick = () => document.getElementById("importFile").click();
  document.getElementById("importFile").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || data.version !== 1) throw new Error("bad");
        S = Object.assign(defaultState(), data); saveNow(); renderAll();
        toast("存档导入成功。"); showView("view-game");
      } catch (err) { toast("这个文件不是本游戏的存档，导入失败，现有进度没有动。"); }
    };
    r.readAsText(f);
  };
  document.getElementById("btnClearSave").onclick = () => {
    showConfirm("清除存档？", "本地存档和成就都会清掉。想保住进度的话，先点“导出存档备份”，再回来清除。", "确认清除", () => { clearSave(); saveNow(); location.reload(); });
  };
  document.getElementById("btnHome").onclick = () => showView("view-home");
}
function initHome() {
  document.getElementById("btnContinue").onclick = () => {
    AudioFX.click(); AudioFX.startRain();
    const saved = loadSave();
    if (saved) { S = saved; renderAll(); }
    if (S.ending) { renderEnding(S.ending); showView("view-ending"); }
    else showView("view-game");
    toast(saved ? "欢迎回来，进度已恢复。" : "新的一夜开始了。先调查旧录音机。");
  };
  document.getElementById("btnNew").onclick = () => {
    if (S.clues.length || S.solved.length) {
      showConfirm("开始新的一夜？", "这会覆盖当前进度。想先保住进度的话，先去设置里导出存档备份，再回来重开。", "确认重开", startNewGame);
    } else {
      startNewGame();
    }
  };
  document.getElementById("btnHow").onclick = () => { document.getElementById("howCard").hidden = false; };
  document.getElementById("btnCloseHow").onclick = () => { document.getElementById("howCard").hidden = true; };
  document.getElementById("btnReplay").onclick = () => {
    const ach = S.achievements.slice();
    clearSave(); S.achievements = ach; saveNow(); renderAll(); showView("view-game");
  };
  document.getElementById("btnEndingHome").onclick = () => showView("view-home");
}
function initCombine() {
  document.getElementById("btnCombine").onclick = () => {
    const fb = document.getElementById("combineFeedback");
    if (S.selectedItems.length !== 2) { fb.textContent = "先在背包里选两件道具。"; fb.className = "feedback bad"; return; }
    const [a, b] = S.selectedItems;
    const ok = (a === "raincoat" && b === "scissors") || (a === "scissors" && b === "raincoat");
    if (ok) {
      if (isSolved("p7")) { fb.textContent = "钥匙已经取出来了。"; fb.className = "feedback ok"; return; }
      addItem("brassKey"); addClue("raincoat_stitch");
      solvePuzzle("p7", "handy"); S.selectedItems = [];
      fb.textContent = "针脚拆开了，黄铜钥匙掉在掌心。谜题 7 已解开。"; fb.className = "feedback ok";
    } else {
      AudioFX.fail(); fb.textContent = "这两件合不到一起。想想：钥匙缝在雨衣内袋里，需要拆线。"; fb.className = "feedback bad";
    }
    renderBag(); saveSoon();
  };
  document.getElementById("btnClearCombine").onclick = () => { S.selectedItems = []; renderBag(); };
  document.getElementById("btnClearBoardSel").onclick = () => { S.boardSel = null; renderBoard(); };
}
window.addEventListener("DOMContentLoaded", () => {
  const steps = ["正在整理招领处的货架", "正在把录音带倒回开头", "正在给墙上的钟上弦", "灯亮了，进来吧"];
  let i = 0;
  const loadTimer = setInterval(() => {
    document.getElementById("loadText").textContent = steps[Math.min(i, steps.length - 1)];
    i++;
    if (i > steps.length) {
      clearInterval(loadTimer);
      document.getElementById("loading").style.display = "none";
      const saved = loadSave();
      if (saved) S = saved;
      renderAll(); showView("view-home");
      if (window.CloudSync) CloudSync.queue();
    }
  }, 350);
  document.getElementById("btnCloseModal").onclick = closeModal;
  document.getElementById("modalBackdrop").addEventListener("click", e => { if (e.target.id === "modalBackdrop") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  initTabs(); initScene(); initSettings(); initHome(); initCombine(); startRainCanvas();
});
