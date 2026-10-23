# 🧭 AI 造物指南

> 310 个概念，一个概念一页。初级 🌱 → 中级 🌊 → 高级 🔮 → 进阶 🔥。
> 每页 2 分钟：一句话 → 生活比喻 → 动画 → 表格 → 怎么做 → 翻车现场 → 复制给 AI 的话 → 小测验。

## 为 ADHD / 阅读障碍设计
- 每句 ≤ 20 字，一块只讲一件事，emoji 当路标
- 🔊 朗读（浏览器自带中文语音）
- ⚙️ 阅读设置（右上角）：🫧 宽松阅读、🔦 专注模式、⏸️ 暂停动画、A- / A+ 调字号
- 📱 手机上概念页默认「一张一张看」，底栏翻卡，也能左右滑
- ✅ 学会打卡，进度存在本地浏览器

## 目录
- `data/out/*.json` 全部概念内容（改内容就改这里）
- `data/SPEC.md` 内容写作规范
- `src/build.py` 生成器（零依赖 Python 3）
- `src/assets/` 样式与交互
- `site/` 生成好的静态网站（直接打开 `site/index.html`）
  - `index.html` 首页仪表盘 · `l/l1–l4.html` 级别页（按分类切换）· `c/<slug>.html` 概念页 · `glossary.html` 词汇表

## 重新生成
```bash
python3 src/build.py
python3 -m http.server 8000 -d site
```

内容基于原《Vibe Coding 架构通关百科》198 个概念扩充改写，新增 112 个 AI 开发与电脑基础概念。

## 新版应用（app/）

`app/` 是基于 Rewamp UI 重做的新版（React 19 + Vite + Tailwind 4）：分级浏览、知识图谱（`#/graph`）、全文搜索（支持拼音/首字母，`#/search`）、AI 帮我规划学习路线（Mercury 3，`#/plan`）和「我的项目」（`#/projects`）。

```bash
cd app && npm install && npm run build   # 构建时从 ../data 生成 public/data
```

AI 规划后端是 `app/worker/` 里的 Cloudflare Worker，密钥只在 Cloudflare 控制台配置，不在仓库里。详见 `app/README.md`。
