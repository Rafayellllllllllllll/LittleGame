/* 深海观测站 · 渲染与交互层
 * 只做"呈现"：所有模拟逻辑来自 core.js（那部分有测试覆盖）。
 */
import {
  mulberry32, flowAt,
  createPlankton, stepPlankton,
  createJellies, stepJellies, jellyPulseScale,
  createSnow, stepSnow,
  makeCurrent, decayCurrent, stats,
} from './core.js'

const canvas = document.getElementById('sea')
const ctx = canvas.getContext('2d', { alpha: false })
const el = {
  depth: document.getElementById('depth'),
  bio: document.getElementById('bio'),
  fps: document.getElementById('fps'),
  hud: document.getElementById('hud'),
  hint: document.getElementById('hint'),
  paused: document.getElementById('paused'),
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const params = new URLSearchParams(location.search)

let W = 0
let H = 0
let dpr = 1
let bg = null
let grainPattern = null

const rng = mulberry32(Number(params.get('seed')) || 20261027)

const state = {
  t: 0,
  paused: false,
  debug: params.get('debug') === '1',
  depth: 380,       // 米
  descend: 0.55,    // 米/秒的缓慢下潜
  current: null,
  bursts: [],
  audio: null,
  audioOn: false,
  fps: 0,
  frames: 0,
  fpsAt: 0,
}

let plankton = []
let jellies = []
let snow = []

/* ── 尺寸与背景缓存 ─────────────────────────────────── */
function buildScene() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = window.innerWidth
  H = window.innerHeight
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 背景：由浅到深的垂直渐变（越深越黑）
  bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#062a44')
  bg.addColorStop(0.35, '#03192c')
  bg.addColorStop(0.72, '#010b18')
  bg.addColorStop(1, '#00060e')

  const area = W * H
  const scale = Math.min(1.6, Math.max(0.55, area / (1280 * 800)))
  const nPlankton = Math.round((params.get('plankton') ? Number(params.get('plankton')) : 420) * scale)
  const nSnow = Math.round(260 * scale)
  const nJelly = Math.max(3, Math.round(9 * Math.min(1.3, scale)))

  plankton = createPlankton(nPlankton, W, H, rng)
  jellies = createJellies(nJelly, W, H, rng)
  snow = createSnow(nSnow, W, H, rng)
}

/** 胶片颗粒：一次性生成小贴图，之后当 pattern 用 */
function buildGrain() {
  const size = 96
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const img = g.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 26
  }
  g.putImageData(img, 0, 0)
  grainPattern = ctx.createPattern(c, 'repeat')
}

