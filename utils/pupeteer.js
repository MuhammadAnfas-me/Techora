import puppeteer from 'puppeteer-core';

export async function generatePdf(html) {
  let browser;
  try {
    console.log('Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
      ],
    });

    const page = await browser.newPage();

    // Set default timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Improve performance by blocking unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log('Setting HTML content for PDF generation...');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    console.log('Generating PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '15px', right: '15px' },
    });

    console.log('PDF generated successfully.');
    return pdf;
  } catch (error) {
    console.error('Error during PDF generation:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close().catch(err => console.error('Error closing browser:', err));
    }
  }
}
