// 图谱配色（图谱页和概念页「关系」小图共用；单独成文件，避免概念页把 d3-force 一起打包进来）
export const LV_COLORS = {
  light: ['#1E7F45', '#0A57D0', '#6942C4', '#C83E28'],
  dark: ['#5FD08A', '#7AAEFF', '#B79BFF', '#FF8B74'],
}
// 15 个分类（按 meta.catOrder 顺序）
export const CAT_COLORS = {
  light: ['#E8590C', '#1C7ED6', '#2B8A3E', '#C2255C', '#7048E8', '#0B7285', '#B7791F', '#5C940D', '#A61E4D', '#364FC7', '#087F5B', '#862E9C', '#495057', '#D9480F', '#1098AD'],
  dark: ['#FF922B', '#4DABF7', '#69DB7C', '#F783AC', '#9775FA', '#3BC9DB', '#FFD43B', '#A9E34B', '#FF8FB1', '#748FFC', '#38D9A9', '#DA77F2', '#CED4DA', '#FF8787', '#66D9E8'],
}
export const DONE_COLOR = { light: '#16A34A', dark: '#4ADE80' }
export const shortName = zh => zh.replace(/\s*[(（].*[)）]\s*$/, '')

