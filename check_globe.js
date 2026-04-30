const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Capture console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('https://www.3gvelarias.com/industrial/', { waitUntil: 'networkidle2' });
    
    // Wait an extra 4 seconds to allow the 3.5s timeout + requestIdleCallback to run
    await new Promise(r => setTimeout(r, 4000));
    
    const globeType = await page.evaluate(() => typeof window.Globe);
    const mapHtml = await page.evaluate(() => {
        const el = document.getElementById('map');
        return el ? el.innerHTML : 'no map element';
    });
    
    console.log('typeof Globe:', globeType);
    console.log('map container HTML:', mapHtml);
    
    await browser.close();
})();
