const fs = require('fs');
const chalk = require('chalk');
const status = require('node-status')
const cliProgress = require('cli-progress');

const scraperObject = {
    url: 'http://books.toscrape.com',
    async scraper(browser) {
        let page = await browser.newPage();
        console.log(`Navigating to ${this.url}...`);
        await page.goto(this.url);
    }
}

class Scrapper {
    urls = {
        listVariableFonts: "https://raw.githubusercontent.com/fontsource/google-font-metadata/main/lib/data/variable.json",
        viewFont: "https://fonts.google.com/specimen/",
        listGoogleFonts: "https://www.googleapis.com/webfonts/v1/webfonts?key="
    };
    apiKey = "AIzaSyDdLownANYUxO2mKslgv5K4BXnbYSPrzVA";
    browserInstance;
    page;
    googleFontsList;
    googleFontsVariable;
    googleFontsMeta;

    googleFontsListAndMeta = [];
    constructor(chromiumInstance) {
        this.browserInstance = chromiumInstance;
    }
    async generateGoogleFontsList() {
        console.log(`${chalk.cyan.bold('Info:')} Step 1: Fetching a list of all available google fonts...`);
        try {
            await this.page.goto(`${this.urls.listGoogleFonts + this.apiKey}`);
        } catch (error) {
            console.log(`${chalk.red.bold('Error:')} Step 1 -- Failed: An error occurred while attempting to fetch a list of google fonts.`);
            throw error;
            return;
        }
        try {
            const googleFontsResponseJson = await this.getPageJson();
            if (googleFontsResponseJson.error) {
                console.log(`${chalk.red.bold('Error:')} Step 1 -- Failed: ${googleFontsResponseJson.error.message}!`);
                throw googleFontsResponseJson.error.message
                await this.closeBrowser();
                return;
            }
            console.log(`${chalk.green.bold('Success:')} Step 1 -- Completed: a list of google fonts has been acquired!`);
            this.googleFontsList = googleFontsResponseJson.items;
        } catch (error) {
            console.log(`${chalk.red.bold('Error:')} Step 1 -- Failed: An error occurred while attempting to extract a json file from the url:'${this.urls.listGoogleFonts + this.apiKey}'.`);
            throw error;
        }
    }
    async getPageJson() {
        const JSONContainerElement = await this.page.$('pre');
        const JSONString = await this.page.evaluate(el => el.textContent, JSONContainerElement)
        return (JSON.parse(JSONString));
    }
    async closeBrowser() {
        console.log(`${chalk.bgGreen.white.bold('Info:')} Closing browser instance...`);
        this.browserInstance.close();
    }
    async openPage() {
        console.log(`${chalk.cyan.bold('Status:')} Opening Page`);
        this.page = await this.browserInstance.newPage();
    }

    async fetchGoogleVariableFontsList() {
        console.log(`${chalk.cyan.bold('Info:')} Step 2: Fetching a list of all variable google fonts...`);
        try {
            await this.page.goto(this.urls.listVariableFonts);
        } catch (error) {
            console.log(`${chalk.red.bold('Error:')} Step 2 --- Failed: The following error occurred while attempting to fetch a list of google variable fonts from the following url :'${this.urls.listVariableFonts}'.`);
            throw new error;
            return;
        }
        try {
            this.googleFontsVariable = await this.getPageJson();
        } catch (error) {
            console.log(`${chalk.red.bold('Error:')} Step 2 --- Failed: The following error occurred while attempting to acquire the variable font JSON data.`);
            throw new error;
            return;
        }
        console.log(`${chalk.green.bold('Success:')} Step 2 -- Completed: a list of google variable fonts has been acquired!`);
    }


