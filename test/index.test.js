const { readFileSync, readFile } = require('fs');
const assert = require('assert');
const expect = require('expect');



describe('The JSON File', function () {
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
        expect(fontsJSON.length).toBeGreaterThan(1100);
    });
});
