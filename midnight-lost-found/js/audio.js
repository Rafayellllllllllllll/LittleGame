/* 轻量音效：全部用 WebAudio 合成，不依赖外部音频文件。 */
const AudioFX = (() => {
  let ctx = null, rainNodes = null;
  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, t, dur, type) {
    const c = ensure(); if (!c || !S.settings.sound) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + dur);
    o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + dur + 0.05);
  }
  return {
    click() { tone(660, 0, 0.08, "triangle"); },
    success() { tone(523, 0, 0.15); tone(659, 0.1, 0.15); tone(784, 0.2, 0.25); },
    fail() { tone(180, 0, 0.2, "sawtooth"); tone(140, 0.15, 0.25, "sawtooth"); },
    startRain() {
      const c = ensure(); if (!c || !S.settings.sound || rainNodes) return;
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
      const g = c.createGain(); g.gain.value = 0.035;
      src.connect(f); f.connect(g); g.connect(c.destination); src.start();
      rainNodes = { src, g };
    },
    stopRain() { try { rainNodes && rainNodes.src.stop(); } catch (e) {} rainNodes = null; }
  };
})();
function vibrate(ms) {
  try { if (S.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}
