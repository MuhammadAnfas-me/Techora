import puppeteer from "puppeteer-core";

export async function generatePdf(html) {
  let browser;
  let page;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process"
      ],
    });

    page = await browser.newPage();

    // ✅ safer timeout handling
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);


    await page.setContent(html, {
      waitUntil: "networkidle0", // ✅ IMPORTANT (ensures full load)
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "15px", right: "15px" },
    });

    return pdf;

  } catch (error) {
    console.error("Error during PDF generation:", error);
    throw error;

  } finally {
    try {
      if (page) await page.close();   
      if (browser) await browser.close(); 
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }
}