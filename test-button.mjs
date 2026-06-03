import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle2", timeout: 30000 });
    
    console.log("Page URL:", page.url());
    
    // Look for buttons in header
    const allButtons = await page.locator("button").all();
    console.log("Total buttons on page:", allButtons.length);
    
    // Check the HTML to see what we're dealing with
    const bodyClass = await page.locator("body").getAttribute("class");
    console.log("Body class:", bodyClass);
    
    // Take screenshot
    await page.screenshot({ path: "C:\Users\imseb\AppData\Local\Temp\screenshot.png", fullPage: true });
    console.log("Screenshot saved");
    
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
})();
