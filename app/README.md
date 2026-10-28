# AI 造物指南 · Rewamp UI 重做版

把「AI 造物指南」（500 个 AI 开发概念，小白版 + 🎓 专业模式）用 React 重新做了一遍界面。
内容数据来自仓库根目录的 `../data`，这里只换界面，不改内容。

- 技术栈：Vite 7 + React 19 + Tailwind CSS 4（`@tailwindcss/vite`）+ framer-motion + lucide-react + react-router（HashRouter）
- 纯前端项目，`vite base: './'`，不含任何后端部署绑定，使用者可自行在本地运行或选择任意静态方式托管
- 作者署名：Q1f730

## 命令

```bash
npm install
npm run prep        # 生成数据：../data → public/data（index.json / c/*.json），派生 graph.json + search.json，以及 src/lib/catalog.js
npm run dev         # 本地开发
npm run build       # = prep + vite build，产物在 dist/
npm run check:data  # 校验 500 个概念 JSON 全部可加载、字段完整
```

> `public/data` 是生成物，已加入 `.gitignore`；构建时读取 `../data`（或设置环境变量 `GUIDE_DATA` 指向数据目录）。

## 目录

```
scripts/
  prep-data.mjs        读 ../data → public/data/index.json（轻量索引）+ public/data/c/<slug>.json（单个概念，按需加载）
  prep-derived.mjs     读 public/data → graph.json（关系图 + 预计算布局）+ search.json（全文索引 + 拼音），都懒加载
  prep-catalog.mjs     读 public/data/index.json → src/lib/catalog.js（AI 路线规划使用的 500 概念目录）
  check-data.mjs       数据完整性校验（500 个全部 fetch 一遍）
src/
  App.jsx              外壳：路由、桌面导航坞、手机顶栏 / 底部导航、阅读设置面板、全站搜索浮层、快捷键
  pages/Home.jsx       首页（不放概念列表）
  pages/Level.jsx      级别页（一次一个级别、一个分类、一页 12 张）
  pages/Concept.jsx    概念页（一次一块；带 ?proj=<id> 时激活项目伴学横幅与路线翻页）
  pages/Glossary.jsx   词汇表（搜索 + 级别 + 分页；桌面表格 / 手机卡片）
  pages/Graph.jsx      知识图谱 #/graph（懒加载）
  pages/SearchPage.jsx 全文搜索结果页 #/search（懒加载）
  pages/Plan.jsx       实战路线库 + AI 帮我规划 #/plan（懒加载）
  pages/Projects.jsx   我的项目 #/projects（懒加载，阶段任务打卡与伴学入口）
  components/graph/    GraphCanvas（canvas + d3-force）、RelationMini（概念页「关系」小图，SVG）、colors
  components/search/   Hl（命中高亮 / 字段标签）、SearchFilters（范围 / 级别 / 分类筛选）
  components/plan/     RouteParts（概念卡、阶段卡、精选路线网格 TemplateGrid、AI 配置弹窗 AiConfigDialog）
  lib/fulltext.js      全文搜索打分（懒加载模块）
  lib/templates.js     内置 6 条零配置精选实战路线（全部关联站内真实概念）
  lib/planner.js       AI 接口配置（aig:ai）、请求调用、本地项目存储（aig:projects）与项目伴学计算
  lib/planner-core.js  学习路线规划系统提示词、JSON Schema 与输出清洗校验（仅发起 AI 请求时按需加载）
  lib/catalog.js       自动生成的 500 个概念目录与级别映射
  components/Anim.jsx      15 种动画，逐行对照 build.py 的 anim_html() 移植
  components/Sections.jsx  小白版 9 块 + 专业版 10 块的内容渲染、朗读文本
  components/rw/           从 Rewamp UI 复制并改造的组件
  lib/store.js         localStorage（与旧站兼容）
  lib/data.js          数据加载 / 缓存 / 搜索 / 今日推荐 / 随机
  lib/fx.js            撒花、复制、朗读（speechSynthesis zh-CN）
  styles/anim.css      动画 CSS：原样复制自 src/assets/style.css 的 .sc* 与 keyframes
```

