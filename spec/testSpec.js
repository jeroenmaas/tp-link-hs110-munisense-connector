var reportLongtermUsage = require('../app/reportLongtermUsage.js').reportLongtermUsage;

describe("Tests", function() {
    it("LongtermValueCache", function(done) {
        expect(reportLongtermUsage(0.1, 1234567890)).toBe(0.1);
        expect(reportLongtermUsage(0.2, 1234567890)).toBe(0.2);
        expect(reportLongtermUsage(0.3, 1234567890)).toBe(0.3);
        expect(reportLongtermUsage(0.4, 1234567890)).toBe(0.4);
        expect(reportLongtermUsage(0.5, 1234567890)).toBe(0.5);
        expect(reportLongtermUsage(0.6, 1234567890)).toBe(0.6);
        expect(reportLongtermUsage(0.1, 1234567890)).toBe(0.7);
        expect(reportLongtermUsage(0.2, 1234567890)).toBe(0.8);
        expect(reportLongtermUsage(0.3, 1234567890)).toBe(0.9);
        expect(reportLongtermUsage(0.4, 1234567890)).toBe(1);
        expect(reportLongtermUsage(0.2, 1234567890)).toBe(1.2);
        expect(reportLongtermUsage(0.5, 1234567890)).toBe(1.5);
        expect(reportLongtermUsage(1.3, 1234567890)).toBe(2.3);
        expect(reportLongtermUsage(2.4, 1234567890)).toBe(3.4);
        done();
    });
});