const puppeteer = require('puppeteer');
async function scrapeImageInfo(id) {
  const url = `https://mod.io/g/pavlov?id=${id}`;
  try {
    const browser = await puppeteer.launch({
        devtools: true,
        defaultViewport: {
          width: 1280,
          height: 1024,
        },
        headless: true,
      });
      const page = await browser.newPage();
       
      //console.time("goto");
      await page
        .goto(url, {
          waitUntil: "networkidle0",
        })
        .catch((err) => console.log("error loading url", err));
      //console.timeEnd("goto");
       
      const imageElement = await page.$('.tw-bg-center.tw-bg-cover.tw-w-full.tw-h-full[role="img"]');
      
    if (imageElement) {
      const style = await imageElement.evaluate(node => node.getAttribute('style'));
      const imageUrl = style.match(/background-image: url\("([^"]+)"/)[1];
      const alt = await imageElement.evaluate(node => node.getAttribute('alt'));
      await browser.close();

      return {
        imageUrl,
        alt
      };
    } else {
      await browser.close();
      return {
        error: 'Image element not found.'
      };
    }
  } catch (error) {
    throw new Error('Error scraping the webpage: ' + error.message);
  }
}

module.exports = scrapeImageInfo;