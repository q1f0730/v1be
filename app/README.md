# AI 造物指南 · Rewamp UI 重做版

把「AI 造物指南」（500 个 AI 开发概念，小白版 + 🎓 专业模式）用 React 重新做了一遍界面。
内容数据完全来自原站 `../guide/data`，这里只换界面，不改内容；原站（`../guide`）保持不动。

- 技术栈：Vite 7 + React 19 + Tailwind CSS 4（`@tailwindcss/vite`）+ framer-motion + lucide-react + react-router（HashRouter）
- 静态托管即可，`vite base: './'`，放在任何子路径下都能用
- 作者署名：Q1f730

## 命令

```bash
npm install
npm run prep        # 只生成数据：../guide/data → public/data（index.json / c/*.json），再派生 graph.json + search.json
npm run dev         # 本地开发
npm run build       # = prep + vite build，产物在 dist/
npm run check:data  # 校验 500 个概念 JSON 全部可加载、字段完整（也可传线上地址：node scripts/check-data.mjs https://…/）
```

端到端检查 + 截图（需要 Chromium）：

```bash
uv run --with playwright python scripts/e2e-shots.py    http://127.0.0.1:3001/ /tmp/rw-shots   # 原有功能（42 项）
uv run --with playwright python scripts/e2e-features.py http://127.0.0.1:3001/ /tmp/rw-v2      # 知识图谱 + 全文搜索（85 项）
```

> `public/data` 是生成物，已加入 `.gitignore`；构建时需要旁边有 `../guide/data`（或设置环境变量 `GUIDE_DATA` 指向数据目录）。

## 目录

