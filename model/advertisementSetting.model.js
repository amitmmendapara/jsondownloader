const mongoose = require("mongoose");

const advertisementSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true,
        },

        value: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
            validate: {
                validator: (value) =>
                    value === null ||
                    ["string", "boolean", "number"].includes(typeof value),
                message:
                    "Setting value must be a string, boolean, number, or null",
            },
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
