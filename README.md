# 小游戏 · LittleGame

五个纯前端小项目合集，全部**打开即玩**，不需要安装、不需要后端、不需要联网下载素材。

打开方式：用浏览器访问 `index.html`（或直接进各子目录下的 `index.html`）。

## 游戏清单

| 目录 | 项目 | 技术 | 说明 |
|---|---|---|---|
| `olio-big-jump/` | 奥利奥大胆跳 | Phaser 3 | 猫咪踩平台往上跳，带彩蛋猫与音效，支持手机触屏 |
| `gesture-flower/` | 手势粒子花朵 | Three.js + MediaPipe Hands + GLSL | 摄像头识别手势，控制粒子花朵绽放 |
| `big-blue-fish/` | 蓝色大肥鱼 | Canvas 2D | 吃小鱼长大的小游戏 |
| `powder-box/` | 微粒沙盘 | Canvas 2D | 沙、水、油、火、蒸汽、植物、酸、岩浆互相反应的物理沙盘 |
| `abyssal-observatory/` | 深海观测站 | Canvas 2D | 程序化生成的深海场景：浮游生物、水母、海雪、光柱 |

## 本地预览

大多数项目用的是 ES Module，必须通过 HTTP 访问，直接双击 `index.html`（`file://`）会被浏览器的 CORS 规则拦掉。在仓库根目录跑一个静态服务器即可：

```bash
# 任意选一种
python -m http.server 8080
npx serve -l 8080
```

然后打开 <http://localhost:8080/>。

## 部署

整个目录是纯静态文件，可以原样上传到 GitHub Pages、Netlify、Vercel、Cloudflare Pages 或任意对象存储。

## 说明

- 各子目录保持原项目结构，没有改动源码。
- `gesture-flower/` 需要摄像头权限；`vendor/` 里是本地化的 Three.js 与 MediaPipe 资源，不要删除。
- `olio-big-jump/assets/` 约 36MB，是游戏美术与音频素材。