```
scripts/
  prep-data.mjs        读 ../guide/data → public/data/index.json（轻量索引）+ public/data/c/<slug>.json（单个概念，按需加载）
  prep-derived.mjs     读 public/data → graph.json（关系图 + 预计算布局）+ search.json（全文索引 + 拼音），都懒加载
  e2e-features.py      Playwright：图谱 / 关系小图 / 全文搜索 / 结果页 + 截图 + 性能自检
  check-data.mjs       数据完整性校验（500 个全部 fetch 一遍）
  e2e-shots.py         Playwright：无报错检查、横向溢出检查、按钮点测、截图
src/
  App.jsx              外壳：路由、桌面导航坞、手机顶栏 / 底部导航、阅读设置面板、全站搜索浮层、快捷键
  pages/Home.jsx       首页（不放概念列表）
  pages/Level.jsx      级别页（一次一个级别、一个分类、一页 12 张）
  pages/Concept.jsx    概念页（一次一块；桌面目录 + 文件夹卡，手机翻牌）
  pages/Glossary.jsx   词汇表（搜索 + 级别 + 分页；桌面表格 / 手机卡片）
  pages/Graph.jsx      知识图谱 #/graph（懒加载）
  pages/SearchPage.jsx 全文搜索结果页 #/search（懒加载）
  components/graph/    GraphCanvas（canvas + d3-force）、RelationMini（概念页「关系」小图，SVG）、colors
  components/search/   Hl（命中高亮 / 字段标签）、SearchFilters（范围 / 级别 / 分类筛选）
  lib/fulltext.js      全文搜索打分（懒加载模块）
  components/Anim.jsx      15 种动画，逐行对照 build.py 的 anim_html() 移植
  components/Sections.jsx  小白版 9 块 + 专业版 10 块的内容渲染、朗读文本
  components/rw/           从 Rewamp UI 复制并改造的组件（见下表）
  lib/store.js         localStorage（与旧站兼容）
  lib/data.js          数据加载 / 缓存 / 搜索 / 今日推荐 / 随机
  lib/fx.js            撒花、复制、朗读（speechSynthesis zh-CN）
  styles/anim.css      动画 CSS：原样复制自 guide/src/assets/style.css 的 .sc* 与 keyframes
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

保留的功能：搜索（`/` 键）、随机一个没学过的、朗读（speechSynthesis zh-CN）、测验反馈、一键复制给 AI 的话、复制代码、我学会了、进度、阅读设置（字号 / 宽松阅读 / 专注模式 / 暂停动画）、`prefers-reduced-motion`（没设置过时默认定格）、键盘 ← →。新增：深色模式。

localStorage 与旧站兼容：`aig:done`（已学会 slug 数组）、`aig:prefs`（`fs/calm/focus/still/pro/all`）、`aig:last`（上次看到）；新增 `aig:theme`。

## 用到的 Rewamp UI 组件（源码已复制进 `src/components/rw/`，可自由修改）

| 本项目文件 | Rewamp 原文件 / registry | 在本站做什么 | 怎么改的 |
|---|---|---|---|
| `DockSidebar.jsx` | `Sidebar.jsx` / `sidebar` | 桌面左侧导航坞：首页、四个级别、词汇表、随机、阅读设置、搜索、深色模式 | 去掉 macOS 三色按钮和花朵 logo，换成吉祥物；接路由，选中态跟随地址；级别用 emoji 图标；保留四宫格 / 文档 / 齿轮 / 放大镜图标微动画、选中药丸与小竖条 layoutId、右侧黑色提示气泡 + 快捷键角标；中文 |
| `MorphingTabs.jsx` | `MorphingTabNavbarShowcase.jsx` / `morphing-tab-navbar` | 级别页顶部「初级 / 中级 / 高级 / 进阶」切换 | 改成受控组件 + `<Link>`；图标换 emoji；滑动气泡用级别浅色 + 描边；手机 4 等分铺满；显示进度小字 |
| `MagneticPillTabs.jsx` | `MagneticPillNavbarShowcase.jsx` / `magnetic-pill-navbar` | 分类标签、小白版 ⇄ 专业模式分段开关、词汇表级别筛选 | 受控通用化；emoji + 角标（3/12、全学会变绿）；手机横向滚动并自动把选中项滚到中间，桌面可换行；radiogroup / tablist 语义；深色模式滑块改浅色 |
| `SearchCapsule.jsx` | `MorphSearchCapsule.jsx` / `morph-search-capsule` | 首页搜索、全站搜索浮层 | 保留胶囊、涟漪、放大镜 ⇄ 光标形变；宽度自适应；加结果列表（↑↓ 回车 Esc、combobox/listbox）；颜色走变量 |
| `FolderTabCard.jsx` | `FolderTabCard.jsx` / `folder-tab-card` | 首页 4 张级别入口卡（真实进度）；同一条「文件夹切口」形状也用在概念页每块内容的标签上 | 整卡变 `<Link>`；4 团无限动画模糊色块换成静态级别色网格渐变（仅悬停缓慢转动，定格时不动）；放大字号；加 emoji 图块与进度条；去掉鼠标视差 |
| `FlipDeck.jsx` | `PerspectiveFlipDeck.jsx` / `perspective-flip-deck` | 手机概念页一次一张卡 | 原版是固定尺寸图片卡 + 自动轮播；改为自适应高度内容卡、受控翻页、左右滑动（不抢表格/代码横滑）、往回翻反向动画；保留右铰链翻开与牌堆错位 |
| `MobileDock.jsx` | `DarkModeMobileNavbarShowcase.jsx` / `dark-mode-mobile-navbar` | 手机底部悬浮导航（首页 / 学习 / AI 规划 / 图谱 / 更多），「更多」弹出我的项目 / 词汇表 / 随机一个 / 阅读设置；概念页隐藏 | 悬停提示改为常驻中文小字；62~68×52 点击区；安全区；接路由 |
| `ThemeToggle.jsx` | `ThemeToggle.jsx` / `theme-toggle` | 深色模式开关（桌面导航坞底部、手机顶栏） | 中文无障碍标签；加 44px 点击热区；由 `useTheme()` 受控 |
| `Skeleton.jsx` | `Skeleton.jsx` / `skeleton` | 首屏、页面切换、概念内容加载时的骨架 | 颜色换成本站变量；只保留基础 Skeleton |
| `ShimmerButton.jsx` | `ShimmerButtonShowcase.jsx` / `shimmer-button` | 首页「▶ 继续学习 / 从第 1 个开始」 | 蓝底主按钮 + 半透明白高光；变 `<Link>`；定格时不扫光 |
| `WordByWord.jsx` | `WordByWordTextShowcase.jsx` / `word-by-word-text` | 首页大标题逐词浮现（只播一次） | 中文按词块传入；去掉点击重播；定格时直接显示 |
| `index.css .orbs` | `AmbientGlowOrbsShowcase.jsx` / `ambient-glow-orbs` | 首页英雄区背后极淡的三团光斑 | 改纯 CSS（3 个元素、低透明度、深色更淡），用级别色；定格 / 减少动效时静止 |

评估后没用的：`LiquidUnderlineNavbarShowcase`（只在悬停时画下划线，手机无效）、`PillExpandNavbarShowcase`（标签悬停才展开，固定 110px 会截断中文）、`AnimatedSearchDemo`（默认缩成圆钮、靠悬停展开，手机上不直观；⌘K 角标不适合目标读者）、`SoftAuroraShowcase`（WebGL 着色器 + 深色底，耗电且影响阅读）、所有 three.js / 粒子 / 光标特效类组件。


## 新功能（分支 `rewamp-features`）

### 1. 知识图谱 `#/graph`

