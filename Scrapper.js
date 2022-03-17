const fs = require('fs');
const chalk = require('chalk');
const { Cluster } = require('puppeteer-cluster');
const puppeteer = require('puppeteer');


class Scrapper {
    urls = {
        listVariableFonts: "https://raw.githubusercontent.com/fontsource/google-font-metadata/main/lib/data/variable.json",
        viewFont: "https://fonts.google.com/specimen/",
        listGoogleFonts: "https://www.googleapis.com/webfonts/v1/webfonts?key="
    };
    apiKey = process.env.GOOGLE_API_KEY;
    nonConcurrentBrowser = {
        browserInstance: null,
        page: null
    };
    skippedFonts = [];
    googleFontsList;
    googleFontsVariable;

    googleFontsMeta=[];
    googleFontsListAndMeta = [];

    cluster;
    errors = [];


    async init() {
        console.log(`${chalk.cyan.bold('Info:')} Launching the non concurrent browser.`);
        this.nonConcurrentBrowser.browserInstance = await puppeteer.launch();
        this.nonConcurrentBrowser.page = await this.nonConcurrentBrowser.browserInstance.newPage();
    }
    async initCluster(headless=true) {
        console.log(`${chalk.green.bold('Info:')} Launching the concurrent browser cluster.`);
        
        
        this.cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 10,
            monitor: (process.env.IS_UNDER_DEVELOPMENT) ?  true: false,
            puppeteerOptions: {
                headless,
                defaultViewport: {
                    width: 1920,
                    height: 1280,
                }
            }
        });
    }
    async generateGoogleFontsList() {
        console.log(`${chalk.cyan.bold('Info:')} Step 1: Fetching a list of all available google fonts...`);

        await this.nonConcurrentBrowser.page.goto(`${this.urls.listGoogleFonts + this.apiKey}`);
        const JSONResponse = await this.nonConcurrentBrowser.page.evaluate(() => {
            return (JSON.parse(document.getElementsByTagName('pre')[0].textContent));
        });
        if (JSONResponse.error) {
            console.log(`${chalk.red.bold('Error:')} Step 1 -- Failed: ${JSONResponse.error.message}!`);
            throw JSONResponse.error.message
            return;
        }
        this.googleFontsList = JSONResponse.items;
    }

    async fetchGoogleVariableFontsList() {
        console.log(`${chalk.cyan.bold('Info:')} Step 2: Fetching a list of variable fonts...`);
        await this.nonConcurrentBrowser.page.goto(`${this.urls.listVariableFonts}`);
        this.googleFontsVariable = await this.nonConcurrentBrowser.page.evaluate(() => {
            return (JSON.parse(document.getElementsByTagName('pre')[0].textContent));
        });
        await this.closeNonConcurrentBrowser();
    }
    formatGoogleFontData() {
        console.log(`${chalk.cyan.bold('Info:')} Step 3: Mapping the google fonts list to the variable fonts list...`);
        let font;
        this.googleFontsList = this.googleFontsList.map((fontOriginal) => {
            const { family, subsets, ...others } = fontOriginal;
            font = {
                ...others,
                family,
                id: this.getFontId(family),
                providers: "google",
                isVariable: false,
                loaded: false,
                allVariantsLoaded: false,
                scripts: subsets
            };
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

    async testRun() {
        this.googleFontsList = [
            {
                "family": "Noto Sans",
                "variants": ["regular", "italic"],
                "subsets": ["latin"],
                "version": "v20",
                "lastModified": "2022-01-27",
                "category": "sans-serif",
                "kind": "webfonts#webfont",
                "id": "notosans",
                "isVariable": false,
                "loaded": false,
                "allVariantsLoaded": false,
                "fontMeta": { "description": [], "authors": [], "license": {} }
            },
            {
                "family": "Noto Sans Display",
                "variants": ["regular", "italic"],
                "subsets": ["latin"],
                "version": "v20",
                "lastModified": "2022-01-27",
                "category": "sans-serif",
                "kind": "webfonts#webfont",
                "id": "notosansdisplay",
                "isVariable": false,
                "loaded": false,
                "allVariantsLoaded": false,
                "fontMeta": { "description": [], "authors": [], "license": {} }
            }
        ];
        await this.getFontsMetaData();
    }
    async setTask() {
        this.cluster.on('taskerror', (err, data) => {
            this.logError(`Error crawling ${(typeof data === "string") ? data : data.url}: ${err.message}`);
        });
        await this.cluster.task(async ({ page, data }) => {
            await page.setRequestInterception(true);
            page.on("request", (request) => {
                if (
                    ["image", "font", "manifest", "media"].includes(request.resourceType()) ||
                    request.url().includes("analytics")
                ) {
                    return request.abort();
                }
                return request.continue();
            });
            await page.goto(data.url, {
                waitUntil: 'networkidle0'
            });

            let fontMeta = await page.evaluate(() => {
                if (!(document.querySelector('gf-sticky-navbar'))) {
                    return {
                        redirectURL: document.querySelector('gf-specimen-navigation').querySelectorAll("a")[1].href
                    }
                }
                //  About Font
                data = () => {
                    // Font License                    
                    const anchor = document.querySelector("section#license .license__paragraph a");
                    const license = {
                        name: anchor.textContent,
                        url: anchor.href,
                    }
                    // Font Info
                    const description = Array.from(document.querySelectorAll("section#about .specimen__about-description p")).map(({ innerHTML }) => (innerHTML));

                    // Author Info
                    const authorBoxes = document.querySelectorAll("section#about .specimen__designers gf-designer");
                    const authors = Array.from(authorBoxes).map((ele) => {
                        const avatarEle = ele.querySelector('img');
                        const roleEle = ele.querySelector('.mat-text--secondary');
                        const bioEle = ele.querySelector('.designer-bio');
                        return {
                            avatar: (avatarEle) ? avatarEle.src : null,
                            name: ele.querySelector('[itemprop="name"]').textContent,
                            role: (roleEle) ? roleEle.textContent : null,
                            bio: (bioEle) ? bioEle.innerHTML : null
                        }
                    });
                    return { license, description, authors };
                };
                return data();

            });

            if (fontMeta.hasOwnProperty("redirectURL")) {
                await page.goto(fontMeta.redirectURL, {
                    waitUntil: "networkidle2",
                });
                let response = await page.evaluate(() => {
                    const anchor = document.querySelector("aside.about__license a");
                    const license = {
                        name: anchor.textContent,
                        url: anchor.href,
                    };

                    // Font Info
                    const description = Array.from(document.querySelectorAll("article.about__article p"))
                        .map(({ innerHTML }) => (innerHTML));
                    return {
                        license,
                        description
                    };
                });
                delete fontMeta.redirectURL;
                fontMeta = { ...fontMeta, ...response };
            }
            fontMeta.id=data.font.id;
            this.googleFontsMeta.push(fontMeta);
        });
    }
    async getFontsMetaData() {
        console.log(`${chalk.cyan.bold('Info:')} Step 4: Attempting to parse each font on the list...`);
        const googleFontsList = this.getGoogleFontsList();
        for (let i = 0; i < googleFontsList.length; i++) {
            const font = googleFontsList[i];
            this.cluster.queue({
                url: this.urls.viewFont + `${font.family.replace(/ /g, "+")}`,
                font: font
            });
        }
        await this.cluster.idle();
    }
    async closeNonConcurrentBrowser() {
        await this.nonConcurrentBrowser.browserInstance.close();
    }
    async saveAndExit() {
        await this.cluster.close();
        this.saveData();
    }
    logError(error) {
        this.errors.push(error);
    }
    writeErrorsToDisk() {
        if (this.errors.length === 0) return;
        const encodedErrors = JSON.stringify(this.errors);
        fs.writeFileSync(`./logs/error-log.json`, encodedErrors);
    }
    async testPage() {
        let testUrl = 'https://fonts.google.com/specimen/Noticia+Text';
        console.log(`Testing the url '${testUrl}'`);
        this.pages.main.goto(testUrl);
        await this.pages.main.waitForSelector('section#rssed').catch(
            (error) => {
                console.log('Timeout exceeded, starting again');
                let runAgain = async () => {
                    await this.testPage();
                }
                runAgain();
            }
        );
    }

    saveData() {
        console.log(`${chalk.cyan.bold('Info:')} Step 5: Attempting to save all the meta data to a file by the name of 'fonts.json'...`);
        const fontsJSONString     = JSON.stringify(this.googleFontsList);
        const fontsMetaJSONString = JSON.stringify(this.googleFontsMeta);
        fs.writeFileSync(`./data/fonts.json`, fontsJSONString);
        fs.writeFileSync(`./data/fonts-meta.json`, fontsMetaJSONString);
        if (this.errors.length) {
            console.log("The following errors occured while running the scrapper.\n", this.errors)
        }
    }
    getGoogleFontsListAndMeta() {
        return this.googleFontsListAndMeta;
    }
    async getPageJson() {
        return (JSON.parse(document.getElementsByTagName('pre')[0].textContent));
    }
}



module.exports = Scrapper;