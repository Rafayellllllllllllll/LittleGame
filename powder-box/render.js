/* 微粒沙盘 · 渲染层
 * 一个 CSS 像素 = 一格的整数倍放大，靠 image-rendering: pixelated 保持锐利。
 * 调色板带轻微噪声变化，避免大片纯色显得廉价。
 */

const PALETTE = {
  0: [7, 9, 14],        // 空
  1: [214, 176, 106],   // 沙
  2: [48, 124, 220],    // 水
  3: [92, 68, 46],      // 油
  4: [104, 112, 126],   // 石
  5: [134, 92, 56],     // 木
  6: [255, 150, 40],    // 火（会按寿命在下面改写）
  7: [86, 88, 98],      // 烟
  8: [168, 190, 205],   // 汽
  9: [92, 190, 110],    // 草
  10: [168, 224, 74],   // 酸
  11: [240, 96, 40],    // 岩浆
}

const FIRE_HOT = [255, 226, 130]
const LAVA_HOT = [255, 196, 92]
const WATER_HI = [92, 168, 240]

/** 便宜的格点哈希，给每格一点点亮度扰动 */
function vary(x, y, amt) {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return 1 - amt + (((n ^ (n >>> 16)) >>> 0) / 4294967296) * amt * 2
}

const lerp = (a, b, t) => a + (b - a) * t

export class Renderer {
  constructor(canvas, grid) {
    this.canvas = canvas
    this.gridW = grid.w
    this.gridH = grid.h
    canvas.width = grid.w
    canvas.height = grid.h
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.ctx.imageSmoothingEnabled = false

    this.buffer = document.createElement('canvas')
    this.buffer.width = grid.w
    this.buffer.height = grid.h
    this.bctx = this.buffer.getContext('2d')
    this.image = this.bctx.createImageData(grid.w, grid.h)
    this.data = this.image.data
  }

  /** 让画布铺满容器（允许非整数缩放，靠 pixelated 保持块状锐利） */
  fit(container) {
    const rect = container.getBoundingClientRect()
    const pad = 0.96
    const scale = Math.max(0.5, Math.min((rect.width / this.gridW) * pad, (rect.height / this.gridH) * pad))
    this.scale = scale
    this.canvas.style.width = Math.round(this.gridW * scale) + 'px'
    this.canvas.style.height = Math.round(this.gridH * scale) + 'px'
  }

  /** 屏幕坐标 → 网格坐标 */
  toCell(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect()
    const x = Math.floor(((clientX - r.left) / r.width) * this.gridW)
    const y = Math.floor(((clientY - r.top) / r.height) * this.gridH)
    return { x, y }
  }

  draw(g) {
    const { cells, life } = g
    const d = this.data
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        const i = y * this.gridW + x
        const t = cells[i]
        const o = i * 4
        let r
        let gg
        let b

        if (t === 0) {
          r = 7
          gg = 9
          b = 14
        } else if (t === 6) {
          // 火：寿命越短越暗，核心偏白
          const k = Math.min(1, life[i] / 70)
          r = lerp(120, FIRE_HOT[0], k)
          gg = lerp(30, FIRE_HOT[1], k)
          b = lerp(10, FIRE_HOT[2], k)
          const v = vary(x, y, 0.12)
          r *= v; gg *= v; b *= v
        } else if (t === 11) {
          const k = 0.5 + 0.5 * Math.sin(g.tick * 0.11 + x * 0.15 + y * 0.1)
          r = lerp(PALETTE[11][0], LAVA_HOT[0], k)
          gg = lerp(PALETTE[11][1], LAVA_HOT[1], k)
          b = lerp(PALETTE[11][2], LAVA_HOT[2], k)
          const v = vary(x, y, 0.1)
          r *= v; gg *= v; b *= v
        } else {
          const base = PALETTE[t] || [255, 0, 255]
          const v = vary(x, y, 0.09)
          r = base[0] * v
          gg = base[1] * v
          b = base[2] * v
          if (t === 2) {
            // 水面反光：只有底下是空的才提亮
            if (y + 1 < this.gridH && cells[(y + 1) * this.gridW + x] === 0) {
              r = lerp(r, WATER_HI[0], 0.55)
              gg = lerp(gg, WATER_HI[1], 0.55)
              b = lerp(b, WATER_HI[2], 0.55)
            }
          }
        }

        d[o] = r
        d[o + 1] = gg
        d[o + 2] = b
        d[o + 3] = 255
      }
    }
    this.bctx.putImageData(this.image, 0, 0)
    this.ctx.imageSmoothingEnabled = false
    this.ctx.drawImage(this.buffer, 0, 0)
  }
}

export { PALETTE }