- **数据**：`scripts/prep-derived.mjs` 在构建时读每个概念的 `related`，去重、变成双向、丢掉不存在的 slug，得到 500 个节点 / 1459 条边（0 条被丢弃、0 个孤立点）。用 d3-force 预先跑 500 步布局（按分类轻轻聚团），坐标写进 `public/data/graph.json`（31KB，gzip 12KB）。节点只存 `[级别, 分类, x, y]` + slug，名字从 `index.json` 取。只在进入图谱页或概念页「关系」卡时才 fetch。
- **画布**：Canvas 2D，不用 WebGL。平时不跑动画循环，只在变化时重绘；拖节点时才给力导向模拟加热（`alphaTarget`），放手就降温。标签在屏幕坐标里画，带描边底色，用格子做防重叠（下 → 上 → 右 → 左依次试位置），缩放越大显示越多。性能自检（e2e 里测）：重绘一帧 500 点 + 1459 边约 0.3ms（JS 侧），一次力导向 tick 约 1.9ms。
- **交互**：鼠标拖空白处平移、滚轮缩放（以指针为中心）、拖节点；手机单指平移 / 拖节点、双指缩放，右下角 + − 看全部按钮；键盘 `+ − 0 方向键 Esc`。
- **颜色**：按级别（4 色，沿用全站级别色）或按分类（15 色，深浅色各一套），图例跟着切换。已学会（`aig:done`）的节点有绿色外环 + 中心白点，图例显示已学会数量。
- **筛选**：级别、分类（地址里记 `?lv=` `?cat=`），筛掉的节点淡到几乎看不见且点不中，筛选后自动「看全部」。
- **选中**：点节点 → 它和邻居高亮、其他变淡；侧卡（桌面右侧 / 手机底部抽屉，只能从把手往下拖关闭，内容可滚动）显示名字、英文、级别、分类、关系数、是否学会、一句话、「进入概念」「🎓 专业」，以及**学习顺序**：「⬅️ 建议先学」（邻居里级别更低的）、「↔️ 同级相关」、「➡️ 学完可以看」（级别更高的）。点里面的邻居会切换选中并居中。地址记 `?focus=<slug>`，可以分享。
- **定位**：顶部搜索框（同一个 morph-search-capsule，支持拼音）选中结果 → 节点放大居中。
- **概念页「关系」小图**（`components/graph/RelationMini.jsx`，SVG，不引 d3）：三栏 = 学习顺序——左「建议先学」、中「当前概念 + 同级相关」、右「学完可以看」；可勾「显示二跳」；点节点跳到那个概念（专业模式下进专业版）；「在图谱中打开 →」链接到 `#/graph?focus=<slug>`；邻居太多时显示「还有 N 个，去图谱看 →」。
- **入口**：桌面导航坞「知识图谱」、手机底部导航「图谱」、首页「知识图谱」卡片（和 AI 规划卡同一行）。

