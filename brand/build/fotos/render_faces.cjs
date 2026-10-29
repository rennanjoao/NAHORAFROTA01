// Renderiza cada .face de faces.html como PNG transparente em brand/build/fotos/faces/.
// Uso: node brand/build/fotos/render_faces.cjs  (CHROME_PATH opcional, se o Chromium do Playwright não estiver no cache)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SCALE = { bau: 2, 'cartao-frente': 5, 'cartao-verso': 5, cracha: 4, placa: 2 };
(async () => {
  const out = path.join(__dirname, 'faces'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
  for (const [id, dsf] of Object.entries(SCALE)) {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1400 }, deviceScaleFactor: dsf });
    await page.goto('file://' + path.join(__dirname, 'faces.html'), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#' + id).screenshot({ path: path.join(out, id + '.png'), omitBackground: true });
    await page.close();
  }
  await browser.close(); console.log('faces ok');
})();
