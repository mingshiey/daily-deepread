// scripts/generate.js
// 每日深读自动生成脚本（稳健版）
// - 更长更全（每板块≥5，Crypto 双区块各≥3）
// - 生成不足自动补齐
// - 完整相对路径（兼容 GitHub Pages 项目页）
// - API 出错也有兜底页，不让 CI 挂掉
// 需要在仓库 Secrets 配置：OPENAI_API_KEY

import fs from 'node:fs';
import path from 'node:path';

// ---- 全局兜底，避免未捕获异常让进程非 0 退出 ----
process.on('unhandledRejection', (e) => {
  console.error('UNHANDLED REJECTION:', e?.stack || e);
});
process.on('uncaughtException', (e) => {
  console.error('UNCAUGHT EXCEPTION:', e?.stack || e);
});

// ---- 配置 ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o"; // 或 "gpt-4o-mini"
const MAX_TOKENS = 6000;
const REPO_URL = process.env.REPO_URL || ""; // 用于 RSS 链接前缀（可留空）

const today = new Date();
const pad = n => String(n).padStart(2, '0');
const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const root = process.cwd();
const dailyDir = path.join(root, 'daily');
const archivePath = path.join(root, 'archive.json');
const rssPath = path.join(root, 'feed.xml');

if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
if (!fs.existsSync(archivePath)) fs.writeFileSync(archivePath, '[]', 'utf-8');

// ---- 提示词（严格配额 + 自检）----
const SYSTEM_PROMPT = `
你是「每日深读」，为用户每日生成“深度新闻+学习复盘”主页，中文输出，覆盖金融、Crypto（分两类：市场观察 + 产业与政策/监管/机构落地/Tokenization）、市场分析、美国、中国、全球要闻，提供结构化、可导出的结果。输出为「完整可独立打开的HTML文档」，含最基础样式。

【页面结构】
1. 顶部总览（关键脉络、市场快照、今日深度）
2. 六大板块（金融、Crypto、市场分析、美国、中国、全球）。
   - 每板块「至少 5 条」（建议 5–7 条）。
   - Crypto 分为两个子区块：
     A）Crypto 市场观察（价格/成交/流动性/链上指标），≥3 条；
     B）Crypto 产业与政策新闻（Tokenization、链上基金/ETF、SEC 许可/执法、DTCC/JPM/机构上链、L2/基础设施、合规融合），≥3 条。

【每条新闻字段】
- 标题（完整描述主题）
- 脉络速读（2–4句）
- 要点（3–5条，含数据/时间/参与方/阈值）
- 为什么重要（1句）
- 适合谁看（1句）
- 风险/反方（1–2条）
- 深入阅读链接（https://...）
- 来源与日期（YYYY-MM-DD）
- 标签（2–5个）
- 图片：仅在确有信息价值时展示

【统一规范】
- 日期统一 YYYY-MM-DD。
- 链接为可识别完整URL。
- 语言简洁清晰，突出数据、阈值与参与方。

【Crypto 产业与政策优先级】
- 必含 Tokenization 实例（JP Morgan/Onyx、DTCC、BlackRock 等）、ETF/基金链上化、SEC 许可/执法、主流 L2/Infra、与传统金融融合。

【离线/示例模式】
- 若无法联网抓取，请输出高质量「示例内容」，但仍需严格满足数量与字段要求，并提供格式正确的示例链接与合理日期。

【自检清单（输出前必须自检并补齐）】
1）每个板块是否 ≥5 条；2）Crypto 的 A/B 子区块是否各 ≥3 条；
3）每条是否包含所有字段；4）所有链接是否是完整URL；
5）整页不少于约 2000 中文字。
如不满足，请补齐后再输出。

【HTML 要求】
- 使用 <section> <article> <ul> 等语义标签。
- 页头需显示“生成日期：YYYY-MM-DD”，并以该日期为副标题。
- 页脚需包含归档与RSS入口（相对路径）。`;

const USER_PROMPT = `
请以今天为基准（${dateStr}）生成完整HTML主页。若无法联网，请生成高质量示例内容，务必保持结构与数量完备。`;

// ---- OpenAI 调用 ----
async function callOpenAI(system, user) {
  if (!OPENAI_API_KEY) {
    console.warn("⚠️ 未设置 OPENAI_API_KEY，使用本地示例内容。");
    return null;
  }
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2,
    max_tokens: MAX_TOKENS
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text().catch(()=> '');
    console.error("❌ OpenAI API 错误：", res.status, t);
    return null;
  }
  const data = await res.json().catch(e => {
    console.error("❌ 解析响应失败：", e);
    return null;
  });
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

