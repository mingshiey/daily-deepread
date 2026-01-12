// scripts/generate.js
import fs from 'node:fs';
import path from 'node:path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // 在 GitHub Actions 配置
const REPO_URL = process.env.REPO_URL || "";       // 可用于RSS中的 link

const today = new Date();
const pad = n => String(n).padStart(2, '0');
const dateStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
const dailyDir = path.join(process.cwd(), 'daily');
const publicDir = path.join(process.cwd(), 'public');
const archivePath = path.join(process.cwd(), 'archive.json');
const rssPath = path.join(process.cwd(), 'feed.xml');
const outPath = path.join(dailyDir, `${dateStr}.html`);

if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(archivePath)) fs.writeFileSync(archivePath, '[]', 'utf-8');

const SYSTEM_PROMPT = `
你是「每日深读」，为用户每日生成“深度新闻+学习复盘”主页，中文输出，覆盖金融、Crypto（分两类：市场观察 + 产业与政策/监管/机构落地/Tokenization）、市场分析、美国、中国、全球要闻，提供结构化、可导出的结果。输出为「完整可独立打开的HTML文档」，含最基础样式。

结构要求：
1. 顶部总览（关键脉络、市场快照、今日深度）
2. 六大板块（金融、Crypto、市场分析、美国、中国、全球），每板块3–5条。
每条新闻必须包含：
- 标题（完整描述主题）
- 脉络速读（2–4句）
- 要点（3–5条含数据/时间/参与方/阈值）
- 为什么重要（1句）
- 适合谁看（1句）
- 风险/反方（1–2条）
- 深入阅读链接（https://...）
- 来源与日期（YYYY-MM-DD）
- 标签（2–5个）
- 图片：仅在确有信息价值时展示（可省略）

Crypto 板块细分为两个子区块：
A）Crypto 市场观察（价格/成交/流动性/链上指标）
B）Crypto 产业与政策新闻（Tokenization、链上基金/ETF、SEC许可/执法、DTCC/JPM/机构上链、L2/基础设施、合规与传统金融融合）

其他要求：
- 内容务必结构化，避免空话。
- 统一日期格式 YYYY-MM-DD。
- 链接为完整可识别URL。
- 在HTML中使用 <section> <article> <ul> 等语义标签。
- 页头加“生成日期：YYYY-MM-DD”，并以该日期为标题副标。
- 页面底部加“归档入口链接指向 /archive.json 和 /feed.xml”。`;

const USER_PROMPT = `
请以今天为基准（${dateStr}）生成完整HTML主页。若无法联网抓取，请给出“高质量示例内容”，务必保持真实风格、结构与字段完备，特别是Crypto“产业与政策”务必包含 tokenization 的具体案例（例如JP Morgan/Onyx、DTCC资产上链、SEC许可/批准、ETF进展等），并附上示例链接（格式正确）与合理日期占位符。`;

async function callOpenAI(system, user) {
  if (!OPENAI_API_KEY) {
    console.warn('未设置 OPENAI_API_KEY，使用本地示例内容。');
    return null;
  }
  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.3
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
    console.error("OpenAI API 错误：", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const html = data?.choices?.[0]?.message?.content || "";
  return html.trim();
}

function fallbackHTML() {
  return `<!doctype html>
<html lang="zh-cn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>每日深读 - ${dateStr}</title>
<link rel="stylesheet" href="../public/styles.css" />
<style>
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,PingFang SC,Helvetica Neue,Arial;line-height:1.6;padding:24px;max-width:960px;margin:0 auto;}
  header{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
  h1{margin:0}
  section{margin:24px 0}
  article{padding:12px 16px;border:1px solid #eee;border-radius:10px;margin:12px 0}
  .tag{display:inline-block;background:#f3f4f6;color:#111;padding:2px 8px;border-radius:999px;margin-right:6px;font-size:12px}
  .meta{color:#666;font-size:12px;margin-top:6px}
  .pill{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid #ddd;margin-left:6px}
  footer{margin-top:40px;color:#666;font-size:14px}
</style>
</head>
<body>
  <header>
    <h1>每日深读</h1>
    <div>生成日期：${dateStr}</div>
  </header>
  <section id="overview">
    <h2>顶部总览</h2>
    <article>
      <h3>关键脉络</h3>
      <ul>
        <li>示例：全球流动性与通胀预期分化；美债收益率走阔。</li>
        <li>示例：加密市场在ETF资金流入与监管博弈下结构性分化。</li>
      </ul>
      <div class="meta">今日深度：Tokenization 与合规桥接进展</div>
    </article>
  </section>
  <section id="crypto">
    <h2>Crypto</h2>
    <article>
      <h3>（A）市场观察</h3>
      <ul>
        <li>示例：BTC 现货成交量环比 +12%，资金费率小幅为正。</li>
        <li>示例：ETH 链上活跃地址回升至 45 万。</li>
      </ul>
      <div class="meta">适合谁看：加密交易者、量化、风控</div>
    </article>
    <article>
      <h3>（B）产业与政策新闻</h3>
      <h4>JP Morgan 在以太坊上推进基金融资与结算的 Tokenization</h4>
      <p>脉络速读：通过 Onyx Digital Assets，机构在公链进行资产发行与结算测试，降低结算摩擦，增强可组合性。</p>
      <ul>
        <li>平台：Onyx；链：Ethereum 主网</li>
        <li>资产类型：货币基金/短债类份额</li>
        <li>时间：${dateStr}</li>
      </ul>
      <p><strong>为什么重要：</strong>传统金融与公链融合加速，提升合规资产可编程性。</p>
      <p class="meta">深入阅读：<a href="https://www.jpmorgan.com/onyx">https://www.jpmorgan.com/onyx</a> ｜ 来源：JPM，日期示例</p>
      <div>
        <span class="tag">#Tokenization</span><span class="tag">#JP Morgan</span><span class="tag">#Ethereum</span>
      </div>
    </article>
    <article>
      <h4>DTCC 探索股票等资产上链结算</h4>
      <p>脉络速读：托管与清算基础设施与区块链互操作性测试，评估监管与风控模型。</p>
      <ul>
        <li>机构：DTCC</li>
        <li>范围：equity / mutual fund 代币化</li>
        <li>时间：${dateStr}</li>
      </ul>
      <p class="meta">阅读：<a href="https://www.dtcc.com">https://www.dtcc.com</a></p>
      <div><span class="tag">#DTCC</span><span class="tag">#TokenizedEquity</span></div>
    </article>
  </section>
  <footer>
    归档：<a href="archive.json">archive.json</a> ｜ RSS：<a href="feed.xml">feed.xml</a>
  </footer>
</body>
</html>`;
}

function updateArchive(title) {
  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
  const entry = {
    date: dateStr,
    title,
    path: `daily/${dateStr}.html`
  };
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

function makeRSS(archive) {
  const items = archive.slice(0, 30).map(a => `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml((REPO_URL || '').replace(/\/$/, '') + a.path)}</link>
      <guid>${escapeXml(a.path)}</guid>
      <pubDate>${new Date(a.date + 'T00:00:00Z').toUTCString()}</pubDate>
    </item>`).join('\n');
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

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

(async () => {
  let html = await callOpenAI(SYSTEM_PROMPT, USER_PROMPT);
  if (!html || !html.includes('<html')) {
    html = fallbackHTML();
  }
  fs.writeFileSync(outPath, html, 'utf-8');
  const title = extractTitle(html);
  const archive = updateArchive(title);
  const rss = makeRSS(archive);
  fs.writeFileSync(rssPath, rss, 'utf-8');
  console.log(`✅ 生成完成：${outPath}`);
})();
