/* Supabase 同步（可选）：只用 anon 公开密钥，失败时静默降级到本地存档。
   表结构见 supabase/schema.sql；未配置 URL / anon key 时不发任何请求。 */
const CloudSync = (() => {
  let timer = null, lastStatus = "未配置";
  function configured() {
    const c = window.GAME_CONFIG || {};
    return Boolean(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }
  function setStatus(msg) {
    lastStatus = msg;
    const el = document.getElementById("cloudStatus"); if (el) el.textContent = "云端同步：" + msg;
    const home = document.getElementById("cloudLine"); if (home) home.textContent = "云端：" + msg;
  }
  async function push() {
    if (!configured()) { setStatus("未配置，本地存档正常工作。"); return; }
    const c = window.GAME_CONFIG;
    try {
      const res = await fetch(c.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/game_saves", {
        method: "POST",
        headers: {
          "apikey": c.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + c.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({ device_id: deviceId(), save_data: S, updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setStatus("已同步到云端（" + new Date().toLocaleTimeString() + "）。");
    } catch (e) {
      setStatus("云端不可用，已用本地存档继续（不影响游玩）。");
    }
  }
  return {
    queue() { clearTimeout(timer); timer = setTimeout(push, 1500); },
    status() { return lastStatus; },
    configured
  };
})();
window.CloudSync = CloudSync;
