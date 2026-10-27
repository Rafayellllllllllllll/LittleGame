/* 核心模拟的自动测试：node test/core.test.mjs
 * 只测纯逻辑（不碰浏览器），保证"算得对"。
 */
import assert from 'node:assert/strict'
import {
  mulberry32, hash2, noise2, fbm2, flowAt,
  createPlankton, stepPlankton, createJellies, stepJellies, jellyPulseScale,
  createSnow, stepSnow, makeCurrent, decayCurrent, stats,
} from '../core.js'

let passed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (err) {
    failures.push({ name, err })
    console.log('  ✗ ' + name + '\n      ' + (err && err.message))
  }
}

const W = 1280
const H = 800

console.log('\n噪声与随机')

test('mulberry32 同种子同序列', () => {
  const a = mulberry32(42)
  const b = mulberry32(42)
  const seqA = [a(), a(), a(), a(), a()]
  const seqB = [b(), b(), b(), b(), b()]
  assert.deepEqual(seqA, seqB)
  assert.ok(seqA.every((v) => v >= 0 && v < 1))
})

test('mulberry32 不同种子不同序列', () => {
  const a = mulberry32(1)()
  const b = mulberry32(2)()
  assert.notEqual(a, b)
})

test('hash2 稳定且落在 [0,1)', () => {
  assert.equal(hash2(3, -7, 5), hash2(3, -7, 5))
  for (let x = -20; x < 20; x++) {
    for (let y = -20; y < 20; y++) {
      const v = hash2(x, y, 9)
      assert.ok(v >= 0 && v < 1, `hash2 越界: ${v}`)
    }
  }
})

test('noise2 连续、确定、范围 [0,1]', () => {
  let prev = noise2(0, 0, 3)
  for (let i = 0; i <= 200; i++) {
    const x = i * 0.137
    const v = noise2(x, 1.7, 3)
    assert.ok(v >= 0 && v <= 1, `noise2 越界: ${v}`)
    assert.ok(Math.abs(v - prev) < 0.6, '噪声出现跳变，插值可能有问题')
    prev = v
  }
  assert.equal(noise2(12.34, 56.78, 3), noise2(12.34, 56.78, 3))
})

test('fbm2 在 [0,1] 且权重和为 1', () => {
  for (let i = 0; i < 300; i++) {
    const v = fbm2(i * 0.11, i * 0.07, 7)
    assert.ok(v >= 0 && v <= 1, `fbm2 越界: ${v}`)
  }
  const far = fbm2(1e6, 1e6, 7)
  assert.ok(Number.isFinite(far))
})

console.log('\n流场')

test('flowAt 恒为有限值，幅度合理', () => {
  for (let i = 0; i < 500; i++) {
    const f = flowAt((i * 37) % W, (i * 91) % H, i * 0.05)
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y))
    const mag = Math.hypot(f.x, f.y)
    assert.ok(mag < 2.2, `流场过强: ${mag}`)
  }
})

test('流场随时间变化（不是静态噪声）', () => {
  const a = flowAt(400, 300, 0)
  const b = flowAt(400, 300, 12)
  assert.ok(Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6)
})

console.log('\n浮游生物')

test('长时间演化不产生 NaN，且始终留在边界内', () => {
  const rng = mulberry32(7)
  const list = createPlankton(400, W, H, rng)
  const current = makeCurrent(W / 2, H / 2)
  for (let i = 0; i < 1200; i++) {
    stepPlankton(list, 1 / 60, i / 60, W, H, current)
    decayCurrent(current, 1 / 60)
  }
  for (const p of list) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), '出现 NaN')
    assert.ok(p.x >= -25 && p.x <= W + 25, `x 越界: ${p.x}`)
    assert.ok(p.y >= -25 && p.y <= H + 25, `y 越界: ${p.y}`)
  }
})

test('水流会把浮游生物推开（不会吸成一点）', () => {
  const rng = mulberry32(11)
  const list = createPlankton(300, W, H, rng)
  const before = list.map((p) => Math.hypot(p.x - W / 2, p.y - H / 2))
  const current = makeCurrent(W / 2, H / 2, 400000)
  for (let i = 0; i < 240; i++) {
    stepPlankton(list, 1 / 60, i / 60, W, H, current)
    decayCurrent(current, 1 / 60)
  }
  const after = list.map((p) => Math.hypot(p.x - W / 2, p.y - H / 2))
  const meanBefore = before.reduce((a, b) => a + b, 0) / before.length
  const meanAfter = after.reduce((a, b) => a + b, 0) / after.length
  assert.ok(meanAfter > meanBefore, '水流方向反了')
})

console.log('\n水母')

test('水母上浮并有边界回收，无 NaN', () => {
  const rng = mulberry32(3)
  const list = createJellies(12, W, H, rng)
  const startY = list.map((j) => j.y)
  for (let i = 0; i < 900; i++) stepJellies(list, 1 / 60, i / 60, W, H)
  list.forEach((j, i) => {
    assert.ok(Number.isFinite(j.x) && Number.isFinite(j.y))
    assert.ok(j.y >= -j.r * 3 && j.y <= H + j.r * 3, `y 越界: ${j.y}`)
  })
  const climbed = list.filter((j, i) => j.y < startY[i]).length
  assert.ok(climbed >= list.length - 1, '水母没有整体上浮')
})

test('伞体脉动系数在 0.86~1.14', () => {
  const j = { phase: 0 }
  for (let i = 0; i < 100; i++) {
    j.phase = i * 0.3
    const s = jellyPulseScale(j, i)
    assert.ok(s >= 0.859 && s <= 1.141, `脉动越界: ${s}`)
  }
})

console.log('\n海雪与统计')

test('海雪只在纵向循环，不横向跑飞', () => {
  const rng = mulberry32(5)
  const list = createSnow(200, W, H, rng)
  for (let i = 0; i < 1500; i++) stepSnow(list, 1 / 60, i / 60, W, H)
  for (const s of list) {
    assert.ok(s.y >= -9 && s.y <= H + 10, `y 越界: ${s.y}`)
    assert.ok(s.x >= -9 && s.x <= W + 9, `x 越界: ${s.x}`)
  }
})

test('水流生命周期单调衰减并归零', () => {
  const c = makeCurrent(10, 10)
  const s0 = c.strength
  decayCurrent(c, 0.5)
  assert.ok(c.strength < s0)
  for (let i = 0; i < 100; i++) decayCurrent(c, 0.2)
  assert.equal(c.life, 0)
})

test('stats 汇总正确', () => {
  const rng = mulberry32(1)
  const p = createPlankton(10, W, H, rng)
  const j = createJellies(3, W, H, rng)
  const s = createSnow(5, W, H, rng)
  const out = stats({ plankton: p, jellies: j, snow: s })
  assert.equal(out.plankton, 10)
  assert.equal(out.jellies, 3)
  assert.equal(out.snow, 5)
  assert.ok(out.biolume > 0)
})

console.log(`\n${passed} 项通过, ${failures.length} 项失败\n`)
if (failures.length) process.exit(1)
