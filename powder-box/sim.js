/* 微粒沙盘 · 模拟内核
 * 落沙类元胞自动机：一格一个粒子，每帧自底向上扫一遍，每个粒子最多移动一格。
 * 全部是纯函数 + 类型化数组，不碰 DOM —— 可以在 node 里跑上千帧做断言。
 */

export const E = {
  EMPTY: 0,
  SAND: 1,
  WATER: 2,
  OIL: 3,
  STONE: 4,
  WOOD: 5,
  FIRE: 6,
  SMOKE: 7,
  STEAM: 8,
  PLANT: 9,
  ACID: 10,
  LAVA: 11,
}

export const ELEMENT_INFO = {
  [E.EMPTY]: { name: '空', kind: 'none', flammability: 0 },
  [E.SAND]: { name: '沙', kind: 'powder', flammability: 0 },
  [E.WATER]: { name: '水', kind: 'liquid', flammability: 0 },
  [E.OIL]: { name: '油', kind: 'liquid', flammability: 0.85 },
  [E.STONE]: { name: '石', kind: 'solid', flammability: 0 },
  [E.WOOD]: { name: '木', kind: 'solid', flammability: 0.55 },
  [E.FIRE]: { name: '火', kind: 'gas', flammability: 0 },
  [E.SMOKE]: { name: '烟', kind: 'gas', flammability: 0 },
  [E.STEAM]: { name: '汽', kind: 'gas', flammability: 0 },
  [E.PLANT]: { name: '草', kind: 'solid', flammability: 0.7 },
  [E.ACID]: { name: '酸', kind: 'liquid', flammability: 0 },
  [E.LAVA]: { name: '岩浆', kind: 'liquid', flammability: 0 },
}

const LIQUIDS = new Set([E.WATER, E.OIL, E.ACID, E.LAVA])
const GASES = new Set([E.FIRE, E.SMOKE, E.STEAM])
const FLAMMABLE = new Set([E.WOOD, E.OIL, E.PLANT])
const DISSOLVABLE = new Set([E.STONE, E.WOOD, E.SAND])

const isLiquid = (t) => LIQUIDS.has(t)
const isGas = (t) => GASES.has(t)

/** 液体的"密度"，越大越沉；油浮在水上 */
const DENSITY = {
  [E.WATER]: 3,
  [E.OIL]: 2,
  [E.ACID]: 3.2,
  [E.LAVA]: 5,
}

export function createGrid(w, h) {
  return {
    w,
    h,
    cells: new Uint8Array(w * h),
    life: new Uint8Array(w * h),
    flip: false,
    tick: 0,
  }
}

export const idx = (g, x, y) => y * g.w + x

export function inBounds(g, x, y) {
  return x >= 0 && x < g.w && y >= 0 && y < g.h
}

function swap(g, i, j) {
  const c = g.cells
  const l = g.life
  const tc = c[i]
  c[i] = c[j]
  c[j] = tc
  const tl = l[i]
  l[i] = l[j]
  l[j] = tl
}

function move(g, from, to) {
  g.cells[to] = g.cells[from]
  g.life[to] = g.life[from]
  g.cells[from] = E.EMPTY
  g.life[from] = 0
}

/** 目标格能否被 src 元素占据 */
function canMoveInto(g, to, src, srcI) {
  const t = g.cells[to]
  if (t === E.EMPTY) return true
  // 粉末/液体沉入比自己轻的液体
  if (isLiquid(t) && DENSITY[src] !== undefined && DENSITY[src] > DENSITY[t]) return true
  if (src === E.SAND && isLiquid(t)) return true
  return false
}

/* ── 绘制（写入用，不算模拟）────────────────────────── */
export function paint(g, cx, cy, radius, type, life = 0) {
  const r2 = radius * radius
  for (let y = cy - radius; y <= cy + radius; y++) {
    if (y < 0 || y >= g.h) continue
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || x >= g.w) continue
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy > r2) continue
      const i = y * g.w + x
      g.cells[i] = type
      g.life[i] = type === E.PLANT ? 40 : life
    }
  }
}

export function clearGrid(g) {
  g.cells.fill(E.EMPTY)
  g.life.fill(0)
  g.tick = 0
}

/* ── 单帧推进 ────────────────────────────────────────── */
export function step(g, rand = Math.random) {
  const { w, h, cells, life } = g
  const bias = g.flip ? 1 : -1
  g.flip = !g.flip
  g.tick++

  for (let y = h - 1; y >= 0; y--) {
    const row = y * w
    for (let k = 0; k < w; k++) {
      const x = bias > 0 ? k : w - 1 - k
      const i = row + x
      const t = cells[i]
      if (t === E.EMPTY) continue

      switch (t) {
        case E.SAND:
          updatePowder(g, x, y, i, t, rand)
          break
        case E.WATER:
        case E.OIL:
        case E.ACID:
          updateLiquid(g, x, y, i, t, rand)
          break
        case E.LAVA:
          if (rand() < 0.34) updateLava(g, x, y, i, rand)
          break
        case E.FIRE:
          updateFire(g, x, y, i, rand)
          break
        case E.SMOKE:
        case E.STEAM:
          updateGas(g, x, y, i, t, rand)
          break
        case E.PLANT:
          updatePlant(g, x, y, i, rand)
          break
        default:
          break // 石、木静止
      }
    }
  }
  return g
}

