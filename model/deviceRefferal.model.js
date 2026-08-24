const mongoose = require("mongoose");

const deviceRefferal = new mongoose.Schema(
    {
        deviceId: {
            type: String,
            required: true
        },
        packageName: {
            type: String,
            required: true
        },
        isFromReferral: {
            type: Boolean,
            required: true,
            default: false
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "deviceRefferal",
    deviceRefferal
);