/* ── 绘制：远景山脊 + 光柱 ──────────────────────────── */
function drawBackdrop(t) {
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 远山剪影（几层半透明）
  ctx.save()
  for (let layer = 0; layer < 3; layer++) {
    const baseY = H * (0.62 + layer * 0.11)
    const amp = 26 + layer * 22
    ctx.beginPath()
    ctx.moveTo(0, H)
    ctx.lineTo(0, baseY)
    for (let x = 0; x <= W; x += 47) {
      const y = baseY + Math.sin(x * 0.0032 + layer * 2.1) * amp + Math.sin(x * 0.011 + layer) * amp * 0.32
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fillStyle = `rgba(2, 18, 32, ${0.5 - layer * 0.11})`
    ctx.fill()
  }
  ctx.restore()

  // 从上方斜射的光柱
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 4; i++) {
    const drift = Math.sin(t * 0.11 + i * 1.7) * W * 0.06
    const x = (i + 0.5) / 4 * W + drift
    const width = W * (0.05 + i * 0.012)
    const g = ctx.createLinearGradient(x, 0, x + width * 1.6, H * 0.92)
    g.addColorStop(0, 'rgba(140, 220, 255, 0.085)')
    g.addColorStop(0.55, 'rgba(120, 200, 255, 0.03)')
    g.addColorStop(1, 'rgba(120, 200, 255, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - width * 0.35, -10)
    ctx.lineTo(x + width * 0.35, -10)
    ctx.lineTo(x + width * 1.9, H)
    ctx.lineTo(x + width * 0.5, H)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/* ── 绘制：海雪 ─────────────────────────────────────── */
function drawSnow() {
  ctx.save()
  for (const s of snow) {
    const a = 0.05 + s.z * 0.16
    ctx.globalAlpha = a
    ctx.fillStyle = '#cfeeff'
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size * (0.6 + s.z * 0.8), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/* ── 绘制：浮游生物（加色发光）───────────────────────── */
function drawPlankton(t) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const p of plankton) {
    const tw = 0.55 + 0.45 * Math.sin(p.phase * 1.7 + t)
    const r = p.size * (0.7 + p.z * 1.5)
    const alpha = (0.16 + p.z * 0.5) * tw

    // 外层辉光
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5.5)
    const hue = p.hue * 360
    g.addColorStop(0, `hsla(${hue}, 92%, 78%, ${alpha})`)
    g.addColorStop(0.35, `hsla(${hue}, 92%, 62%, ${alpha * 0.4})`)
    g.addColorStop(1, 'hsla(200, 92%, 60%, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 5.5, 0, Math.PI * 2)
    ctx.fill()

    // 亮核
    ctx.globalAlpha = Math.min(1, alpha * 1.8)
    ctx.fillStyle = `hsla(${hue + 12}, 100%, 88%, 0.9)`
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 0.75, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

/* ── 绘制：水母 ─────────────────────────────────────── */
function drawJelly(j, t) {
  const pulse = jellyPulseScale(j, t)
  const rx = j.r * pulse
  const ry = j.r * (2 - pulse) * 0.78
  const hue = j.hue * 360
  const depthFade = 0.35 + j.z * 0.65

  ctx.save()
  ctx.translate(j.x, j.y)

  // 触手（先画，压在伞体下面）
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const tent of j.tentacles) {
    const sway = Math.sin(t * 1.4 + tent.phase) * j.r * 0.35
    const sway2 = Math.sin(t * 1.1 + tent.phase + 1.3) * j.r * 0.5
    ctx.beginPath()
    ctx.moveTo(tent.offset * rx * 0.9, ry * 0.7)
    ctx.quadraticCurveTo(
      tent.offset * rx * 1.1 + sway * 0.4,
      ry * 0.7 + tent.len * 0.5,
      tent.offset * rx * 1.3 + sway2,
      ry * 0.7 + tent.len,
    )
    ctx.strokeStyle = `hsla(${hue}, 90%, 72%, ${0.16 * depthFade})`
    ctx.lineWidth = Math.max(0.8, j.r * 0.055)
    ctx.stroke()
  }
  ctx.restore()

  // 伞体
  const bodyGrad = ctx.createRadialGradient(0, -ry * 0.35, rx * 0.15, 0, 0, ry * 1.15)
  bodyGrad.addColorStop(0, `hsla(${hue}, 100%, 88%, ${0.5 * depthFade})`)
  bodyGrad.addColorStop(0.45, `hsla(${hue}, 95%, 70%, ${0.22 * depthFade})`)
  bodyGrad.addColorStop(1, `hsla(${hue}, 95%, 60%, 0.02)`)
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 0)
  ctx.quadraticCurveTo(rx * 0.7, ry * 0.55, 0, ry * 0.42)
  ctx.quadraticCurveTo(-rx * 0.7, ry * 0.55, -rx, 0)
  ctx.closePath()
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // 伞缘高光
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 0)
  ctx.strokeStyle = `hsla(${hue}, 100%, 86%, ${0.4 * depthFade})`
  ctx.lineWidth = Math.max(1, j.r * 0.05)
  ctx.stroke()

  // 内部亮点（生殖腺）
  for (let i = -1; i <= 1; i++) {
    const gx = i * rx * 0.28
    const g = ctx.createRadialGradient(gx, -ry * 0.1, 0, gx, -ry * 0.1, j.r * 0.3)
    g.addColorStop(0, `hsla(${hue + 18}, 100%, 92%, ${0.55 * depthFade})`)
    g.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(gx, -ry * 0.1, j.r * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/* ── 绘制：点击爆发的荧光 ───────────────────────────── */
function drawBursts(dt) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = state.bursts.length - 1; i >= 0; i--) {
    const b = state.bursts[i]
    b.life -= dt
    if (b.life <= 0) { state.bursts.splice(i, 1); continue }
    const k = b.life / b.max
    for (const sp of b.sparks) {
      sp.x += sp.vx * dt
      sp.y += sp.vy * dt
      sp.vy += 14 * dt
      sp.vx *= 1 - dt * 1.8
      const r = sp.r * (0.4 + k)
      const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r * 6)
      g.addColorStop(0, `hsla(${sp.hue}, 100%, 85%, ${0.5 * k})`)
      g.addColorStop(1, `hsla(${sp.hue}, 100%, 70%, 0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, r * 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/* ── 绘制：暗角 + 颗粒 ──────────────────────────────── */
function drawGrainAndVignette() {
  if (grainPattern) {
    ctx.save()
    ctx.globalAlpha = 0.32
    ctx.translate(-Math.random() * 96, -Math.random() * 96)
    ctx.fillStyle = grainPattern
    ctx.fillRect(0, 0, W + 96, H + 96)
    ctx.restore()
  }

  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.78)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.62)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
}

/* ── 音频：极简生成式低鸣（默认关，M 切换）────────── */
function toggleAudio() {
  if (!state.audio) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ac = new AC()
    const master = ac.createGain()
    master.gain.value = 0
    master.connect(ac.destination)

    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 260
    filter.Q.value = 3.2
    filter.connect(master)

    const oscs = [55, 82.5, 110.3].map((f, i) => {
      const o = ac.createOscillator()
      o.type = i === 2 ? 'triangle' : 'sine'
      o.frequency.value = f
      const g = ac.createGain()
      g.gain.value = i === 0 ? 0.5 : 0.18
      o.connect(g).connect(filter)
      o.start()
      return o
    })

    const lfo = ac.createOscillator()
    const lfoGain = ac.createGain()
    lfo.frequency.value = 0.07
    lfoGain.gain.value = 120
    lfo.connect(lfoGain).connect(filter.frequency)
    lfo.start()

    state.audio = { ac, master, oscs, filter }
  }

  const { ac, master } = state.audio
  if (ac.state === 'suspended') ac.resume()
  state.audioOn = !state.audioOn
  master.gain.cancelScheduledValues(ac.currentTime)
  master.gain.linearRampToValueAtTime(state.audioOn ? 0.055 : 0, ac.currentTime + 0.9)
  el.hint.style.opacity = '0'
}

/* ── 交互 ────────────────────────────────────────────── */
function pointerPos(e) {
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerPos(e)
  state.current = makeCurrent(p.x, p.y, 420000)
  const sparks = Array.from({ length: 14 }, () => {
    const a = Math.random() * Math.PI * 2
    const s = 60 + Math.random() * 190
    return {
      x: p.x, y: p.y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 30,
      r: 0.8 + Math.random() * 2.1,
      hue: 168 + Math.random() * 60,
    }
  })
  state.bursts.push({ sparks, life: 1.6, max: 1.6 })
  if (state.bursts.length > 6) state.bursts.shift()
  el.hint.style.opacity = '0'
  if (!state.audioOn && state.audio) toggleAudio()
}, { passive: true })

canvas.addEventListener('pointermove', (e) => {
  if (e.buttons === 0) return
  const p = pointerPos(e)
  state.current = makeCurrent(p.x, p.y, 300000)
}, { passive: true })

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === ' ') {
    state.paused = !state.paused
    el.paused.classList.toggle('show', state.paused)
    e.preventDefault()
  } else if (k === 'm') {
    toggleAudio()
  } else if (k === 'g') {
    state.debug = !state.debug
    el.fps.style.display = state.debug ? 'inline' : 'none'
  } else if (k === 'h') {
    el.hud.classList.toggle('dim')
  }
})

/* ── HUD ─────────────────────────────────────────────── */
let hudAt = 0
function updateHud(now) {
  if (now - hudAt < 120) return
  hudAt = now
  el.depth.textContent = Math.round(state.depth).toLocaleString('en-US')
  const s = stats({ plankton, jellies, snow })
  el.bio.textContent = s.biolume.toFixed(1)
  if (state.debug) el.fps.textContent = state.fps + ' fps'
}

/* ── 主循环 ──────────────────────────────────────────── */
let last = performance.now()

function frame(now) {
  const dtRaw = (now - last) / 1000
  last = now
  const dt = Math.min(Math.max(dtRaw, 0), 0.05)
  const motion = reduced ? 0.45 : 1

  if (!state.paused) {
    state.t += dt
    state.depth += state.descend * dt * motion

    const current = state.current
    stepPlankton(plankton, dt * motion, state.t, W, H, current)
    stepJellies(jellies, dt * motion, state.t, W, H, current)
    stepSnow(snow, dt * motion, state.t, W, H)
    if (current) {
      decayCurrent(current, dt)
      if (current.life <= 0) state.current = null
    }
  }

  drawBackdrop(state.t)
  drawSnow()
  drawPlankton(state.t)
  for (const j of jellies) drawJelly(j, state.t)
  drawBursts(dt)
  drawGrainAndVignette()

  state.frames++
  if (now - state.fpsAt > 500) {
    state.fps = Math.round((state.frames * 1000) / (now - state.fpsAt))
    state.frames = 0
    state.fpsAt = now
  }
  updateHud(now)

  requestAnimationFrame(frame)
}

/* ── 启动 ────────────────────────────────────────────── */
buildScene()
buildGrain()
el.fps.style.display = state.debug ? 'inline' : 'none'
window.addEventListener('resize', () => { buildScene(); buildGrain() }, { passive: true })
window.addEventListener('orientationchange', () => setTimeout(() => { buildScene(); buildGrain() }, 150), { passive: true })
requestAnimationFrame(frame)

// 供自动化/调试读取
window.__abyss = { state, get counts() { return stats({ plankton, jellies, snow }) } }
