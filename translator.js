// optimized-server.js
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

let browser, page;

// Launch Puppeteer once
(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  page = await browser.newPage();
})();

const translationCache = new Map(); // Cache to store previously translated text

app.post("/translate", async (req, res) => {
  const { from, to, text } = req.body;

  if (!text || !from || !to) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Check cache first to avoid unnecessary calls to Google Translate
  const cacheKey = `${from}-${to}-${text}`;
  if (translationCache.has(cacheKey)) {
    return res.json({ translated: translationCache.get(cacheKey) });
  }

  const url = `https://translate.google.com/?sl=${from}&tl=${to}&text=${encodeURIComponent(text)}&op=translate`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 });

    // Wait and extract translation
    await page.waitForSelector('span[jsname="W297wb"]', { timeout: 5000 });

    const translated = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span[jsname="W297wb"]'));
        return spans.map(span => span.innerText.trim()).join("\n");
      });
      

    if (translated) {
      // Cache the translation for future requests
      translationCache.set(cacheKey, translated);
      res.json({ translated });
    } else {
      res.status(500).json({ error: "No translation found." });
    }
  } catch (err) {
    console.error("❌ Translation error:", err.message);
    res.status(500).json({ error: "Translation failed", details: err.message });
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  if (browser) await browser.close();
  process.exit();
});

app.listen(3000, () => {
  console.log("🚀 Optimized server running on http://localhost:3000");
});
