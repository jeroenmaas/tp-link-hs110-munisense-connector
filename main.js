var JOA = require('./lib/joa.js');
var reportLongtermUsage = require('./app/reportLongtermUsage').reportLongtermUsage;
const Hs100Api = require('hs100-api');
var Config = require('./config').Config;
var devices = Config.local.devices;
var plugs = [];
const client = new Hs100Api.Client();

JOA("https://joa3.munisense.net/");
JOA.debug = false;

JOA.headers({
    attribute: {
        vendor: Config.munisense.vendor,
        time: true,
        hash: true,
        secret: Config.munisense.secret
    },
    gatewayIdentifier: Config.munisense.gateway_ip
});

for (var key in devices) {
    var device = devices[key];
    plugs.push({eui64: device.eui64, plug: client.getPlug({host: device.ip, timeout: 5000})});
}

setInterval(function () {
    if (JOA.getMessages().length == 0) {
        console.warn("No messages in buffer to send to Munisense. Abort");
        return;
    }

    JOA.post({
        clear: true,
        clearOnlySuccess: false
    }, function (err, response, messages) {
        if (err) {
            console.log("%c Oops an error occured: ", "background: #f00; color: #fff; font-size: 18px");
            console.log(err);
        }

        if (response) {
            console.log("Reported sensor values to Munisense");
            // console.log("What the backoffice returned: ");
            // console.log(response.parsed);
            // console.log("The messages that were sent: ");
            // console.log(messages.parsed);
        }
    });
}, Config.reporting.report_to_munisense_frequency);

// Get the sensor data and create a ZCL report
setInterval(function () {
    for (var key in plugs) {
        var device = plugs[key];
        var plug = device.plug;
        var eui64 = device.eui64;
        (function (eui64) {
            plug.getConsumption().then(function (results) {
                JOA.addZCLReport(eui64, null, null, "0x9404", "0x0004", "0x21", Date.now(), "" + Math.round(results.get_realtime.power));
            });
        })(eui64);
    }
}, Config.reporting.usage_measurement_interval_in_ms);

// Every 15 minutes we want to know the total kwh
setInterval(function () {
    for (var key in plugs) {
        var device = plugs[key];
        var plug = device.plug;
        var eui64 = device.eui64;
        (function (eui64) {
            plug.getConsumption().then(function (results) {
                var totalKWHToday = results.get_realtime.total;
                var result = reportLongtermUsage(totalKWHToday, Config.local.device_ip);
                JOA.addZCLReport(eui64, null, null, "0x9404", "0x0001", "0x21", Date.now(), "" + Math.round(result * 1000));
            });
        })(eui64);
    }
}, Config.reporting.total_usage_measurement_interval_ms);

if(Config.debug.memory_dump.enabled) {
    var heapdump = require('heapdump');

    setInterval(function () {
        var loc = Config.debug.memory_dump.location();
        console.log("Writing snapshot to "  + loc);
        heapdump.writeSnapshot(loc);
    }, Config.debug.memory_dump.interval_in_ms);
}

