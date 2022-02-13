const Scrapper = require('./Scrapper');
const chalk = require('chalk');

async function scrapeAll(browserInstance) {
        let browser;
        console.log(`${chalk.bgGreen.white.bold('Initiating...')}`);

        try {
                browser = await browserInstance;
                let scrapper = new Scrapper(browser);
                await scrapper.openPage();
                await scrapper.generateGoogleFontsList();
                await scrapper.fetchGoogleVariableFontsList();
                await scrapper.formatGoogleFontData();
                await scrapper.getFontsMetaData();
                await scrapper.closeBrowser();
                console.log(`${chalk.bgGreen.white.bold('Terminating scrapper...')}`);
                // await scrapper.fetchFontsList();
                // await scrapper.getFontsMetaData();
        }
        catch (error) {
                console.log(`${chalk.bgRed.white.bold('Critical Error:')} ${error}`);
        }
}

module.exports = (browserInstance) => scrapeAll(browserInstance)