function updatePowder(g, x, y, i, t, rand) {
  const { w, h, cells } = g
  const below = i + w
  if (y + 1 < h) {
    if (canMoveInto(g, below, t, i)) {
      if (cells[below] === E.EMPTY) move(g, i, below)
      else swap(g, i, below) // 沉入液体
      return
    }
    const dir = rand() < 0.5 ? -1 : 1
    for (const d of [dir, -dir]) {
      const nx = x + d
      if (nx < 0 || nx >= w) continue
      const target = below + d
      if (canMoveInto(g, target, t, i)) {
        if (cells[target] === E.EMPTY) move(g, i, target)
        else swap(g, i, target)
        return
      }
    }
  }
}

function updateLiquid(g, x, y, i, t, rand) {
  const { w, h } = g
  // 先向下
  if (y + 1 < h) {
    const below = i + w
    if (canMoveInto(g, below, t, i)) {
      if (g.cells[below] === E.EMPTY) move(g, i, below)
      else swap(g, i, below)
      return
    }
    const dir = rand() < 0.5 ? -1 : 1
    for (const d of [dir, -dir]) {
      const nx = x + d
      if (nx < 0 || nx >= w) continue
      const target = below + d
      if (canMoveInto(g, target, t, i)) {
        if (g.cells[target] === E.EMPTY) move(g, i, target)
        else swap(g, i, target)
        return
      }
    }
  }
  // 再横向摊平（这样水才会有"水位"）
  const dir = rand() < 0.5 ? -1 : 1
  for (const d of [dir, -dir]) {
    const nx = x + d
    if (nx < 0 || nx >= w) continue
    const target = i + d
    if (g.cells[target] === E.EMPTY) {
      move(g, i, target)
      return
    }
  }

  // 酸：腐蚀相邻的可溶物
  if (t === E.ACID) {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const n = ny * w + nx
      if (DISSOLVABLE.has(g.cells[n])) {
        g.cells[n] = E.EMPTY
        if (rand() < 0.55) {
          g.cells[i] = E.EMPTY // 酸被消耗
          return
        }
      }
    }
  }
}

function updateLava(g, x, y, i, rand) {
  const { w, h } = g
  // 遇水：岩浆凝固成石，水变蒸汽
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
    const n = ny * w + nx
    if (g.cells[n] === E.WATER) {
      g.cells[n] = E.STEAM
      g.life[n] = 120
      g.cells[i] = E.STONE
      return
    }
    if (FLAMMABLE.has(g.cells[n]) && rand() < 0.5) {
      g.cells[n] = E.FIRE
      g.life[n] = 60 + ((rand() * 60) | 0)
    }
  }
  updateLiquid(g, x, y, i, E.LAVA, rand)
}

function updateFire(g, x, y, i, rand) {
  const { w, h, cells, life } = g
  if (life[i] > 0) life[i]--
  if (life[i] === 0) {
    cells[i] = rand() < 0.4 ? E.SMOKE : E.EMPTY
    life[i] = cells[i] === E.SMOKE ? 90 : 0
    return
  }

  // 点燃邻居
  for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
    const n = ny * w + nx
    const nt = cells[n]
    if (FLAMMABLE.has(nt) && rand() < 0.28) {
      cells[n] = E.FIRE
      life[n] = 50 + ((rand() * 50) | 0)
    } else if (nt === E.WATER && rand() < 0.6) {
      // 水灭火
      cells[i] = E.STEAM
      life[i] = 80
      return
    }
  }

  // 火焰向上窜
  if (y > 0) {
    const up = i - w
    if (cells[up] === E.EMPTY || isGas(cells[up])) {
      move(g, i, up)
    }
  }
}

function updateGas(g, x, y, i, t, rand) {
  const { w, h, cells, life } = g

  if (t === E.SMOKE || t === E.STEAM) {
    if (life[i] > 0) life[i]--
    if (life[i] === 0) {
      // 蒸汽冷凝回水，烟消散
      cells[i] = t === E.STEAM ? E.WATER : E.EMPTY
      life[i] = 0
      return
    }
  }

  // 上升，带一点横向抖动
  if (y > 0) {
    const dir = rand() < 0.5 ? -1 : 1
    for (const dx of [0, dir, -dir]) {
      const nx = x + dx
      if (nx < 0 || nx >= g.w) continue
      const target = (y - 1) * w + nx
      if (cells[target] === E.EMPTY) {
        move(g, i, target)
        return
      }
    }
  }
}

