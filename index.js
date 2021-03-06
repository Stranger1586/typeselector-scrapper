require('dotenv').config();
const Scrapper = require('./Scrapper');
const chalk = require('chalk');

async function start() {
    console.log(`${chalk.bgGreen.white.bold('Initiating...')}`);
    try {
            const scrapper = new Scrapper();
            await scrapper.init();
            await scrapper.generateGoogleFontsList();
            await scrapper.fetchGoogleVariableFontsList();
            scrapper.formatGoogleFontData();
            await scrapper.initCluster();
            await scrapper.setTask();
            await scrapper.getFontsMetaData();
            await scrapper.saveAndExit();
    }
    catch (error) {
            console.log(`${chalk.bgRed.white.bold('Critical Error:')} ${error}`);
            process.exit(1);
    }
}

start();
