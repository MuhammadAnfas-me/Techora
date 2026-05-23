import puppeteer from 'puppeteer-core';


export async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH,
      args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
  ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '15px', right: '15px' }
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
