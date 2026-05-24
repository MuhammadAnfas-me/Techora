import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'

export async function generatePdf (html) {
  let browser
  let page

  // ✅ create unique temp profile
  const userDataDir = `/tmp/puppeteer_${Date.now()}`

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      userDataDir, // 🔥 IMPORTANT FIX
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ]   
    })

    page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true
    })

    return pdf
  } catch (error) {
    console.error('Error during PDF generation:', error)
    throw error
  } finally {
    try {
      if (page) await page.close()
      if (browser) await browser.close()

      // ✅ cleanup profile folder
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true })
      }
    } catch (err) {
      console.error('Cleanup error:', err)
    }
  }
}
