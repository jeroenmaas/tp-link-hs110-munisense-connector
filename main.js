var JOA = require('./lib/joa.js');
var reportLongtermUsage = require('./app/reportLongtermUsage').reportLongtermUsage;
const Hs100Api = require('hs100-api');
var Config = require('./config').Config;

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

setInterval(function() {
    if(JOA.getMessages().length == 0) {
        console.warn("No messages in buffer to send to Munisense. Abort");
        return;
    }

    JOA.post({
        clear: true,
        clearOnlySuccess: false
    }, function(err, response, messages) {
        if(err) {
            console.log("%c Oops an error occured: ", "background: #f00; color: #fff; font-size: 18px");
            console.log(err);
        }

        if(response) {
            console.log("Reported sensor values to Munisense");
            // console.log("What the backoffice returned: ");
            // console.log(response.parsed);
            // console.log("The messages that were sent: ");
            // console.log(messages.parsed);
        }
    });
}, Config.reporting.report_to_munisense_frequency);

const client = new Hs100Api.Client();
const plug = client.getPlug({host: Config.local.device_ip, timeout: 5000});

setInterval(function() {
    plug.getConsumption().then(function(results) {
        JOA.addZCLReport(Config.munisense.node_eui64, null, null, "0x9404", "0x0004", "0x21", Date.now(), "" + Math.round(results.get_realtime.power));
    });
}, Config.reporting.usage_measurement_interval_in_ms);

// Every 15 minutes we want to know the total kwh
setInterval(function() {
    plug.getConsumption().then(function(results) {
        var totalKWHToday = results.get_realtime.total;
        var result = reportLongtermUsage(totalKWHToday, Config.local.device_ip);
        JOA.addZCLReport(Config.munisense.node_eui64, null, null, "0x9404", "0x0000", "0x21", Date.now(), "" + Math.round(result));
    });
}, Config.reporting.total_usage_measurement_interval_ms);