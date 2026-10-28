// 生成单文件版：把 css + js 内联进 dist/midnight-lost-found.html，
// 这个单文件可以直接用浏览器打开游玩，不需要起服务器、不需要构建工具。
const fs = require("fs"), path = require("path");
const root = __dirname;
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
html = html.replace(/<link rel="stylesheet" href="css\/style\.css[^"]*">/, "<style>\n" + css + "\n</style>");
const jsFiles = ["config.js","state.js","data.js","audio.js","ui.js","puzzles.js","board.js","dialogue.js","supabase.js","main.js"];
let js = "";
for (const f of jsFiles) js += "\n/* ==== " + f + " ==== */\n" + fs.readFileSync(path.join(root, "js", f), "utf8");
html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, "");
html = html.replace("</body>", "<script>\n" + js + "\n</script>\n</body>");
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/midnight-lost-found.html"), html);
console.log("built dist/midnight-lost-found.html", Buffer.byteLength(html), "bytes");