// ---- 兜底 HTML ----
function fallbackHTML() {
  return `<!doctype html>
<html lang="zh-cn">
<head>
<meta charset="utf-8" />
<title>每日深读 - ${dateStr}</title>
<style>
body{font-family:ui-sans-serif,system-ui,PingFang SC,Roboto,Arial;line-height:1.6;padding:24px;max-width:960px;margin:0 auto;}
section{margin:24px 0}
article{padding:12px 16px;border:1px solid #eee;border-radius:10px;margin:12px 0}
.tag{display:inline-block;background:#f3f4f6;color:#111;padding:2px 8px;border-radius:999px;margin-right:6px;font-size:12px}
footer{margin-top:40px;color:#666;font-size:14px}
h1,h2,h3{margin:0 0 8px 0}
</style>
</head>
<body>
<header><h1>每日深读</h1><div>生成日期：${dateStr}</div></header>
<section id="overview"><h2>顶部总览</h2>
<article><h3>关键脉络</h3>
<ul><li>示例：全球流动性与通胀预期分化，美债收益率波动。</li>
<li>示例：加密市场受ETF资金与监管进展影响出现结构性分化。</li></ul>
</article></section>
<section id="crypto"><h2>Crypto</h2>
<article><h3>（A）市场观察</h3>
<ul><li>示例：BTC 现货成交量环比 +12%，资金费率转正。</li>
<li>示例：ETH 活跃地址回升至 45 万。</li></ul>
</article>
<article><h3>（B）产业与政策新闻</h3>
<h4>JP Morgan 在以太坊上发行 Tokenized 基金</h4>
<p>脉络速读：通过 Onyx Digital Assets 在以太坊主网发行机构级货币基金份额。</p>
<ul><li>平台：Onyx</li><li>链：Ethereum 主网</li><li>时间：${dateStr}</li></ul>
<p><strong>为什么重要：</strong>传统金融与公链融合提速。</p>
<p>适合谁看：加密研究者、机构合规模块</p>
<p>风险/反方：监管不确定性；隐私与透明度平衡。</p>
<p>阅读：<a href="https://www.jpmorgan.com/onyx">https://www.jpmorgan.com/onyx</a></p>
</article></section>
<footer>归档：<a href="archive.json">archive.json</a> ｜ RSS：<a href="feed.xml">feed.xml</a></footer>
</body></html>`;
}

// ---- 工具函数 ----
function countArticles(html) {
  return (html.match(/<article\b/gi) || []).length;
}

function updateArchive(title) {
  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
  const entry = { date: dateStr, title, path: `daily/${dateStr}.html` }; // 相对路径
  const exists = archive.some(x => x.date === dateStr);
  const next = exists ? archive.map(x => x.date === dateStr ? entry : x) : [entry, ...archive];
  fs.writeFileSync(archivePath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (m) return m[1];
  const h1 = html.match(/<h1[^>]*>([^<]+)/i);
  if (h1) return `每日深读 - ${dateStr} - ${h1[1]}`;
  return `每日深读 - ${dateStr}`;
}

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function makeRSS(archive) {
  const base = (REPO_URL || '').replace(/\/$/, '');
  const items = archive.slice(0, 30).map(a => {
    const link = base ? `${base}/${a.path}` : a.path; // REPO_URL 可为空
    return `
  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${escapeXml(link)}</link>
    <guid>${escapeXml(link)}</guid>
    <pubDate>${new Date(a.date + 'T00:00:00Z').toUTCString()}</pubDate>
  </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>每日深读</title>
  <link>${escapeXml(base || '')}</link>
  <description>每日深读归档</description>
  ${items}
</channel>
</rss>`;
}

// ---- 主流程（保证最终退出码为 0）----
(async () => {
  try {
    let html = await callOpenAI(SYSTEM_PROMPT, USER_PROMPT);
    if (!html || !html.includes('<html')) html = fallbackHTML();

    // 数量不足则尝试补齐一次
    try {
      const MIN_ARTICLES = 30; // 6 板块 × 5 条
      if (countArticles(html) < MIN_ARTICLES && OPENAI_API_KEY) {
        const retry = await callOpenAI(
          SYSTEM_PROMPT,
          USER_PROMPT + "\n\n请仅在保持整体结构不变的前提下，补齐不足条目直到满足数量下限。"
        );
        if (retry && countArticles(retry) > countArticles(html)) html = retry;
      }
    } catch (err) {
      console.warn('补齐阶段出错：', err?.message || err);
    }

    const outPath = path.join(dailyDir, `${dateStr}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');

    const title = extractTitle(html);
    const archive = updateArchive(title);
    const rss = makeRSS(archive);
    fs.writeFileSync(rssPath, rss, 'utf-8');

    console.log(`✅ 已生成：${outPath}`);
  } catch (err) {
    console.error('生成流程异常：', err?.stack || err);
    // 兜底页，确保有变更可提交
    fs.mkdirSync(dailyDir, { recursive: true });
    const outPath = path.join(dailyDir, `${dateStr}.html`);
    fs.writeFileSync(outPath, `<html><body><h1>每日深读 - ${dateStr}</h1><p>生成失败使用兜底页。</p></body></html>`);
  } finally {
    // 确保 CI 不红 X
    process.exit(0);
  }
})();