    async formatGoogleFontData() {
        console.log(`${chalk.cyan.bold('Status:')} Now maping the google fonts to the variable fonts list...`);
        this.googleFontsList = this.googleFontsList.map((font) => {
            font.id = this.getFontId(font.family);
            font.isVariable = false;
            font.loaded = false;
            font.allVariantsLoaded = false;
            if (this.googleFontsVariable[font.id]) {
                font.isVariable = true;
                return { ...font, ...this.googleFontsVariable[font.id] }
            }
            return font;
        });
    }
    getFontId(fontFamily) {
        return fontFamily.replace(/\s+/g, "-").toLowerCase();
    }
    getGoogleFontsList() {
        return this.googleFontsList;
    }

    async getFontsMetaData() {
        console.log(`${chalk.cyan.bold('Info:')} Step 3: Attempting to acquire the meta data of each font on the list...`);
        const progressBar = new cliProgress.SingleBar({
            format: 'Scrapping Progress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} Fonts || Duration: {duration_formatted}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: false        
        }, cliProgress.Presets.shades_classic);
        const googleFontsList=this.getGoogleFontsList();
        const googleFontsCount=googleFontsList.length;

        progressBar.start(googleFontsList.length, 0);
        let i=0;
        for (const font of googleFontsList) {
            await this.getFontMeta(font);
            if(i===googleFontsCount) { 
                console.log(`${chalk.green.bold('Success:')} Step 4 -- Completed: Finished scrapping the meta data of all google fonts.`);
                this.saveData();    
            }
            i++;
            progressBar.update(i);
        }
    }
    async getFontMeta(font) {
        try {
            let url = `${this.urls.viewFont + font.family.replace(" ", "+")}#about`;
            await this.page.goto(url);
        }
        catch (error) {
            console.log(`An error occurred while attempting to visit the page (${url})...`);
            throw error;
        }
        let fontMeta = {
            description: [],
            authors: [],
            license: {
                name: null,
                url: null
            }
        };
        // Wait for sections to load
        await this.page.waitForSelector('section#about');
        await this.page.waitForSelector('section#license');

        //  About Font
        const fontDesignerSectionElements = await this.page.$$('section#about .specimen__designers gf-designer');

        fontMeta = await this.page.evaluate(() => {
            // Font License
            const anchor = document.querySelector("section#license .license__paragraph a");
            const license = {
                name: anchor.textContent,
                url: anchor.href,
            }
            // Font Info
            const p = document.querySelectorAll("section#about .specimen__about-description p");
            const description = Array.from(p).map(({ innerHTML }) => (innerHTML));

            // Author Info
            const authorBoxes = document.querySelectorAll("section#about .specimen__designers gf-designer");
            const authors = Array.from(authorBoxes).map((ele) => {
                const avatarEle=ele.querySelector('img');
                const roleEle=ele.querySelector('.mat-text--secondary');
                const bioEle=ele.querySelector('.designer-bio');
                return {
                    avatar: (avatarEle) ? avatarEle.src : null,
                    name:ele.querySelector('[itemprop="name"]').textContent,
                    role: (roleEle) ? roleEle.textContent : null,
                    bio: (bioEle) ? bioEle.innerHTML : null
                }
            });
            return { license, description, authors };
        });
        this.googleFontsListAndMeta.push({
            ...this.googleFontsList.find(gFont => gFont.id === font.id), fontMeta
        });
    }
    saveData() {
        console.log(`${chalk.cyan.bold('Info:')} Step 5: Attempting to save all the meta data to a file by the name of 'fonts.json'...`);
        const stringifyData = JSON.stringify(this.getGoogleFontsListAndMeta());
        const date = new Date();
        const timeStamp = date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear();
        fs.unlinkSync(`./data/*.json`);
        fs.writeFileSync(`./data/fonts__${timeStamp}.json`, stringifyData);
        console.log(`${chalk.green.bold('Success:')} Step 5 -- Completed: Data successfully saved to file.`);
    }
    getGoogleFontsListAndMeta() {
        return this.googleFontsListAndMeta;
    }
}



module.exports = Scrapper;