// 自托管部署：构建后移除妙搭框架（coding-preset-vite-react）注入的外部遥测脚本。
//
// 注入发生在 vite 构建阶段（slardarPlugin / ogMetaPlugin 等），普通构建无法通过配置关闭
// （仅 MIAODA_BUILD_TARGET=standalone 会摘除，但该模式会同时改成 HashRouter 并跳过
// NestJS HBS 模板渲染，不适合本项目的 nginx + NestJS 自托管形态）。
// 因此在 build:client 后立即执行本脚本，把三类外链脚本从 dist 模板中剥掉：
//   1. Slardar 错误采集（bytedapm.com）
//   2. 飞书 performance 探针（feishucdn.com）
//   3. Tea 日志采集（bytescm.com）
// 剥离后客户端 bundle 中残留的 slardar 引用会因 window.KSlardarWeb 不存在而自动 no-op。
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STRIPS = [
  // Slardar 内联错误采集 + 外链 SDK 加载器
  /<script>\(function\(g\)\{[\s\S]*?appendChild\(slardarScript\);<\/script>/,
  // 飞书 performance 探针（src 指向 sf3-scmcdn-cn.feishucdn.com 的 <script> 标签）
  /<script src="https:\/\/sf3-scmcdn-cn\.feishucdn\.com[^"]*"[^>]*><\/script>/,
  // Tea 日志采集（collectEvent）
  /<script>\(function \(win, export_obj\) \{[\s\S]*?appendChild\(teaScript\);<\/script>/,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

const distClient = join(process.cwd(), 'dist/client');
let cleaned = 0;

for (const file of walk(distClient)) {
  const original = readFileSync(file, 'utf8');
  let html = original;
  for (const re of STRIPS) html = html.replace(re, '');
  if (html !== original) {
    writeFileSync(file, html);
    cleaned += 1;
    console.log(`[strip-miaoda-traces] cleaned ${file}`);
  }
}

console.log(`[strip-miaoda-traces] done, ${cleaned} file(s) updated`);
