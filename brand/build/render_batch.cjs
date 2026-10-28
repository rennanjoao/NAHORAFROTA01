// Render SVG files listed in manifest.json to PNG (transparent) at given widths.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..');
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  let n = 0;
  for (const item of manifest) {
    const svg = fs.readFileSync(path.join(OUT, item.file), 'utf8');
    for (const pw of item.png) {
      const ph = Math.round(pw * item.h / item.w);
      await page.setViewportSize({ width: pw, height: ph });
      await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${pw}px;height:${ph}px}</style></head><body>${svg}</body></html>`);
      const rel = item.file.replace('/svg/', '/png/').replace(/\.svg$/, `-${pw}px.png`);
      const outp = path.join(OUT, rel); fs.mkdirSync(path.dirname(outp), { recursive: true });
      await page.screenshot({ path: outp, omitBackground: true, clip: { x: 0, y: 0, width: pw, height: ph } });
      n++;
    }
  }
  await browser.close(); console.log('png files', n);
})();