function updatePlant(g, x, y, i, rand) {
  const { w, h, cells, life } = g
  if (life[i] > 0) life[i]--

  // 有相邻的水才会长
  let nearWater = -1
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
    const n = ny * w + nx
    if (cells[n] === E.WATER) { nearWater = n; break }
  }
  if (nearWater < 0) return
  if (rand() > 0.16) return

  // 把水变成草，并尝试从空位向上蔓延
  cells[nearWater] = E.PLANT
  life[nearWater] = 30 + ((rand() * 30) | 0)

  const candidates = []
  for (const [dx, dy] of [[0, -1], [1, -1], [-1, -1], [1, 0], [-1, 0]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
    if (cells[ny * w + nx] === E.EMPTY) candidates.push(ny * w + nx)
  }
  if (candidates.length && rand() < 0.5) {
    const n = candidates[(rand() * candidates.length) | 0]
    cells[n] = E.PLANT
    life[n] = 20 + ((rand() * 40) | 0)
  }
}

/* ── 统计 / 校验辅助 ─────────────────────────────────── */

export function count(g) {
  const out = {}
  for (const k of Object.keys(E)) out[k] = 0
  const cells = g.cells
  for (let i = 0; i < cells.length; i++) {
    const t = cells[i]
    const key = Object.keys(E)[t]
    if (key) out[key]++
  }
  return out
}

export function total(g) {
  let n = 0
  const cells = g.cells
  for (let i = 0; i < cells.length; i++) if (cells[i] !== E.EMPTY) n++
  return n
}

/** FNV-1a，用于确定性对比 */
export function hash(g) {
  let h = 0x811c9dc5
  const cells = g.cells
  for (let i = 0; i < cells.length; i++) {
    h ^= cells[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

/** 每种元素占据的纵向平均位置（测试油水浮沉用） */
export function meanY(g, type) {
  let sum = 0
  let n = 0
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.cells[y * g.w + x] === type) { sum += y; n++ }
    }
  }
  return n ? sum / n : NaN
}

/* ── 预设场景（纯数据，可测）────────────────────────── */
export function preset(name, w, h) {
  const g = createGrid(w, h)
  const rnd = mulberry(97)

  if (name === 'hourglass') {
    // 上窄下宽的两堆沙 + 中间通道（注意用 Math.floor，别让 | 的优先级坑到循环条件）
    for (let y = 4; y < h * 0.42; y++) {
      const half = Math.round(w * 0.26 * (1 - (y - 4) / (h * 0.5)))
      const x0 = Math.floor(w / 2 - half)
      const x1 = Math.floor(w / 2 + half)
      for (let x = x0; x < x1; x++) {
        if (x >= 0 && x < w) paint(g, x, y, 0, E.SAND)
      }
    }
    for (let y = 0; y < h; y++) {
      paint(g, 2, y, 0, E.STONE)
      paint(g, w - 3, y, 0, E.STONE)
    }
    for (let x = 0; x < w; x++) {
      paint(g, x, h - 1, 0, E.STONE)
      paint(g, x, h - 2, 0, E.STONE)
    }
  } else if (name === 'volcano') {
    for (let x = 0; x < w; x++) {
      const ground = Math.round(h * 0.78 + Math.sin(x * 0.09) * 6)
      for (let y = ground; y < h; y++) paint(g, x, y, 0, E.STONE)
    }
    const ventX = Math.floor(w / 2)
    for (let x = ventX; x < ventX + 6; x++) paint(g, x, Math.round(h * 0.62), 2, E.LAVA)
    paint(g, ventX, Math.round(h * 0.55), 3, E.LAVA)
    for (let i = 0; i < w * 2; i++) {
      const x = (rnd() * w) | 0
      paint(g, x, Math.round(h * 0.7) + ((rnd() * 8) | 0), 0, E.WOOD)
    }
  } else if (name === 'rainforest') {
    for (let x = 0; x < w; x++) {
      for (let y = Math.round(h * 0.86); y < h; y++) paint(g, x, y, 0, E.STONE)
    }
    for (let x = 0; x < w; x += 9) {
      for (let y = Math.round(h * 0.5); y < h * 0.86; y++) paint(g, x, y, 0, E.PLANT)
    }
    for (let i = 0; i < w * 3; i++) {
      const x = (rnd() * w) | 0
      paint(g, x, ((rnd() * h * 0.18) | 0), 0, E.WATER)
    }
  } else if (name === 'acidpool') {
    for (let x = 0; x < w; x++) {
      for (let y = Math.round(h * 0.8); y < h; y++) paint(g, x, y, 0, E.STONE)
    }
    paint(g, (w / 2) | 0, Math.round(h * 0.55), 9, E.ACID)
    for (let x = 0; x < w; x += 13) {
      for (let y = Math.round(h * 0.3); y < h * 0.8; y++) paint(g, x, y, 0, E.WOOD)
    }
  }
  return g
}

/** 确定性 PRNG（预设里用，保证场景可复现） */
export function mulberry(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
