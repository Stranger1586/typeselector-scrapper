const { readFileSync, readFile } = require('fs');
const assert = require('assert');
const expect = require('expect.js');



describe('The google\'s fonts list file.', function () {
    let fontsJSON;
    before(() => {
        try {
            fontsJSON=readFileSync('./data/fonts.json', {
                encoding: 'utf8'
            });
        } catch (error) {
            fontsJSON=false;
        }
    });
    it('Should be found within the ./data/ directory under the name of "fonts.json".', () => {
        assert.notEqual(fontsJSON, false);
    });

    it('Should contain a JSON object', () => {
        try {
            fontsJSON=JSON.parse(fontsJSON);
        } catch (error) {
            assert.ok(false, 'error');
        }
        assert.equal(typeof fontsJSON, "object")
    });
    it('Contain at least 1100 fonts.', () => {
        expect(fontsJSON.length).to.be.greaterThan(1100)
    });
});


describe('The google\'s fonts meta data file.', function () {
    let fontsMetaJSON;
    before(() => {
        try {
            fontsMetaJSON=readFileSync('./data/fonts-meta.json', {
                encoding: 'utf8'
            });
        } catch (error) {
            fontsMetaJSON=false;
        }
    });
    it('Should be found within the ./data/ directory under the name of "fonts-meta.json".', () => {
        assert.notEqual(fontsMetaJSON, false);
    });

    it('Should contain a JSON object', () => {
        try {
            fontsMetaJSON=JSON.parse(fontsMetaJSON);
        } catch (error) {
            assert.ok(false, 'error');
        }
        assert.equal(typeof fontsMetaJSON, "object")
    });
    it('Contain at least 1100 fonts.', () => {
        expect(fontsMetaJSON.length).to.be.greaterThan(1100)
    });
});
