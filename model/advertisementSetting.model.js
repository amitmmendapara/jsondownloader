const mongoose = require("mongoose");

const advertisementSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true,
        },

        value: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const advertisementSchema = new mongoose.Schema(
    {
        appName: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        packageName: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        referralKey: {
            type: String,
            required: true,
            trim: true,
        },

        // Whole package ON/OFF
        status: {
            type: Boolean,
            default: true,
        },

        normalSetting: {
            type: [advertisementSettingSchema],
            default: [],
        },

        marketingUserSetting: {
            type: [advertisementSettingSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "Advertisement",
    advertisementSchema
);
