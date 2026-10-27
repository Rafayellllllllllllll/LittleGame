/* 静态一致性校验：node test/verify.mjs
 * 不做渲染，只检查"接线"是否正确：
 *   1. scene.js 里 getElementById 的 id 是否都在 index.html 里
 *   2. scene.js 从 core.js 导入的名字是否都真实导出
 *   3. index.html 引用的 css/js 文件是否存在
 *   4. 关键 API 是否被用到（防止写着写着丢功能）
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as core from '../core.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

const html = read('index.html')
const scene = read('scene.js')

let fails = 0
const ok = (msg) => console.log('  ✓ ' + msg)
const bad = (msg) => { console.log('  ✗ ' + msg); fails++ }

/* 1. DOM id 接线 */
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
const usedIds = new Set([...scene.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]))
console.log(`\nDOM 接线（html ${htmlIds.size} 个 id / js 取用 ${usedIds.size} 个）`)
for (const id of usedIds) {
  if (htmlIds.has(id)) ok(`#${id} 存在`)
  else bad(`#${id} 在 index.html 里不存在`)
}

/* 2. import 名字 */
const importBlock = scene.match(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/core\.js'/)
console.log('\ncore.js 导出对接')
if (!importBlock) {
  bad('没找到从 ./core.js 的导入语句')
} else {
  const names = importBlock[1].split(',').map((s) => s.trim()).filter(Boolean)
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(core, name)) ok(`${name} 已导出`)
    else bad(`${name} 没有被 core.js 导出`)
  }
}

/* 3. 资源路径 */
console.log('\n资源引用')
const refs = [...html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map((m) => m[1])
for (const ref of refs) {
  const p = ref.replace(/^\.\//, '')
  if (existsSync(resolve(root, p))) ok(`${ref} 存在`)
  else bad(`${ref} 文件缺失`)
}

/* 4. 关键功能仍在 */
console.log('\n功能点')
const features = [
  ['加色混合（辉光）', /globalCompositeOperation = 'lighter'/],
  ['胶片颗粒', /grainPattern/],
  ['暗角', /createRadialGradient\(W \/ 2, H \/ 2/],
  ['光柱', /光柱|createLinearGradient\(x, 0/],
  ['水母脉动', /jellyPulseScale/],
  ['指针水流', /makeCurrent/],
  ['点击荧光', /state\.bursts\.push/],
  ['WebAudio 低频', /createOscillator/],
  ['暂停', /state\.paused/],
  ['减少动效偏好', /prefers-reduced-motion/],
  ['DPR 适配', /devicePixelRatio/],
]
for (const [name, re] of features) {
  if (re.test(scene)) ok(name)
  else bad(name + ' 丢了')
}

console.log(fails ? `\n${fails} 项不通过\n` : '\n全部通过\n')
process.exit(fails ? 1 : 0)
