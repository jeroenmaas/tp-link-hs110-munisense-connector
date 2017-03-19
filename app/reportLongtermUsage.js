var Cache = require('sync-disk-cache');
var cache = new Cache('sensor-values');
// Make sure our test node doesn't use values from last unittest
cache.set("1234567890", JSON.stringify({baseValue: 0, lastValue: 0}));

function reportLongtermUsage(usageInKWH, uniqueIdentifier) {
    var baseValue = 0; // Last reset of base. So last total value = base + lastValue
    var lastValue = 0; // Last value before new value
    if(cache.has("" + uniqueIdentifier)) {
        var result = JSON.parse(cache.get("" + uniqueIdentifier).value);
        baseValue = result.baseValue;
        lastValue = result.lastValue;
    }

    // RESET time. The unit has probably been removed from power.
    if(usageInKWH < lastValue) {
        baseValue += lastValue;
    }
    lastValue = usageInKWH;

    cache.set("" + uniqueIdentifier, JSON.stringify({baseValue: baseValue, lastValue: lastValue}));
    return Math.round((baseValue + lastValue) * 100) / 100;
}

exports.reportLongtermUsage = reportLongtermUsage;