/* 模拟内核测试：node test/sim.test.mjs
 * 目标是验证"物理规则"本身：守恒、边界、反应、浮沉、确定性。
 */
import {
  E, createGrid, paint, clearGrid, step, count, total, hash, meanY, preset, mulberry, idx, inBounds,
} from '../sim.js'

let passed = 0
const failures = []
function test(name, fn) {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (err) {
    failures.push(name)
    console.log('  ✗ ' + name + '\n      ' + (err && err.message))
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || '断言失败') }
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg || '不相等'}: ${a} !== ${b}`) }

const W = 80
const H = 60

function boxed(w = W, h = H) {
  const g = createGrid(w, h)
  for (let x = 0; x < w; x++) { paint(g, x, h - 1, 0, E.STONE) }
  for (let y = 0; y < h; y++) { paint(g, 0, y, 0, E.STONE); paint(g, w - 1, y, 0, E.STONE) }
  return g
}

function run(g, n, seed = 7) {
  const rand = mulberry(seed)
  for (let i = 0; i < n; i++) step(g, rand)
  return g
}

console.log('\n基础')

test('网格初始化：尺寸正确、全空', () => {
  const g = createGrid(10, 8)
  eq(g.cells.length, 80)
  eq(total(g), 0)
  eq(g.tick, 0)
})

test('paint 画圆：半径 0 只涂一格，半径 2 涂 13 格', () => {
  const g = createGrid(20, 20)
  paint(g, 10, 10, 0, E.SAND)
  eq(total(g), 1)
  paint(g, 13, 13, 2, E.SAND)
  const r2 = []
  for (let y = 11; y <= 15; y++) for (let x = 11; x <= 15; x++) if (g.cells[idx(g, x, y)] === E.SAND) r2.push(1)
  assert(r2.length === 13, `半径 2 内格数应为 13，实际 ${r2.length}`)
})

test('clearGrid 清空并重置 tick', () => {
  const g = createGrid(10, 10)
  paint(g, 5, 5, 3, E.SAND)
  run(g, 5)
  clearGrid(g)
  eq(total(g), 0)
  eq(g.tick, 0)
})

console.log('\n粉末')

test('单粒沙下落到底部', () => {
  const g = boxed(20, 20)
  paint(g, 10, 0, 0, E.SAND)
  run(g, 80)
  const y = Math.floor(g.cells.indexOf(E.SAND) / g.w)
  eq(y, 18, `沙应落到底部上一格（18），实际 ${y}`)
})

test('沙的数量守恒（400 步不增不减）', () => {
  const g = boxed()
  const rand = mulberry(3)
  for (let i = 0; i < 300; i++) paint(g, 5 + ((rand() * (W - 10)) | 0), ((rand() * H * 0.5) | 0), 1, E.SAND)
  const before = count(g).SAND
  run(g, 400)
  eq(count(g).SAND, before, '沙粒数量应当守恒')
})

test('沙会堆成锥形而不是穿透底面', () => {
  const g = boxed(60, 40)
  for (let i = 0; i < 400; i++) paint(g, 30, 2, 1, E.SAND)
  run(g, 500)
  const col = (x) => {
    let n = 0
    for (let y = 0; y < g.h; y++) if (g.cells[idx(g, x, y)] === E.SAND) n++
    return n
  }
  assert(col(30) > col(34), '中心应比旁边高，形成锥形')
  eq(g.cells[idx(g, 30, g.h - 1)], E.STONE, '底面石头不应被穿透')
})

console.log('\n液体')

test('水守恒且会摊平（水位拉平）', () => {
  const g = boxed(80, 40)
  const rand = mulberry(11)
  for (let i = 0; i < 900; i++) paint(g, 8 + ((rand() * 20) | 0), 10 + ((rand() * 25) | 0), 1, E.WATER)
  const before = count(g).WATER
  const colHeights = () => {
    const hs = []
    for (let x = 1; x < g.w - 1; x++) {
      let n = 0
      for (let y = 0; y < g.h - 1; y++) if (g.cells[idx(g, x, y)] === E.WATER) n++
      hs.push(n)
    }
    return hs
  }
  const spreadBefore = colHeights().filter((v) => v > 0).length
  run(g, 700)
  const hs = colHeights()
  const spreadAfter = hs.filter((v) => v > 0).length
  eq(count(g).WATER, before, '水应当守恒')
  assert(spreadAfter > spreadBefore + 10, `水应横向摊开: ${spreadBefore} → ${spreadAfter}`)
  const max = Math.max(...hs)
  assert(max < 34, `水面应下降，最高水柱仍为 ${max}`)
})

test('油浮在水上面', () => {
  const g = boxed(60, 40)
  for (let x = 1; x < g.w - 1; x++) {
    for (let y = 25; y < 39; y++) paint(g, x, y, 0, E.WATER)
    for (let y = 15; y < 25; y++) paint(g, x, y, 0, E.OIL)
  }
  run(g, 500)
  const oilY = meanY(g, E.OIL)
  const waterY = meanY(g, E.WATER)
  assert(Number.isFinite(oilY) && Number.isFinite(waterY))
  assert(oilY < waterY, `油应在上层: oil=${oilY.toFixed(1)} water=${waterY.toFixed(1)}`)
})

test('石头完全静止', () => {
  const g = boxed(30, 30)
  paint(g, 15, 5, 3, E.STONE)
  const before = hash(g)
  run(g, 60)
  eq(hash(g), before, '石头不应移动')
})

console.log('\n火与气体')

test('火烧木头：木减少、火最终熄灭', () => {
  const g = boxed(60, 40)
  for (let x = 10; x < 50; x++) for (let y = 30; y < 36; y++) paint(g, x, y, 0, E.WOOD)
  paint(g, 30, 28, 1, E.FIRE, 40)
  const woodBefore = count(g).WOOD
  run(g, 600)
  const after = count(g)
  assert(after.WOOD < woodBefore, `木头应被烧掉: ${woodBefore} → ${after.WOOD}`)
  eq(after.FIRE, 0, '火最终应全部熄灭')
})

test('水能灭火并产生蒸汽，火最终全灭', () => {
  const g = boxed(40, 30)
  for (let x = 10; x < 30; x++) for (let y = 20; y < 28; y++) paint(g, x, y, 0, E.WATER)
  paint(g, 20, 19, 1, E.FIRE, 60) // 火直接贴在水面上，才可能相邻
  const fireBefore = count(g).FIRE
  run(g, 30)
  assert(count(g).STEAM > 0, '应当出现蒸汽')
  assert(count(g).FIRE < fireBefore, '接触水的火应被浇灭一部分')
  run(g, 400)
  eq(count(g).FIRE, 0, '火最终应全部熄灭（燃料烧尽或寿命到期）')
})

test('蒸汽最终冷凝回水，数量不凭空增加', () => {
  const g = boxed(40, 30)
  for (let x = 12; x < 20; x++) paint(g, x, 25, 0, E.WATER)
  const waterBefore = count(g).WATER
  run(g, 500)
  eq(count(g).STEAM, 0, '蒸汽应已冷凝')
  eq(count(g).WATER, waterBefore, '水量应守恒')
})

test('烟会上升并消失', () => {
  const g = createGrid(30, 40)
  paint(g, 15, 30, 1, E.SMOKE, 60)
  const y0 = meanY(g, E.SMOKE)
  run(g, 20)
  const y1 = meanY(g, E.SMOKE)
  assert(y1 < y0, `烟应上升: ${y0} → ${y1}`)
  run(g, 200)
  eq(count(g).SMOKE, 0, '烟应最终消散')
})

console.log('\n化学反应')

test('岩浆遇水：生成石头与蒸汽，水减少', () => {
  const g = boxed(40, 30)
  for (let x = 10; x < 30; x++) for (let y = 24; y < 29; y++) paint(g, x, y, 0, E.WATER)
  paint(g, 20, 22, 1, E.LAVA)
  const stoneBefore = count(g).STONE
  const waterBefore = count(g).WATER
  run(g, 20)
  const after = count(g)
  assert(after.STONE > stoneBefore, '应凝固出石头')
  assert(after.STEAM > 0, '应产生蒸汽')
  assert(after.WATER < waterBefore, '水应被消耗')
})

test('酸腐蚀石头，自身也被消耗', () => {
  const g = boxed(40, 30)
  for (let x = 12; x < 28; x++) for (let y = 24; y < 29; y++) paint(g, x, y, 0, E.STONE)
  const stoneBefore = count(g).STONE
  const acidBefore = 9
  paint(g, 20, 20, 2, E.ACID)
  run(g, 400)
  const after = count(g)
  assert(after.STONE < stoneBefore, `石头应被腐蚀: ${stoneBefore} → ${after.STONE}`)
  assert(after.ACID < acidBefore, `酸应被消耗: ${acidBefore} → ${after.ACID}`)
})

test('草消耗水生长', () => {
  const g = boxed(50, 40)
  for (let x = 10; x < 40; x++) for (let y = 34; y < 39; y++) paint(g, x, y, 0, E.WATER)
  paint(g, 25, 33, 1, E.PLANT)
  const waterBefore = count(g).WATER
  const plantBefore = count(g).PLANT
  run(g, 400)
  const after = count(g)
  assert(after.PLANT > plantBefore, `草应生长: ${plantBefore} → ${after.PLANT}`)
  assert(after.WATER < waterBefore, '生长应消耗水')
})

console.log('\n健壮性')

test('全元素混战后没有非法值，总数不变', () => {
  const g = boxed(70, 50)
  const rand = mulberry(99)
  const types = Object.values(E).filter((t) => t !== E.EMPTY)
  for (let i = 0; i < 500; i++) {
    paint(g, (rand() * 70) | 0, (rand() * 40) | 0, (rand() * 3) | 0, types[(rand() * types.length) | 0], 60)
  }
  const before = total(g)
  run(g, 300, 5)
  for (let i = 0; i < g.cells.length; i++) {
    assert(g.cells[i] <= E.LAVA, `出现非法元素 ${g.cells[i]} @${i}`)
  }
  // 火/烟/汽 会发生相变导致总数变化，这里只要求不炸、不越界
  assert(total(g) > 0 && total(g) <= before, `总数异常: ${before} → ${total(g)}`)
})

test('空网格不会凭空产生粒子', () => {
  const g = createGrid(40, 30)
  run(g, 200)
  eq(total(g), 0)
})

test('确定性：同种子同起点 → 同结果', () => {
  const build = () => {
    const g = boxed(50, 40)
    const rand = mulberry(21)
    for (let i = 0; i < 200; i++) paint(g, (rand() * 50) | 0, (rand() * 30) | 0, 1, E.SAND)
    for (let i = 0; i < 200; i++) paint(g, (rand() * 50) | 0, (rand() * 30) | 0, 1, E.WATER)
    return g
  }
  const a = run(build(), 200, 33)
  const b = run(build(), 200, 33)
  eq(hash(a), hash(b), '相同种子下结果应完全一致')
})

test('tick 随帧推进', () => {
  const g = createGrid(10, 10)
  run(g, 25)
  eq(g.tick, 25)
})

test('性能：200x120 网格跑 300 帧 < 3s', () => {
  const g = createGrid(200, 120)
  const rand = mulberry(2)
  for (let i = 0; i < 3000; i++) paint(g, (rand() * 200) | 0, (rand() * 120) | 0, 2, E.SAND)
  for (let i = 0; i < 2000; i++) paint(g, (rand() * 200) | 0, (rand() * 120) | 0, 2, E.WATER)
  const t0 = Date.now()
  run(g, 300, 4)
  const ms = Date.now() - t0
  assert(ms < 3000, `太慢: ${ms}ms`)
  console.log(`      （300 帧耗时 ${ms}ms，约 ${(300 / ms * 1000).toFixed(0)} fps）`)
})

console.log('\n预设')

test('四个预设都能生成且非空', () => {
  for (const name of ['hourglass', 'volcano', 'rainforest', 'acidpool']) {
    const g = preset(name, 120, 80)
    assert(total(g) > 100, `${name} 粒子太少: ${total(g)}`)
    run(g, 60, 9)
    assert(total(g) > 0, `${name} 跑完变空了`)
  }
})

test('预设可复现', () => {
  eq(hash(preset('volcano', 100, 70)), hash(preset('volcano', 100, 70)))
})

console.log(`\n${passed} 项通过, ${failures.length} 项失败\n`)
if (failures.length) process.exit(1)