### 2. 全文搜索升级

- **索引**：`public/data/search.json`（1.32MB，**gzip 后 585KB**），覆盖比喻、要点、步骤、翻车现场、专业定义 / 原理 / 术语（名 + 解释）/ 代码（标题 + 源码），外加标题和词汇 / 术语的拼音。标题、英文、一句话、词汇已在 `index.json` 里，不重复存。为了控制体积：按位置存数组（省掉 500 遍键名）、去掉要点 / 步骤开头的 emoji、长文本截断（定义 180 字、原理每条 90 字最多 6 条、术语解释 60 字）、代码合并空白 + 注释只留前 12 个字（标识符全部保留）。
- **拼音**：构建时用 `pinyin-pro`（devDependency，不进前端包）算每个汉字的音节。支持全拼（`dayuyan`，必须从音节开头起，末尾可以只打半个音节）和首字母（`dyymx`）；命中时高亮标题里对应的汉字。英文缩写不区分大小写，括号里的缩写正好命中会优先（`LLM` → 大语言模型 (LLM)）。
- **懒加载**：第一次聚焦搜索框才 `import('./fulltext.js')` 并 fetch `search.json`；加载好之前用原来的 `index.json` 搜索结果顶上。首页不加载任何新数据。
- **打分**：标题（完全相等 / 括号缩写 / 开头 加分）> 标题拼音 > 术语 / 词汇（含拼音）> 一句话 > 正文（比喻、要点、步骤、翻车现场、专业定义 / 原理 / 术语解释）> 代码。多个词用空格分开时每个词都要命中。
- **结果**：每条显示命中字段（如「专业 · 代码」「标题 · 拼音」「翻车现场」）和高亮片段（代码显示命中那一行，等宽字体）。点击跳到对应位置：小白内容 → `#/c/<slug>?s=<章节>`；专业内容 → `#/c/<slug>/pro?s=<章节>`（不改动「专业模式」偏好）。记住了专业模式时，指向小白专属章节（如翻车现场）的链接会留在小白版。「全部展开」时也会滚到对应章节。
- **筛选**：范围（全部 / 🧸 只看小白 / 🎓 只看专业）、级别、分类——搜索浮层里点「筛选」展开，结果页常驻。
- **首页 / 浮层**：仍最多 8 条，下方加「查看全部 N 条结果 →」（↑↓ 能选到、回车进入）→ `#/search?q=`。
- **结果页** `#/search`：每页 20 条分页，筛选记在地址里；在输入框里 ↑↓ 选、回车打开、Esc 清空。

### 用到的组件 / 依赖

| 用在哪 | 组件 / 依赖 | 说明 |
|---|---|---|
| 图谱定位、全站搜索、结果页输入框 | Rewamp `morph-search-capsule`（`SearchCapsule.jsx`，已有改造版再扩展） | 新增：受控模式、无列表模式、`onChoose`（图谱定位）、`slot`（筛选条）、命中字段 + 高亮片段、「查看全部」 |
| 颜色切换、级别 / 分类筛选、搜索范围 | Rewamp `magnetic-pill-navbar`（`MagneticPillTabs.jsx`） | 原样复用，`layoutId` 各自独立 |
| 导航入口 | Rewamp `sidebar`（`DockSidebar.jsx`）、`dark-mode-mobile-navbar`（`MobileDock.jsx`） | 加「知识图谱 / 图谱」；导航坞沿用原组件的图标弹簧动画；手机底栏 5 个按钮宽度改为 64~70px |
| 图谱 / 结果页加载中 | Rewamp `skeleton` | 原样 |
| 画布循环写法 | 参考 Rewamp `PlexusEngineShowcase`（canvas + DPR + rAF） | 只借了写法，内容完全不同；原组件是装饰粒子，没有直接用 |
| 力导向 | `d3-force@3`（dependency，只进 Graph 懒加载 chunk，构建脚本也用它预计算布局） | 不用 Three.js / WebGL |
| 拼音 | `pinyin-pro`（devDependency，只在构建时用） | 前端包里没有拼音库 |
| 底部抽屉拖动 | framer-motion `useDragControls` | 只有把手能拖 |

