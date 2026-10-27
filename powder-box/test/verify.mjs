/* 静态接线校验：node test/verify.mjs
 * 浏览器里跑不了 headless，所以把"一定会炸"的地方在 node 里先查一遍。
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as sim from '../sim.js'
import * as render from '../render.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

const html = read('index.html')
const main = read('main.js')
const css = read('style.css')
const renderSrc = read('render.js')

let fails = 0
const ok = (m) => console.log('  ✓ ' + m)
const bad = (m) => { console.log('  ✗ ' + m); fails++ }

/* 1. DOM 接线 */
console.log('\nDOM 接线')
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
const usedIds = new Set([...main.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]))
for (const id of usedIds) (htmlIds.has(id) ? ok(`#${id}`) : bad(`#${id} 在 index.html 中不存在`))

/* 2. 导入导出 */
console.log('\n模块对接')
const importLines = [...main.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/(\w+)\.js'/g)]
if (!importLines.length) bad('main.js 没有相对导入')
for (const [, names, mod] of importLines) {
  const ns = mod === 'sim' ? sim : mod === 'render' ? render : null
  for (const raw of names.split(',')) {
    const name = raw.trim()
    if (!name) continue
    if (ns && name in ns) ok(`${mod}.js → ${name}`)
    else bad(`${mod}.js 没有导出 ${name}`)
  }
}

/* 3. 资源 */
console.log('\n资源')
for (const ref of [...html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map((m) => m[1])) {
  const p = ref.replace(/^\.\//, '')
  existsSync(resolve(root, p)) ? ok(ref) : bad(`${ref} 缺失`)
}

/* 4. 元素覆盖：每个元素都要有名字、颜色、可选工具 */
console.log('\n元素覆盖')
const all = Object.entries(sim.E).filter(([k]) => k !== 'EMPTY')
for (const [key, id] of all) {
  const info = sim.ELEMENT_INFO[id]
  const color = render.PALETTE[id]
  if (!info || !info.name) bad(`${key} 缺少 ELEMENT_INFO`)
  else if (!color || color.length !== 3) bad(`${key} 缺少调色板`)
  else ok(`${key}（${info.name}，rgb ${color.join(',')}）`)
}

/* 5. 功能点 */
console.log('\n功能点')
const checks = [
  ['画布像素化渲染', /image-rendering:\s*pixelated/, css],
  ['工具栏动态生成', /document\.createElement\('button'\)/, main],
  ['指针落笔', /pointerdown/, main],
  ['右键擦拭', /contextmenu/, main],
  ['笔刷滑杆', /brushInput/, main],
  ['暂停 / 单步', /setPaused|step\(grid\)/, main],
  ['清空', /clearGrid/, main],
  ['四个预设按钮', /data-preset="volcano"[\s\S]*data-preset="rainforest"/, html],
  ['键盘快捷键', /keydown/, main],
  ['尺寸自适应', /relayout/, main],
  ['高 DPI 无关（1 格 1 像素）', /canvas\.width = grid\.w/, renderSrc],
  ['表面反光', /WATER_HI/, renderSrc],
  ['火焰按寿命渐变', /FIRE_HOT/, renderSrc],
]
for (const [name, re, src] of checks) {
  if (!re) bad(name + ' 检查项无效')
  else if (re.test(src)) ok(name)
  else bad(name + ' 丢失')
}

/* 6. 预设都能跑 */
console.log('\n预设冒烟')
for (const name of ['hourglass', 'volcano', 'rainforest', 'acidpool']) {
  const g = sim.preset(name, 120, 80)
  const before = sim.total(g)
  const rand = sim.mulberry(1)
  for (let i = 0; i < 90; i++) sim.step(g, rand)
  const after = sim.total(g)
  if (before > 100 && after > 0) ok(`${name}: ${before} → ${after}`)
  else bad(`${name} 异常: ${before} → ${after}`)
}

console.log(fails ? `\n${fails} 项不通过\n` : '\n全部通过\n')
process.exit(fails ? 1 : 0)
