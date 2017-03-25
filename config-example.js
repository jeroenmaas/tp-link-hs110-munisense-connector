var Config = {
    munisense: {
        vendor: "",
        secret: "",
        gateway_ip: ""
    },
    local: {
        devices: {
            "boiler": {
                ip: "",
                eui64: ""
            },
            "tv": {
                ip: "",
                eui64: ""
            }
        }
    },
    reporting: {
        usage_measurement_interval_in_ms: 1000,
        total_usage_measurement_interval_ms: 1000 * 60 * 15,
        report_to_munisense_frequency: 1000 * 15
    }
};

exports.Config = Config;