评估后没用的（这次）：`CircularRadialNavbarShowcase`（径向菜单，和图谱的节点交互冲突）、`SpotlightGridShowcase` / `RippleGridShowcase`（背景特效，会干扰图谱读图）、`AnimatedSearchDemo`（同上次理由）。

### 体积（gzip -6）

| 文件 | 原始 | gzip |
|---|---|---|
| 主包 `index-*.js` | 470.2KB（改前 460.3KB） | 155.2KB（改前 151.9KB，**+3.3KB**；vite 报告值） |
| `Graph-*.js`（含 d3-force） | 38.3KB | 14.6KB |
| `SearchPage-*.js` | 5.8KB | 2.8KB |
| `fulltext-*.js` | 5.8KB | 2.7KB |
| `Concept-*.js`（含关系小图） | 46.9KB | 15.0KB |
| `data/graph.json` | 31.9KB | 11.8KB |
| `data/search.json` | 1319.5KB | 598.6KB（584.6KiB） |

## AI 帮我规划（`#/plan`）与我的项目（`#/projects`）

访客用一句话描述想做的项目（可选：现在水平、每周时间），后端用 Inception **Mercury 3** 生成学习路线：3–7 个阶段，每个阶段有目标、2–6 个**站内概念**（只能是 `index.json` 里已有的 slug，从易到难）、动手任务、可直接复制给 AI 编程工具的开发指令、完成标准。密钥由站长在 Worker 里配置，访客不用填 key。

- **结果页**：概念显示为卡片（emoji / 名字 / 级别，点进概念页），已学会（`aig:done`）的打勾；「创建这个项目」存进 `localStorage` 的 `aig:projects`。
- **我的项目**：列表（进度、当前阶段、下一个概念）；详情页有进度条、阶段条、一次看一个阶段（手机用 FlipDeck 左右滑翻）、勾选动手任务、复制指令、「继续学」下一个没学的概念、重命名、删除（确认）、导出 Markdown、「让 AI 调整」（输入一句话，带当前路线重新生成，预览后确认覆盖）。
- **进度**：概念是否学会不另存，直接读 `aig:done`，在概念页点「我学会了」项目进度自动同步。进度 =（已学会概念 + 已完成任务）/（概念总数 + 阶段数）。
- `aig:projects` 结构：`[{ id, createdAt, updatedAt, name, nameEdited?, input:{project, level, hours}, route:{name, goal, stages:[{title, goal, concepts[], task, prompt, done_when}]}, tasks:[bool], doneAt:{} }]`
- 失败提示：网络断开 / 超时（前端 45 秒、Worker 25 秒）/ 今日次数用完（429）/ 站长未配密钥 / AI 输出不完整，都有中文提示，可重试的给「再试一次」。
- 入口：首页「AI 帮我规划」卡片、桌面导航坞（✨ AI 帮我规划 / 🗂 我的项目）、手机底栏「AI 规划」（在我的项目里也高亮）、手机「更多 → 我的项目」。

### 后端：Cloudflare Worker `aig-planner`（`worker/`）

