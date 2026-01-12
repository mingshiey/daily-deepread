// scripts/generate.js
// 每日深读自动生成脚本（增强版）
// 支持定时生成完整主页 + 归档 + RSS
// 使用前请在仓库 Secrets 里配置 OPENAI_API_KEY

import fs from 'node:fs';
import path from 'node:path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o"; // 或用 gpt-4o-mini 性价比更高
const MAX_TOKENS = 6000;
const REPO_URL = process.env.REPO_URL || "";

const today = new Date();
const pad = n => String(n).padStart(2, '0');
const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const dailyDir = path.join(process.cwd(), 'daily');
const archivePath = path.join(process.cwd(), 'archive.json');
const rssPath = path.join(process.cwd(), 'feed.xml');

if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
if (!fs.existsSync(archivePath)) fs.writeFileSync(archivePath, '[]', 'utf-8');

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

【自检清单（必须在输出前自检并补齐）】
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
    console.error("❌ OpenAI API 错误：", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

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
</style>
</head>
<body>
<header><h1>每日深读</h1><div>生成日期：${dateStr}</div></header>
<section><h2>示例内容</h2>
<article><h3>JP Morgan 在以太坊上发行 Tokenized 基金</h3>
<p>脉络速读：JP Morgan 通过 Onyx 平台在以太坊上推出首个机构级 Tokenized Money Market Fund。</p>
<ul><li>平台：Onyx Digital Assets</li><li>链：Ethereum 主网</li><li>时间：${dateStr}</li></ul>
<p><strong>为什么重要：</strong>传统金融加速采用区块链基础设施。</p>
<p>适合谁看：加密研究者、金融科技从业者。</p>
<p>风险/反方：监管政策不确定性。</p>
<p>来源：JPMorgan，日期：${dateStr}</p>
</article>
</section>
<footer>
归档：<a href="archive.json">archive.json</a> ｜ RSS：<a href="feed.xml">feed.xml</a>
</footer>
</body></html>`;
}

function countArticles(html) {
  return (html.match(/<article\b/gi) || []).length;
}

function updateArchive(title) {
  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
  const entry = { date: dateStr, title, path: `daily/${dateStr}.html` };
  const exists = archive.some(x => x.date === dateStr);
  const next = exists ? archive.map(x => x.date === dateStr ? entry : x) : [entry, ...archive];
  fs.writeFileSync(archivePath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\\/title>/i);
  if (m) return m[1];
  const h1 = html.match(/<h1[^>]*>([^<]+)/i);
  if (h1) return `每日深读 - ${dateStr} - ${h1[1]}`;
  return `每日深读 - ${dateStr}`;
}

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function makeRSS(archive) {
  const items = archive.slice(0, 30).map(a => `
  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${escapeXml((REPO_URL || '').replace(/\\/$/, '') + '/' + a.path)}</link>
    <guid>${escapeXml(a.path)}</guid>
    <pubDate>${new Date(a.date + 'T00:00:00Z').toUTCString()}</pubDate>
  </item>`).join('\\n');
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>每日深读</title>
  <link>${escapeXml(REPO_URL || '')}</link>
  <description>每日深读归档</description>
  ${items}
</channel>
</rss>`;
}

(async () => {
  let html = await callOpenAI(SYSTEM_PROMPT, USER_PROMPT);
  if (!html || !html.includes('<html')) html = fallbackHTML();

  // 若条目数量不足则自动补齐
  try {
    if (countArticles(html) < 24 && OPENAI_API_KEY) {
      const retry = await callOpenAI(
        SYSTEM_PROMPT,
        USER_PROMPT + "\\n\\n请仅在保持整体结构不变的前提下，补齐不足条目直到满足数量下限。"
      );
      if (retry && countArticles(retry) > countArticles(html)) html = retry;
    }
  } catch {}

  const outPath = path.join(dailyDir, `${dateStr}.html`);
  fs.writeFileSync(outPath, html, 'utf-8');
  const title = extractTitle(html);
  const archive = updateArchive(title);
  const rss = makeRSS(archive);
  fs.writeFileSync(rssPath, rss, 'utf-8');
  console.log(`✅ 已生成：${outPath}`);
})();
