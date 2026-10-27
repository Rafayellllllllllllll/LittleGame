/* 深海观测站 · 纯模拟层
 * 这里所有函数都不碰 DOM/Canvas，可以在 node 里直接跑测试。
 * 浏览器与测试共用同一份代码，所以"看起来对"和"算得对"是一回事。
 */

/* ── 确定性随机 & 值噪声 ───────────────────────────────── */

/** mulberry32：小而稳的 PRNG，同种子同序列 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 整数格点哈希 → [0,1) */
export function hash2(x, y, seed = 1) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

const smooth = (t) => t * t * (3 - 2 * t)

/** 二维值噪声，范围 [0,1]，同输入必同输出 */
export function noise2(x, y, seed = 1) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = smooth(xf)
  const v = smooth(yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

/** 分形噪声（三层），让流场有粗细两种尺度 */
export function fbm2(x, y, seed = 7) {
  return (
    noise2(x, y, seed) * 0.55 +
    noise2(x * 2.03, y * 2.03, seed + 13) * 0.3 +
    noise2(x * 4.11, y * 4.11, seed + 29) * 0.15
  )
}

/* ── 流场 ────────────────────────────────────────────── */

/**
 * 深海流场：缓慢旋转的涡 + 向上的涌流。
 * @returns {{x:number,y:number}} 单位级方向（长度约 0~1.4）
 */
export function flowAt(x, y, t, scale = 0.0022) {
  const angle = fbm2(x * scale, y * scale, 11) * Math.PI * 2 + t * 0.06
  const strength = 0.45 + fbm2(x * scale + 5.2, y * scale - 3.1, 23) * 1.0
  return {
    x: Math.cos(angle) * strength,
    y: Math.sin(angle) * strength * 0.7 - 0.22, // 整体轻微上涌
  }
}

/* ── 浮游生物（发光点）───────────────────────────────── */

export function createPlankton(n, w, h, rng) {
  const list = new Array(n)
  for (let i = 0; i < n; i++) {
    list[i] = {
      x: rng() * w,
      y: rng() * h,
      z: rng(),                     // 0 远 → 1 近，用于视差/亮度
      phase: rng() * Math.PI * 2,
      hue: 0.5 + rng() * 0.22,      // 青 → 蓝紫
      size: 0.6 + rng() * 1.9,
      vx: 0,
      vy: 0,
    }
  }
  return list
}

/** 一步积分；越靠近镜头的粒子受流场影响越小（视差） */
export function stepPlankton(list, dt, t, w, h, current = null) {
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    const f = flowAt(p.x, p.y, t + p.z * 2)
    const pull = 0.35 + p.z * 0.9
    let ax = f.x * 22 * pull
    let ay = f.y * 22 * pull

    if (current) {
      const dx = p.x - current.x
      const dy = p.y - current.y
      const d2 = dx * dx + dy * dy + 900
      const force = current.strength / d2
      ax += dx * force
      ay += dy * force
    }

    p.vx = (p.vx + ax * dt) * 0.94
    p.vy = (p.vy + ay * dt) * 0.94
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.phase += dt * (1.2 + p.z)

    // 环绕边界，避免生物全挤到一边
    if (p.x < -20) p.x = w + 20
    else if (p.x > w + 20) p.x = -20
    if (p.y < -20) p.y = h + 20
    else if (p.y > h + 20) p.y = -20
  }
  return list
}

/* ── 水母（半透明伞体 + 触手）────────────────────────── */

export function createJellies(n, w, h, rng) {
  const list = new Array(n)
  for (let i = 0; i < n; i++) {
    const r = 16 + rng() * 42
    list[i] = {
      x: rng() * w,
      y: rng() * h,
      r,
      z: 0.25 + rng() * 0.75,
      phase: rng() * Math.PI * 2,
      pulse: 0.55 + rng() * 0.6,
      hue: 0.52 + rng() * 0.2,
      tentacles: Array.from({ length: 5 }, (_, k) => ({
        offset: (k - 2) / 2.2,
        phase: rng() * Math.PI * 2,
        len: r * (2.1 + rng() * 1.7),
      })),
    }
  }
  return list
}

export function stepJellies(list, dt, t, w, h, current = null) {
  for (let i = 0; i < list.length; i++) {
    const j = list[i]
    const f = flowAt(j.x, j.y, t + j.z * 3, 0.0015)
    let vx = f.x * 13
    let vy = f.y * 13 - 6.5 // 水母缓慢上浮
    if (current) {
      const dx = j.x - current.x
      const dy = j.y - current.y
      const d2 = dx * dx + dy * dy + 6400
      vx += dx * (current.strength * 0.35) / d2
      vy += dy * (current.strength * 0.35) / d2
    }
    j.x += vx * dt
    j.y += vy * dt
    j.phase += dt * j.pulse

    if (j.y < -j.r * 3) { j.y = h + j.r * 3; j.x = Math.random() * w }
    if (j.x < -j.r * 3) j.x = w + j.r * 3
    if (j.x > w + j.r * 3) j.x = -j.r * 3
  }
  return list
}

/** 伞体脉动系数 0.86~1.14 */
export function jellyPulseScale(j, t) {
  return 1 + Math.sin(j.phase) * 0.14
}

/* ── 海雪（缓慢下沉的碎屑）──────────────────────────── */

export function createSnow(n, w, h, rng) {
  const list = new Array(n)
  for (let i = 0; i < n; i++) {
    list[i] = {
      x: rng() * w,
      y: rng() * h,
      z: rng(),
      size: 0.5 + rng() * 1.6,
      spd: 6 + rng() * 22,
      drift: rng() * Math.PI * 2,
    }
  }
  return list
}

export function stepSnow(list, dt, t, w, h) {
  for (let i = 0; i < list.length; i++) {
    const s = list[i]
    s.y += s.spd * dt * (0.4 + s.z)
    s.x += Math.sin(t * 0.6 + s.drift) * 7 * dt
    if (s.y > h + 8) { s.y = -8; s.x = Math.random() * w }
    if (s.x < -8) s.x = w + 8
    else if (s.x > w + 8) s.x = -8
  }
  return list
}

/* ── 交互 ────────────────────────────────────────────── */

/** 指针形成的"水流"，强度随距离衰减 */
export function makeCurrent(x, y, strength = 260000, life = 1) {
  return { x, y, strength: strength * life, life }
}

export function decayCurrent(c, dt) {
  c.life = Math.max(0, c.life - dt * 0.8)
  c.strength *= Math.max(0, 1 - dt * 0.9)
  return c
}

/* ── 统计（给 HUD 用，也方便测试）────────────────────── */

export function stats({ plankton = [], jellies = [], snow = [] }) {
  const lum = plankton.reduce((s, p) => s + p.size * (0.4 + p.z * 0.6), 0)
  return {
    plankton: plankton.length,
    jellies: jellies.length,
    snow: snow.length,
    biolume: Math.round(lum * 10) / 10,
  }
}
