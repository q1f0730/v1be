# 🧭 AI 造物指南

> 500 个概念（小白版 + 🎓 专业模式），一个概念一页。初级 🌱 → 中级 🌊 → 高级 🔮 → 进阶 🔥。
> 每页 2 分钟：一句话 → 生活比喻 → 动画 → 表格 → 怎么做 → 翻车现场 → 复制给 AI 的话 → 小测验。

## 为 ADHD / 阅读障碍设计
- 每句 ≤ 20 字，一块只讲一件事，emoji 当路标
- 🔊 朗读（浏览器自带中文语音）
- ⚙️ 阅读设置（右上角）：🫧 宽松阅读、🔦 专注模式、⏸️ 暂停动画、A- / A+ 调字号
- 📱 手机上概念页默认「一张一张看」，底栏翻卡，也能左右滑
- ✅ 学会打卡，进度存在本地浏览器

## 目录
- `data/out/*.json` 全部小白版概念内容（改内容就改这里）
- `data/pro/*.json` 全部专业模式内容
- `data/SPEC.md` / `data/PRO_SPEC.md` 内容写作规范
- `src/build.py` 静态站生成器（零依赖 Python 3）
- `src/assets/` 样式与交互
- `site/` 生成好的静态网站（直接打开 `site/index.html`）
  - `index.html` 首页仪表盘 · `l/l1–l4.html` 级别页（按分类切换）· `c/<slug>.html` 概念页 · `glossary.html` 词汇表

## 重新生成静态站
```bash
python3 src/build.py
python3 -m http.server 8000 -d site
```

## 新版应用（`app/`）

`app/` 是基于 Rewamp UI 重做的新版纯前端应用（React 19 + Vite + Tailwind 4）：分级浏览、知识图谱（`#/graph`）、全文搜索（支持拼音/首字母，`#/search`）、实战路线与 AI 规划（`#/plan`）、「我的项目」与概念页伴学闭环（`#/projects`）。

```bash
cd app
npm install
npm run dev     # 本地开发（先运行 npm run prep 生成数据）
npm run build   # 构建产物在 app/dist/，使用者可自行选择任意静态方式托管或本地运行
```

**精选实战路线 & AI 定制规划**：
- **零配置即点即学**：内置 6 条精选实战路线（个人作品集上线、极简记账应用、AI 日报工作流、Excel 自动清洗工具、RAG 知识库助手、全栈 SaaS 看板），无需填写任何 API Key 即可一键创建项目并进入**项目伴学模式**（概念页按路线顺序切换、阶段学完自动引导动手任务）。
- **自配 AI 定制路线**：本项目不包含任何后端部署或内置密钥。如需定制任意项目想法，在 `#/plan` 点击「**配置 AI 接口**」，填入你自己的 OpenAI 兼容接口（支持 DeepSeek、硅基流动、OpenAI、OpenRouter、Kimi、智谱 GLM、Inception Mercury 或本地 Ollama）。接口密钥与项目进度仅保存在当前浏览器的 `localStorage` 中。详见 `app/README.md`。
