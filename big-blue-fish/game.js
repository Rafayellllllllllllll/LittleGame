/* 蓝色大肥鱼 · 吃小鱼长大
 * 纯前端 Canvas 2D，零依赖。
 * 玩法：鼠标/手指移动（或 WASD / 方向键）控制大鱼；吃到比自己小的鱼就变大，
 * 撞到比自己大的鱼掉一条命并缩小。三条命用完结束。
 */
(() => {
  'use strict'

  const canvas = document.getElementById('game')
  const ctx = canvas.getContext('2d')
  const el = {
    score: document.getElementById('score'),
    len: document.getElementById('len'),
    lives: document.getElementById('lives'),
    start: document.getElementById('start'),
    over: document.getElementById('over'),
    play: document.getElementById('play'),
    again: document.getElementById('again'),
    finalScore: document.getElementById('finalScore'),
    finalLen: document.getElementById('finalLen'),
    best: document.getElementById('best'),
  }

  const TAU = Math.PI * 2
  const rand = (a, b) => a + Math.random() * (b - a)
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
  const params = new URLSearchParams(location.search)

  let W = 0
  let H = 0
  let dpr = 1
  let water = null

  const state = {
    mode: 'idle', // idle | play | over
    score: 0,
    lives: 3,
    elapsed: 0,
    spawnTimer: 0,
    shake: 0,
    best: Number(localStorage.getItem('bbf-best') || 0) || 0,
  }

  const player = { x: 0, y: 0, r: 14, invuln: 0, dir: 1, bob: 0 }
  const pointer = { x: 0, y: 0, active: false }
  const keys = new Set()

  let fishes = []
  let bubbles = []
  let bits = []

  const PREY_COLORS = [
    ['#ffd166', '#f4a259'],
    ['#ff8fab', '#e05c8a'],
    ['#8ee3c8', '#3fb8a0'],
    ['#c0a3ff', '#8a6fd6'],
    ['#ffb26b', '#e07a3f'],
  ]

  /* ── 尺寸 ─────────────────────────────────────────── */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    water = ctx.createLinearGradient(0, 0, 0, H)
    water.addColorStop(0, '#06386b')
    water.addColorStop(0.45, '#04203f')
    water.addColorStop(1, '#010c18')

    if (state.mode === 'idle') {
      player.x = W * 0.5
      player.y = H * 0.55
      pointer.x = player.x
      pointer.y = player.y
    }
    player.x = clamp(player.x, player.r, W - player.r)
    player.y = clamp(player.y, player.r, H - player.r)
  }
  window.addEventListener('resize', resize, { passive: true })
  window.addEventListener('orientationchange', () => setTimeout(resize, 120), { passive: true })

  /* ── 生成 ─────────────────────────────────────────── */
  function spawnFish(onscreen = false) {
    // 相对玩家当前体型决定大小：大部分更小（能吃），少量更大（危险）
    const roll = Math.random()
    let factor
    if (roll < 0.62) factor = rand(0.28, 0.9)
    else if (roll < 0.86) factor = rand(0.9, 1.15)
    else factor = rand(1.18, 1.9)

    const r = clamp(player.r * factor, 5, 95)
    const fromLeft = Math.random() < 0.5
    const speed = rand(75, 165) * (1 + player.r / 200)
    const palette = PREY_COLORS[(Math.random() * PREY_COLORS.length) | 0]
    const dangerous = r > player.r * 0.95
    const vx = (onscreen ? (Math.random() < 0.5 ? 1 : -1) : fromLeft ? 1 : -1) * speed

    fishes.push({
      // 开局直接铺在画面里，之后从两侧游进来
      x: onscreen ? rand(r + 16, W - r - 16) : fromLeft ? -r - 20 : W + r + 20,
      y: rand(r + 26, H - r - 26),
      r,
      vx,
      vy: rand(-14, 14),
      wob: rand(0, TAU),
      dir: vx >= 0 ? 1 : -1,
      dangerous,
      top: dangerous ? ['#8a5bd6', '#5b3a96'] : palette,
      belly: dangerous ? '#c9a7ff' : palette[0],
    })
  }

  function spawnBubble() {
    bubbles.push({ x: rand(0, W), y: H + rand(0, 60), r: rand(1.5, 5), spd: rand(18, 55), wob: rand(0, TAU) })
  }

  function burst(x, y, r, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU)
      const s = rand(40, 190)
      bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.8), max: 0.8, r: rand(1, Math.max(2, r * 0.16)), color })
    }
  }

  /* ── 状态 ─────────────────────────────────────────── */
  function reset() {
    state.score = 0
    state.lives = 3
    state.elapsed = 0
    state.spawnTimer = 0
    state.shake = 0
    player.r = 14
    player.invuln = 1
    player.x = W * 0.5
    player.y = H * 0.55
    pointer.x = player.x
    pointer.y = player.y
    pointer.active = false
    fishes = []
    bits = []
    bubbles = []
    for (let i = 0; i < 26; i++) spawnBubble()
    for (let i = 0; i < 10; i++) spawnFish(true)
    syncHud()
  }

  function startGame() {
    resize()
    reset()
    state.mode = 'play'
    el.start.classList.add('hidden')
    el.over.classList.add('hidden')
    if (params.get('grow') === '1') {
      player.r = 38
      syncHud()
    }
  }

  function gameOver() {
    state.mode = 'over'
    if (state.score > state.best) {
      state.best = state.score
      localStorage.setItem('bbf-best', String(state.best))
    }
    el.finalScore.textContent = String(state.score)
    el.finalLen.textContent = String(bodyLength())
    el.best.textContent = '最高分 ' + state.best
    el.over.classList.remove('hidden')
  }

  const bodyLength = () => Math.round(player.r * 1.7)

  function syncHud() {
    el.score.textContent = String(state.score)
    el.len.textContent = String(bodyLength())
    if (el.lives.childElementCount !== 3) {
      el.lives.innerHTML = '<i></i><i></i><i></i>'
    }
    Array.from(el.lives.children).forEach((node, i) => {
      node.classList.toggle('dead', i >= state.lives)
    })
  }

  /* ── 输入 ─────────────────────────────────────────── */
  function setPointer(e) {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.active = true
  }
  window.addEventListener('pointermove', setPointer, { passive: true })
  window.addEventListener('pointerdown', (e) => {
    setPointer(e)
    if (state.mode === 'play' && e.pointerType !== 'mouse') e.preventDefault()
  }, { passive: false })
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      keys.add(k)
      pointer.active = false
      e.preventDefault()
    }
  })
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

  el.play.addEventListener('click', startGame)
  el.again.addEventListener('click', startGame)

  /* ── 更新 ─────────────────────────────────────────── */
  function update(dt) {
    state.elapsed += dt
    state.shake = Math.max(0, state.shake - dt * 26)

    // 大鱼越大越笨重
    const agility = 9.5 * (26 / (player.r + 16))
    let kx = 0
    let ky = 0
    if (keys.has('a') || keys.has('arrowleft')) kx -= 1
    if (keys.has('d') || keys.has('arrowright')) kx += 1
    if (keys.has('w') || keys.has('arrowup')) ky -= 1
    if (keys.has('s') || keys.has('arrowdown')) ky += 1

    if (kx || ky) {
      const len = Math.hypot(kx, ky) || 1
      const speed = 470 * (26 / (player.r + 16)) + 60
      player.x += (kx / len) * speed * dt
      player.y += (ky / len) * speed * dt
      player.dir = kx < 0 ? -1 : kx > 0 ? 1 : player.dir
    } else if (pointer.active) {
      const dx = pointer.x - player.x
      const dy = pointer.y - player.y
      const ease = Math.min(1, dt * agility)
      player.x += dx * ease
      player.y += dy * ease
      if (Math.abs(dx) > 6) player.dir = dx < 0 ? -1 : 1
    }

    player.x = clamp(player.x, player.r * 0.9, W - player.r * 0.9)
    player.y = clamp(player.y, player.r * 0.9, H - player.r * 0.9)
    player.bob += dt * 6
    if (player.invuln > 0) player.invuln -= dt

    // 生成节奏随时间加快
    state.spawnTimer -= dt
    if (state.spawnTimer <= 0 && fishes.length < 42) {
      spawnFish()
      state.spawnTimer = clamp(0.72 - state.elapsed * 0.012, 0.22, 0.72)
    }
    if (bubbles.length < 40 && Math.random() < dt * 6) spawnBubble()

    // 鱼群
    for (let i = fishes.length - 1; i >= 0; i--) {
      const f = fishes[i]
      f.wob += dt * 3
      f.x += f.vx * dt
      f.y += (f.vy + Math.sin(f.wob) * 16) * dt
      f.y = clamp(f.y, f.r, H - f.r)

      const margin = f.r + 80
      if (f.x < -margin || f.x > W + margin) {
        fishes.splice(i, 1)
        continue
      }

      // 碰撞：吃 or 被撞
      const d = Math.hypot(f.x - player.x, f.y - player.y)
      if (d < player.r * 0.82 + f.r * 0.66) {
        if (f.r < player.r * 0.92) {
          // 吃掉 → 长大
          state.score += Math.round(f.r * 1.5 + 2)
          const gain = f.r * 0.16 + 0.35
          player.r = Math.min(105, player.r + gain * (1 - player.r / 190))
          burst(f.x, f.y, f.r, f.top[0], 12)
          fishes.splice(i, 1)
          syncHud()
        } else if (player.invuln <= 0) {
          // 被更大的鱼撞到
          state.lives -= 1
          state.shake = 14
          player.invuln = 1.7
          player.r = Math.max(12, player.r * 0.84)
          burst(player.x, player.y, player.r, '#9fe9ff', 18)
          syncHud()
          if (state.lives <= 0) {
            gameOver()
            return
          }
        }
      }
    }

    // 气泡
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]
      b.y -= b.spd * dt
      b.x += Math.sin(b.wob + b.y * 0.02) * 12 * dt
      if (b.y < -10) bubbles.splice(i, 1)
    }

    // 粒子
    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i]
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 2.4
      p.vy = p.vy * (1 - dt * 2.4) + 40 * dt
      if (p.life <= 0) bits.splice(i, 1)
    }
  }

  /* ── 绘制 ─────────────────────────────────────────── */
  function drawFish(x, y, r, dir, colors, opts = {}) {
    const belly = opts.belly || colors[0]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(opts.tilt || 0)
    ctx.scale(dir, 1)

    // 尾巴
    ctx.beginPath()
    ctx.moveTo(-r * 0.78, 0)
    ctx.quadraticCurveTo(-r * 1.45, -r * 0.7, -r * 1.62, -r * 0.16)
    ctx.quadraticCurveTo(-r * 1.3, 0, -r * 1.62, r * 0.16)
    ctx.quadraticCurveTo(-r * 1.45, r * 0.7, -r * 0.78, 0)
    ctx.closePath()
    ctx.fillStyle = colors[1]
    ctx.fill()

    // 背鳍
    ctx.beginPath()
    ctx.moveTo(-r * 0.1, -r * 0.6)
    ctx.quadraticCurveTo(r * 0.1, -r * 1.15, r * 0.55, -r * 0.5)
    ctx.closePath()
    ctx.fillStyle = colors[1]
    ctx.fill()

    // 身体
    const g = ctx.createLinearGradient(0, -r * 0.75, 0, r * 0.75)
    g.addColorStop(0, colors[0])
    g.addColorStop(0.62, colors[1])
    g.addColorStop(1, belly)
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.72, 0, 0, TAU)
    ctx.fillStyle = g
    ctx.fill()

    // 肚子高光
    ctx.beginPath()
    ctx.ellipse(r * 0.12, r * 0.24, r * 0.6, r * 0.32, 0, 0, TAU)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.fill()

    // 眼睛
    const ex = r * 0.5
    const ey = -r * 0.18
    ctx.beginPath()
    ctx.arc(ex, ey, r * 0.2, 0, TAU)
    ctx.fillStyle = '#f6fbff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ex + r * 0.04, ey, r * 0.1, 0, TAU)
    ctx.fillStyle = '#0b2233'
    ctx.fill()

    // 危险鱼：竖眉 + 尖牙
    if (opts.angry) {
      ctx.beginPath()
      ctx.moveTo(ex - r * 0.2, ey - r * 0.3)
      ctx.lineTo(ex + r * 0.2, ey - r * 0.16)
      ctx.strokeStyle = '#2a1140'
      ctx.lineWidth = Math.max(1.4, r * 0.09)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(r * 0.62, r * 0.12)
      ctx.lineTo(r * 0.9, r * 0.2)
      ctx.lineTo(r * 0.62, r * 0.3)
      ctx.closePath()
      ctx.fillStyle = '#fff6f6'
      ctx.fill()
    } else {
      // 小微笑
      ctx.beginPath()
      ctx.arc(r * 0.56, r * 0.1, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.strokeStyle = 'rgba(6,32,52,0.5)'
      ctx.lineWidth = Math.max(1, r * 0.06)
      ctx.stroke()
    }

    ctx.restore()
  }

  /* 玩家：蓝色 Q 版女仆「鲸鱼娘」
   * 依据 DeepSeek 鲸鱼娘的实际设定：
   *   藏青(深蓝)女仆长裙 + 白色蕾丝围裙与头饰、领口小蝴蝶结
   *   渐变蓝长发（发顶浅、发梢深）、呆毛、鲸鱼鳍耳、深蓝鲸尾、蓝眼睛、露齿笑
   * r 为身体半径，整体高约 2.6r
   */
  function drawMaid(x, y, r, dir, t) {
    const skin = '#ffe3d5'
    const white = '#f8faff'
    const lace = '#e6ecfb'
    const navy = '#2c3160'
    const navyDark = '#1e2247'
    const hairTop = '#a9c6f2'
    const hairDeep = '#5b7fc4'
    const tailC = '#4a5a86'
    const eyeC = '#2f6ec4'

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(dir, 1)

    const hairGrad = ctx.createLinearGradient(0, -r * 1.5, 0, r * 1.1)
    hairGrad.addColorStop(0, hairTop)
    hairGrad.addColorStop(1, hairDeep)

    // 鲸尾（身后，两个叶片，随时间轻摆）
    const sway = Math.sin(t * 5) * 0.14
    ctx.save()
    ctx.translate(r * 0.5, r * 0.72)
    ctx.rotate(sway)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(r * 0.5, r * 0.24, r * 1.02, r * 0.06)
    ctx.quadraticCurveTo(r * 0.66, r * 0.42, r * 0.94, r * 0.6)
    ctx.quadraticCurveTo(r * 0.4, r * 0.54, 0, r * 0.28)
    ctx.closePath()
    ctx.fillStyle = tailC
    ctx.fill()
    ctx.restore()

    // 长发（后层，垂到裙摆）
    ctx.beginPath()
    ctx.moveTo(-r * 0.72, -r * 0.8)
    ctx.quadraticCurveTo(-r * 1.06, r * 0.1, -r * 0.8, r * 1.12)
    ctx.quadraticCurveTo(-r * 0.5, r * 0.9, -r * 0.32, r * 1.0)
    ctx.quadraticCurveTo(-r * 0.52, r * 0.1, -r * 0.44, -r * 0.7)
    ctx.closePath()
    ctx.fillStyle = hairGrad
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(r * 0.72, -r * 0.8)
    ctx.quadraticCurveTo(r * 1.06, r * 0.1, r * 0.8, r * 1.12)
    ctx.quadraticCurveTo(r * 0.5, r * 0.9, r * 0.32, r * 1.0)
    ctx.quadraticCurveTo(r * 0.52, r * 0.1, r * 0.44, -r * 0.7)
    ctx.closePath()
    ctx.fillStyle = hairGrad
    ctx.fill()

    // 裙摆（藏青长裙）
    ctx.beginPath()
    ctx.moveTo(-r * 0.44, -r * 0.2)
    ctx.quadraticCurveTo(-r * 0.6, r * 0.5, -r * 0.84, r * 0.96)
    ctx.quadraticCurveTo(0, r * 1.16, r * 0.84, r * 0.96)
    ctx.quadraticCurveTo(r * 0.6, r * 0.5, r * 0.44, -r * 0.2)
    ctx.closePath()
    const dressGrad = ctx.createLinearGradient(0, -r * 0.3, 0, r * 1.1)
    dressGrad.addColorStop(0, navy)
    dressGrad.addColorStop(1, navyDark)
    ctx.fillStyle = dressGrad
    ctx.fill()

    // 裙摆蕾丝边
    ctx.beginPath()
    ctx.moveTo(-r * 0.84, r * 0.96)
    ctx.quadraticCurveTo(0, r * 1.16, r * 0.84, r * 0.96)
    ctx.quadraticCurveTo(0, r * 1.3, -r * 0.84, r * 0.96)
    ctx.closePath()
    ctx.fillStyle = lace
    ctx.fill()

    // 白色围裙（带扇贝边）
    ctx.beginPath()
    ctx.moveTo(-r * 0.24, -r * 0.16)
    ctx.lineTo(r * 0.24, -r * 0.16)
    ctx.quadraticCurveTo(r * 0.36, r * 0.46, r * 0.44, r * 0.82)
    ctx.quadraticCurveTo(0, r * 1.02, -r * 0.44, r * 0.82)
    ctx.quadraticCurveTo(-r * 0.36, r * 0.46, -r * 0.24, -r * 0.16)
    ctx.closePath()
    ctx.fillStyle = white
    ctx.fill()

    // 围裙上的小鲸鱼
    ctx.beginPath()
    ctx.ellipse(0, r * 0.52, r * 0.14, r * 0.09, 0, 0, TAU)
    ctx.fillStyle = navy
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(r * 0.12, r * 0.52)
    ctx.lineTo(r * 0.24, r * 0.44)
    ctx.lineTo(r * 0.24, r * 0.6)
    ctx.closePath()
    ctx.fillStyle = navy
    ctx.fill()

    // 胸挡（白）+ 藏青马甲
    ctx.beginPath()
    ctx.moveTo(-r * 0.3, -r * 0.62)
    ctx.lineTo(r * 0.3, -r * 0.62)
    ctx.quadraticCurveTo(r * 0.34, -r * 0.3, r * 0.24, -r * 0.1)
    ctx.lineTo(-r * 0.24, -r * 0.1)
    ctx.quadraticCurveTo(-r * 0.34, -r * 0.3, -r * 0.3, -r * 0.62)
    ctx.closePath()
    ctx.fillStyle = white
    ctx.fill()
    ctx.strokeStyle = navy
    ctx.lineWidth = Math.max(1, r * 0.05)
    ctx.beginPath()
    ctx.moveTo(-r * 0.22, -r * 0.58)
    ctx.lineTo(-r * 0.16, -r * 0.14)
    ctx.moveTo(r * 0.22, -r * 0.58)
    ctx.lineTo(r * 0.16, -r * 0.14)
    ctx.stroke()

    // 领口蝴蝶结
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(0, -r * 0.66)
      ctx.quadraticCurveTo(sx * r * 0.18, -r * 0.8, sx * r * 0.08, -r * 0.58)
      ctx.closePath()
      ctx.fillStyle = navyDark
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(0, -r * 0.66, r * 0.05, 0, TAU)
    ctx.fillStyle = navyDark
    ctx.fill()

    // 泡泡袖
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(sx * r * 0.52, -r * 0.34, r * 0.2, 0, TAU)
      ctx.fillStyle = navy
      ctx.fill()
      ctx.beginPath()
      ctx.arc(sx * r * 0.6, -r * 0.16, r * 0.12, 0, TAU)
      ctx.fillStyle = lace
      ctx.fill()
    }

    // 鲸鱼鳍耳（头两侧，尖的）
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(sx * r * 0.52, -r * 1.06)
      ctx.quadraticCurveTo(sx * r * 1.1, -r * 1.42, sx * r * 0.86, -r * 0.82)
      ctx.quadraticCurveTo(sx * r * 0.72, -r * 0.7, sx * r * 0.5, -r * 0.86)
      ctx.closePath()
      ctx.fillStyle = tailC
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(sx * r * 0.6, -r * 1.02)
      ctx.quadraticCurveTo(sx * r * 0.92, -r * 1.24, sx * r * 0.78, -r * 0.9)
      ctx.closePath()
      ctx.fillStyle = '#7d8fbd'
      ctx.fill()
    }

    // 头
    ctx.beginPath()
    ctx.arc(0, -r * 0.78, r * 0.62, 0, TAU)
    ctx.fillStyle = skin
    ctx.fill()

    // 头发：头顶 + 刘海
    ctx.beginPath()
    ctx.arc(0, -r * 0.9, r * 0.68, Math.PI, TAU)
    ctx.closePath()
    ctx.fillStyle = hairGrad
    ctx.fill()
    // 侧发束
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(sx * r * 0.62, -r * 0.72, r * 0.18, r * 0.42, sx * 0.16, 0, TAU)
      ctx.fillStyle = hairGrad
      ctx.fill()
    }

    // 呆毛
    ctx.beginPath()
    ctx.moveTo(r * 0.04, -r * 1.52)
    ctx.quadraticCurveTo(r * 0.34, -r * 1.92, r * 0.02, -r * 1.96)
    ctx.strokeStyle = hairTop
    ctx.lineWidth = Math.max(1.4, r * 0.07)
    ctx.lineCap = 'round'
    ctx.stroke()

    // 女仆头饰：白色蕾丝带 + 扇贝
    ctx.beginPath()
    ctx.arc(0, -r * 0.9, r * 0.68, Math.PI * 1.06, Math.PI * 1.94)
    ctx.arc(0, -r * 0.9, r * 0.52, Math.PI * 1.94, Math.PI * 1.06, true)
    ctx.closePath()
    ctx.fillStyle = white
    ctx.fill()
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * (1.08 + (i / 6) * 0.84)
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r * 0.72, -r * 0.9 + Math.sin(a) * r * 0.72, r * 0.075, 0, TAU)
      ctx.fillStyle = white
      ctx.fill()
    }
    // 头饰上的小蓝蝴蝶结
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(-r * 0.34 + sx * r * 0.09, -r * 1.34, r * 0.09, r * 0.06, sx * 0.4, 0, TAU)
      ctx.fillStyle = '#6f9ade'
      ctx.fill()
    }

    // 眼睛（蓝瞳 + 高光）
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(sx * r * 0.25, -r * 0.76, r * 0.15, r * 0.19, 0, 0, TAU)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(sx * r * 0.25, -r * 0.75, r * 0.115, r * 0.155, 0, 0, TAU)
      ctx.fillStyle = eyeC
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(sx * r * 0.25, -r * 0.73, r * 0.058, r * 0.1, 0, 0, TAU)
      ctx.fillStyle = '#16325a'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(sx * r * 0.25 + r * 0.045, -r * 0.82, r * 0.042, 0, TAU)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    // 腮红
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(sx * r * 0.45, -r * 0.58, r * 0.11, r * 0.06, 0, 0, TAU)
      ctx.fillStyle = 'rgba(255, 150, 175, 0.45)'
      ctx.fill()
    }

    // 露齿笑
    ctx.beginPath()
    ctx.arc(0, -r * 0.58, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.closePath()
    ctx.fillStyle = '#7c3548'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-r * 0.06, -r * 0.535)
    ctx.lineTo(r * 0.06, -r * 0.535)
    ctx.lineTo(r * 0.04, -r * 0.5)
    ctx.lineTo(-r * 0.04, -r * 0.5)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.restore()
  }


  function render(t) {
    ctx.save()
    if (state.shake > 0.2) {
      ctx.translate(rand(-state.shake, state.shake) * 0.4, rand(-state.shake, state.shake) * 0.4)
    }

    // 水
    ctx.fillStyle = water || '#04203f'
    ctx.fillRect(-20, -20, W + 40, H + 40)

    // 光柱
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 3; i++) {
      const x = ((i + 0.5) / 3) * W + Math.sin(t * 0.15 + i) * 40
      const grad = ctx.createLinearGradient(x, 0, x + 120, H)
      grad.addColorStop(0, 'rgba(120, 220, 255, 0.10)')
      grad.addColorStop(1, 'rgba(120, 220, 255, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(x - 60, 0)
      ctx.lineTo(x + 60, 0)
      ctx.lineTo(x + 200, H)
      ctx.lineTo(x + 20, H)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()

    // 气泡
    for (const b of bubbles) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, TAU)
      ctx.strokeStyle = 'rgba(190, 240, 255, 0.28)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // 鱼（大的先画，形成层次）
    const ordered = fishes.slice().sort((a, b) => b.r - a.r)
    for (const f of ordered) {
      const tilt = clamp(f.vy / 400, -0.25, 0.25) * f.dir
      drawFish(f.x, f.y, f.r, f.dir, f.top, { angry: f.dangerous, tilt, belly: f.belly })
    }

    // 玩家（受击时闪烁；出生保护从"可见"那一相开始，避免开局看不见自己）
    const noBlink = params.get('noblink') === '1'
    const blink = !noBlink && player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 1
    if (!blink) {
      const bob = Math.sin(player.bob) * player.r * 0.045
      ctx.save()
      ctx.shadowColor = 'rgba(55, 193, 255, 0.8)'
      ctx.shadowBlur = 26
      drawMaid(player.x, player.y + bob, player.r, player.dir, t)
      ctx.restore()
    }

    // 粒子
    for (const p of bits) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, TAU)
      ctx.fillStyle = p.color
      ctx.fill()
    }
    ctx.globalAlpha = 1

    ctx.restore()
  }

  /* ── 主循环 ───────────────────────────────────────── */
  let dbg = null
  if (params.get('debug') === '1') {
    dbg = document.createElement('pre')
    dbg.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9;margin:0;padding:8px 10px;border-radius:8px;' +
      'font:11px/1.5 ui-monospace,Menlo,monospace;color:#9fe9ff;background:rgba(0,0,0,.55);white-space:pre'
    document.body.appendChild(dbg)
  }

  let last = performance.now()
  function frame(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05)
    last = now
    if (state.mode === 'play') update(dt)
    else if (state.mode === 'idle') player.bob += dt * 5
    render(now / 1000)
    if (dbg) {
      dbg.textContent =
        `mode ${state.mode}  fps ${dt > 0 ? (1 / dt).toFixed(0) : '-'}\n` +
        `invuln ${player.invuln.toFixed(2)}  blink ${blinkState()}\n` +
        `pos ${player.x | 0},${player.y | 0}  r ${player.r.toFixed(1)}  dir ${player.dir}\n` +
        `fish ${fishes.length}  score ${state.score}  lives ${state.lives}`
    }
    requestAnimationFrame(frame)
  }

  function blinkState() {
    return player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 1 ? 'hidden' : 'shown'
  }

  /* ── 启动 ─────────────────────────────────────────── */
  resize()
  player.x = W * 0.5
  player.y = H * 0.55
  for (let i = 0; i < 22; i++) spawnBubble()
  syncHud()
  el.best.textContent = '最高分 ' + state.best
  requestAnimationFrame(frame)

  // 自动化 / 演示：?auto=1 直接开始
  if (params.get('auto') === '1') startGame()
})()
