import puppeteer, { executablePath } from 'puppeteer';

let browser;

export const getBrowser = async () => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      // executablePath : process.env.CHROME_PATH ,
      // args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
};