## 信息架构（解决「一页塞太多、全部展开太长」）

| 页面 | 地址 | 一屏只放什么 |
|---|---|---|
| 首页 | `#/` | 英雄区 + 搜索（最多 8 条）、继续学习（`aig:last`）、4 个级别入口（真实进度）、实战路线 & AI 规划入口、知识图谱入口、今日推荐、总进度、词汇表入口、怎么用。**没有概念列表** |
| 级别页 | `#/l/l1` … `#/l/l4` | 顶部动画标签切换级别；分类标签一次显示一个分类（`?cat=` 记在地址里，默认第一个还有没学的分类）；每页最多 12 张（手机 8 张），分页 `?p=` |
| 概念页 | `#/c/<slug>`、`#/c/<slug>/pro`（可选 `?proj=<id>`） | 一次只看一块（`?s=` 记住）。桌面：左侧本页目录 + 一张文件夹卡 + 上一节/下一节；手机：翻牌一次一张 + 底栏；都可「全部展开」。带 `?proj=<id>` 时激活**项目伴学模式**：顶部显示当前项目/阶段与概念胶囊条，上下概念按项目路线顺序切换，本阶段概念全学完自动弹出动手任务引导 |
| 词汇表 | `#/glossary` | 搜索 + 级别标签 + 分页（每页 30 条 / 手机 15 条），桌面表格、手机卡片 |
| 知识图谱 | `#/graph`（`?focus=<slug>&lv=&cat=&color=cat`） | 500 个概念的关系网；点节点出侧卡（手机底部抽屉） |
| 搜索结果 | `#/search?q=`（`&lv=&cat=&scope=easy\|pro&p=`） | 全文搜索完整结果，每页 20 条 |
| 实战路线 / AI 规划 | `#/plan` | 6 条零配置精选实战路线一键开练/预览 + 自配 AI 接口定制分阶段学习路线 |
| 我的项目 | `#/projects`、`#/projects/:id` | 本地保存的学习路线进度、一键进入概念伴学、勾选阶段动手任务、导出 Markdown、让 AI 调整 |

localStorage 与旧站兼容：`aig:done`（已学会 slug 数组）、`aig:prefs`（`fs/calm/focus/still/pro/all`）、`aig:last`（上次看到）；新增 `aig:theme`、`aig:ai`（自配 AI 接口）、`aig:projects`（我的项目）。

## 精选实战路线、AI 规划与项目伴学闭环

1. **内置 6 条零配置精选实战路线（`src/lib/templates.js`）**
   - 无需任何 API Key，在 `#/plan` 或 `#/projects` 即可一键预览或创建：个人作品集网站、极简记账 Web 应用、AI 每日资讯简报工作流、AI 自动整理 Excel 工具、个人知识库 RAG 问答助手、全栈 SaaS 小工具（登录+看板+部署）。
2. **项目伴学闭环（`?proj=<id>`）**
   - 从项目详情页点击「进入伴学」或任意阶段概念，进入概念页后顶部常驻**项目伴学横幅**（显示项目名、阶段序号、当前阶段全部概念胶囊与已学状态）。
   - 概念页的「上一个 / 下一个」自动切换为**当前项目路线顺序**；点进路线外的扩展概念时显示「伴学支线」提示并可一键回到主线。
   - 当本阶段概念全部打卡「我学会了」后，自动弹出阶段里程碑卡片，引导返回项目完成动手任务并复制给 AI 编程工具的提示词。
3. **自配 AI 接口定制路线（BYOK）**
   - 使用者在浏览器中自行配置 AI 接口（存储在 `localStorage` 的 `aig:ai` 中，包含 `baseUrl`、`apiKey`、`model`），支持 DeepSeek、硅基流动、OpenAI、OpenRouter、Kimi、智谱 GLM、Inception Mercury、本地 Ollama 等任意兼容 OpenAI `/v1/chat/completions` 的接口。
   - `planner-core.js` 与 500 概念提示词目录（`catalog.js`）仅在真正发起自定义 AI 规划请求时按需懒加载，不影响首屏体积。
