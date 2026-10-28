// 从 ../public/data/index.json 生成 src/lib/catalog.js（站内概念目录，供 AI 路线规划提示词与校验使用）
// 用法：node scripts/prep-catalog.mjs   （需要先运行 prep-data.mjs 生成 public/data）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const idx = JSON.parse(fs.readFileSync(path.resolve(here, '../public/data/index.json'), 'utf8'))
const LV = { '初级': 1, '中级': 2, '高级': 3, '进阶': 4 }
// 紧凑格式：每行 slug|中文名|级别数字|分类，按级别、编号排序
const rows = idx.items.map(x => [x.slug, x.zh.replace(/\|/g, '/'), LV[x.level] || 9, x.cat, x.no])
rows.sort((a, b) => a[2] - b[2] || a[4] - b[4])
const cats = Object.entries(idx.meta.cats).map(([k, v]) => `${k}=${v.name}`).join('，')
const text = rows.map(r => r.slice(0, 4).join('|')).join('\n')
const out = `// 自动生成，勿手改：node scripts/prep-catalog.mjs（来源 public/data/index.json，${rows.length} 个概念）
export const CATALOG_TEXT = ${JSON.stringify(text)}
export const CATS_TEXT = ${JSON.stringify(cats)}
export const LEVEL_OF = ${JSON.stringify(Object.fromEntries(rows.map(r => [r[0], r[2]])))}
`
fs.writeFileSync(path.resolve(here, '../src/lib/catalog.js'), out)
console.log('prep-catalog: src/lib/catalog.js', rows.length, 'concepts,', (out.length / 1024).toFixed(1), 'KB')
