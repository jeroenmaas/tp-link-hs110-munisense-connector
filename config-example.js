var Config = {
    munisense: {
        vendor: "",
        secret: "",
        gateway_ip: ""
    },
    local: {
        devices: [
            {
                name: "optional, for example TV",
                ip: "123.123.123.123",
                eui64: "0000:0000:0000:0000"
            },
            {
                ip: "",
                eui64: ""
            }
        ]
    },
    reporting: {
        usage_measurement_interval_in_ms: 1000,
        total_usage_measurement_interval_ms: 1000 * 60 * 15,
        report_to_munisense_frequency: 1000 * 15
    },
    debug: {
        memory_dump: {
            enabled: false,
            interval_in_ms: 1000*60*30,
            location: function() {
                return '/var/local/' + new Date().toISOString().replace(/:/g, '.') + '.heapsnapshot';
            }
        }
    }
};

exports.Config = Config;