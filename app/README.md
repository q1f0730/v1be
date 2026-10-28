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
  pages/Concept.jsx    概念页（一次一块；桌面目录 + 文件夹卡，手机翻牌）
  pages/Glossary.jsx   词汇表（搜索 + 级别 + 分页；桌面表格 / 手机卡片）
  pages/Graph.jsx      知识图谱 #/graph（懒加载）
  pages/SearchPage.jsx 全文搜索结果页 #/search（懒加载）
  pages/Plan.jsx       AI 帮我规划 #/plan（懒加载，调用浏览器内自配的 AI 接口）
  pages/Projects.jsx   我的项目 #/projects（懒加载）
  components/graph/    GraphCanvas（canvas + d3-force）、RelationMini（概念页「关系」小图，SVG）、colors
  components/search/   Hl（命中高亮 / 字段标签）、SearchFilters（范围 / 级别 / 分类筛选）
  components/plan/     RouteParts（概念卡、阶段卡、AI 配置弹窗 AiConfigDialog、加载与错误提示）
  lib/fulltext.js      全文搜索打分（懒加载模块）
  lib/planner.js       AI 接口配置管理（aig:ai）、请求调用与本地项目存储（aig:projects）
  lib/planner-core.js  学习路线规划系统提示词、JSON Schema 与输出清洗校验
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
| 首页 | `#/` | 英雄区 + 搜索（最多 8 条）、继续学习（`aig:last`）、4 个级别入口（真实进度）、今日推荐（按日期从没学的里固定挑）、总进度、词汇表入口、怎么用。**没有概念列表** |
| 级别页 | `#/l/l1` … `#/l/l4` | 顶部动画标签切换级别；分类标签一次显示一个分类（`?cat=` 记在地址里，默认第一个还有没学的分类）；每页最多 12 张（手机 8 张），分页 `?p=` |
| 概念页 | `#/c/<slug>`、`#/c/<slug>/pro` | 一次只看一块（`?s=` 记住）。桌面：左侧本页目录 + 一张文件夹卡 + 上一节/下一节；手机：翻牌一次一张 + 底栏「上一张 / 我学会了 / 下一张」；都可「全部展开」（记在 `aig:prefs.all`）。小白版 ⇄ 🎓 专业模式 分段开关（记在 `aig:prefs.pro`） |
| 词汇表 | `#/glossary` | 搜索 + 级别标签 + 分页（每页 30 条 / 手机 15 条），桌面表格、手机卡片 |
| 知识图谱 | `#/graph`（`?focus=<slug>&lv=&cat=&color=cat`） | 500 个概念的关系网；点节点出侧卡（手机底部抽屉） |
| 搜索结果 | `#/search?q=`（`&lv=&cat=&scope=easy\|pro&p=`） | 全文搜索完整结果，每页 20 条 |
| AI 帮我规划 | `#/plan` | 输入想做的项目 + 自配 AI 接口 → 生成分阶段学习路线 |
| 我的项目 | `#/projects`、`#/projects/:id` | 本地保存的学习路线进度、勾选任务、导出 Markdown、让 AI 调整 |

localStorage 与旧站兼容：`aig:done`（已学会 slug 数组）、`aig:prefs`（`fs/calm/focus/still/pro/all`）、`aig:last`（上次看到）；新增 `aig:theme`、`aig:ai`（自配 AI 接口）、`aig:projects`（我的项目）。

## AI 帮我规划（`#/plan`）与我的项目（`#/projects`）

使用者在浏览器中自行配置 AI 接口（存储在 `localStorage` 的 `aig:ai` 中，包含 `baseUrl`、`apiKey`、`model`）：
- 内置一键预设：DeepSeek、硅基流动、OpenAI、OpenRouter、Kimi (月之暗面)、智谱 GLM、Inception Mercury、本地 Ollama。
- 支持任何兼容 OpenAI `/v1/chat/completions` 的接口；密钥只保存在使用者自己的浏览器本地，由浏览器直接请求对应接口。
- 生成的学习路线包含 3–7 个阶段，每个阶段有目标、2–6 个**站内概念**（由 `planner-core.js` 严格校验，丢弃目录外或重复的 slug）、动手任务、可直接复制给 AI 编程工具的开发指令、完成标准。
