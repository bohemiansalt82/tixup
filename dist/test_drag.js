const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  
  await page.goto('http://localhost:8080/test_drive.html');
  await page.waitForTimeout(1000);
  
  const bar = await page.$('.timeline-bar');
  if (bar) {
    console.log('Found bar, dragging...');
    const box = await bar.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(box.x + 100, box.y + 10, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    console.log('Drag completed.');
  } else {
    console.log('Bar not found!');
  }
  
  await browser.close();
})();
