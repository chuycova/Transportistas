import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`BROWSER_ERROR: ${msg.text()}`);
    } else {
      console.log(`BROWSER_LOG: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`PAGE_EXCEPTION: ${err.message}`);
  });

  try {
    const urls = ['http://localhost:5173', 'http://localhost:5174'];
    let success = false;
    
    for (const url of urls) {
      console.log(`Trying ${url}...`);
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 5000 });
        console.log(`Loaded ${url}! Waiting for JS to execute...`);
        await new Promise(r => setTimeout(r, 2000)); // wait for React mounting
        success = true;
        break;
      } catch (e) {
        console.log(`Failed ${url}: ${e.message}`);
      }
    }
    
    if (!success) {
      console.log('Could not connect to Vite server :(');
    }
  } finally {
    await browser.close();
  }
})();