- 地址：`https://aig-planner.q1f0730.workers.dev`（前端读 `VITE_PLANNER_URL`，默认就是它）
- `GET /health` → `{ ok, model, has_key, kv }`
- `POST /plan`，body `{ project ≤500字, level?: "none"|"some"|"built", hours?: 1–80, current_route?, adjust? ≤200字 }` → `{ route, dropped, remaining, ms }`；错误 `{ error, message }`：`missing_key`(500) / `bad_key`(500) / `rate_limited`、`rate_limited_global`(429) / `timeout`(504) / `bad_output`、`upstream_error`(502) / `forbidden_origin`(403) / `empty`、`too_long`、`bad_request`、`bad_route`(400)
- 模型参数：`mercury-3`，`reasoning_effort: "low"`（`medium` 在 8k token 内会把预算全花在推理上、拿不到输出），`max_completion_tokens: 8000`，`response_format: json_schema (strict)`。输出不合格自动重试一次（不额外计次）。
- 校验：丢掉目录里没有/重复的 slug，阶段 3–7、每阶段 ≤6 概念，字段截断（标题 24、目标 120、任务 300、指令 900、完成标准 160 字）。
- 防滥用：CORS 只放行 InstaBox :3000 / :3001 和 localhost；KV `aig-planner-limits` 计数，每 IP 每天 10 次、全站每天 300 次（北京时间 0 点重置，可改 Worker 变量 `IP_DAILY` / `GLOBAL_DAILY`）。KV 非强一致，并发时可能多放过几次。
- 密钥：Cloudflare 控制台 → Workers & Pages → `aig-planner` → Settings → Variables and Secrets → Add → 类型 Secret，名字 `INCEPTION_API_KEY`。`deploy.sh` 用了 `keep_bindings`，重新部署不会删掉它。

```bash
node worker/scripts/build-catalog.mjs   # 从 public/data/index.json 生成 worker/catalog.js（站内概念目录）
worker/deploy.sh                        # 用 Cloudflare API 上传 worker（会先重新生成 catalog）
node worker/scripts/test-worker.mjs     # 离线测试 worker（mock 上游和 KV）
node worker/scripts/try-mercury.mjs low --save   # 用同一份提示词直连 Inception 跑 3 个真实例子，存到 e2e/fixtures/
uv run --with playwright python scripts/e2e-ai.py http://127.0.0.1:3002/ out/   # e2e（mock /plan 用 fixture）
```

## 合并（分支 `rewamp-v3` = `rewamp-features` + `rewamp-ai`）

- **桌面导航坞**：首页 / 四个级别 / ✨ AI 帮我规划 · 🗂 我的项目 / 词汇表 · 知识图谱 · 随机 · 阅读设置 / 深色 · 搜索。共 11 个格子，格高 `clamp(40px, 5.6vh, 52px)`；1280×700 时坞高 653px（上限 668px），不溢出。
- **手机底栏**：两个分支各加了第 5 个按钮，合并后固定 5 个：首页 / 学习 / AI 规划 / 图谱 / 更多。「更多」向上弹出 2×2 面板：我的项目、词汇表、随机一个、阅读设置（Esc / 点外面 / 换页关闭；当前在词汇表时「更多」高亮，在我的项目时「AI 规划」高亮）。搜索、设置、深色模式本来就在手机顶栏，所以搜索不占底栏。360px 宽也放得下，中文不截断。
- **首页**：「AI 帮我规划」卡（桌面 8 列）+「知识图谱」卡（4 列）同一行；手机 AI 卡紧跟级别卡，图谱卡在总进度 / 词汇表之后。
- 检查：`scripts/e2e-v3-shots.py`（导航 / 首页 / 更多面板 / 矮屏，41 项）。

## 已知限制

- 主包约 478KB（gzip ≈ 157.3KB，v3 合并后），主要是 React + framer-motion；级别 / 概念 / 词汇表 / 图谱 / 搜索结果 / AI 规划 / 我的项目页面是懒加载的独立 chunk，概念内容、图谱数据、全文索引都按需 fetch。
- 全文索引里的长文本做了截断：原理每条 90 字、定义 180 字、代码注释只留前 12 个字，超出部分的字搜不到（标识符不受影响）。
- 图谱画布本身对读屏软件只有一段说明文字；读屏用户可以用图谱顶部的搜索框定位节点，侧卡里的按钮和链接都可聚焦。
- 预览（:3001）用 `scripts/gzserve.py`（零依赖 Python，文本类 >1KB 按需 gzip 并缓存在内存，`/assets/` 长缓存），`search.json` 传输约 585KB；不支持 br。
- 朗读依赖浏览器自带的中文语音；没有中文语音的系统会用默认语音。
- 检查清单的勾选只在当前页面临时记录（与旧站一致，不写入 localStorage）。
