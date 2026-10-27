/* 微粒沙盘 · 界面与主循环 */
import {
  E, ELEMENT_INFO, createGrid, paint, clearGrid, step, total, preset, inBounds,
} from './sim.js'
import { Renderer, PALETTE } from './render.js'

const stage = document.getElementById('stage')
const canvas = document.getElementById('grid')
const statCells = document.getElementById('cells')
const statFps = document.getElementById('fps')
const statTick = document.getElementById('tick')
const brushInput = document.getElementById('brush')
const brushLabel = document.getElementById('brushLabel')
const pauseBtn = document.getElementById('pause')
const stepBtn = document.getElementById('stepOne')
const clearBtn = document.getElementById('clear')
const toolbar = document.getElementById('tools')

const GRID_W = 200
const GRID_H = 120

const TOOLS = [
  { el: E.SAND, label: '沙' },
  { el: E.WATER, label: '水' },
  { el: E.OIL, label: '油' },
  { el: E.FIRE, label: '火' },
  { el: E.PLANT, label: '草' },
  { el: E.ACID, label: '酸' },
  { el: E.LAVA, label: '岩浆' },
  { el: E.STONE, label: '石' },
  { el: E.WOOD, label: '木' },
  { el: E.EMPTY, label: '擦' },
]

const state = {
  tool: E.SAND,
  brush: 4,
  paused: false,
  paintSeed: 0,
  fps: 0,
  frames: 0,
  fpsAt: performance.now(),
}

let grid = preset('hourglass', GRID_W, GRID_H)
const renderer = new Renderer(canvas, grid)

/* ── 工具栏 ─────────────────────────────────────────── */
for (const tool of TOOLS) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'tool'
  btn.dataset.el = String(tool.el)
  if (tool.el === state.tool) btn.classList.add('active')
  const rgb = PALETTE[tool.el] || [200, 200, 200]
  btn.style.setProperty('--swatch', `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`)
  btn.innerHTML = `<i></i><span>${tool.label}</span>`
  btn.addEventListener('click', () => selectTool(tool.el))
  toolbar.appendChild(btn)
}

function selectTool(el) {
  state.tool = el
  for (const btn of toolbar.children) {
    btn.classList.toggle('active', Number(btn.dataset.el) === el)
  }
}

/* ── 绘制交互 ───────────────────────────────────────── */
let painting = false

function paintAt(e) {
  const cell = renderer.toCell(e.clientX, e.clientY)
  if (!inBounds(grid, cell.x, cell.y)) return
  const jitter = state.tool === E.EMPTY ? 0 : 0
  paint(grid, cell.x + jitter, cell.y, state.brush, state.tool, state.tool === E.FIRE ? 90 : 0)
}

canvas.addEventListener('pointerdown', (e) => {
  painting = true
  canvas.setPointerCapture?.(e.pointerId)
  paintAt(e)
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('pointermove', (e) => {
  if (!painting) return
  paintAt(e)
  e.preventDefault()
}, { passive: false })

window.addEventListener('pointerup', () => { painting = false })
canvas.addEventListener('pointercancel', () => { painting = false })
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  // 右键擦拭
  const prev = state.tool
  state.tool = E.EMPTY
  paintAt(e)
  state.tool = prev
})

/* ── 控件 ───────────────────────────────────────────── */
brushInput.addEventListener('input', () => {
  state.brush = Number(brushInput.value)
  brushLabel.textContent = String(state.brush)
})

function setPaused(v) {
  state.paused = v
  pauseBtn.textContent = v ? '继续' : '暂停'
  pauseBtn.classList.toggle('on', v)
}
pauseBtn.addEventListener('click', () => setPaused(!state.paused))
stepBtn.addEventListener('click', () => step(grid))
clearBtn.addEventListener('click', () => clearGrid(grid))

document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    grid = preset(btn.dataset.preset, GRID_W, GRID_H)
    renderer.draw(grid)
  })
})

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === ' ') { setPaused(!state.paused); e.preventDefault() }
  else if (k === 'c') clearGrid(grid)
  else if (k === 'n') step(grid)
  else if (/^[1-9]$/.test(k)) {
    const idx = Number(k) - 1
    if (TOOLS[idx]) selectTool(TOOLS[idx].el)
  } else if (k === '0') {
    selectTool(E.EMPTY)
  } else if (k === '[') {
    state.brush = Math.max(1, state.brush - 1)
    brushInput.value = String(state.brush)
    brushLabel.textContent = String(state.brush)
  } else if (k === ']') {
    state.brush = Math.min(14, state.brush + 1)
    brushInput.value = String(state.brush)
    brushLabel.textContent = String(state.brush)
  }
})

/* ── 尺寸 ───────────────────────────────────────────── */
function relayout() {
  renderer.fit(stage)
  renderer.draw(grid)
}
window.addEventListener('resize', relayout, { passive: true })
window.addEventListener('orientationchange', () => setTimeout(relayout, 150), { passive: true })

/* ── 主循环 ─────────────────────────────────────────── */
let last = performance.now()

function frame(now) {
  const dt = now - last
  last = now

  if (!state.paused) step(grid)
  renderer.draw(grid)

  state.frames++
  if (now - state.fpsAt > 400) {
    state.fps = Math.round((state.frames * 1000) / (now - state.fpsAt))
    state.frames = 0
    state.fpsAt = now
    statFps.textContent = String(state.fps)
    statCells.textContent = total(grid).toLocaleString('en-US')
    statTick.textContent = String(grid.tick)
  }

  requestAnimationFrame(frame)
}

brushLabel.textContent = String(state.brush)
relayout()
requestAnimationFrame(frame)

// 调试/自动化入口
window.__powder = {
  state,
  get grid() { return grid },
  stats: () => ({ cells: total(grid), tick: grid.tick, fps: state.fps, paused: state.paused }),
}
