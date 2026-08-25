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

const advertisementSnapshotSchema = new mongoose.Schema(
    {
        settings: {
            type: [advertisementSettingSchema],
            default: [],
        },
        snapshotAt: {
            type: Date,
            required: true,
            default: Date.now,
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

        normalSettingSnapshot: {
            type: advertisementSnapshotSchema,
            default: null,
        },

        marketingUserSettingSnapshot: {
            type: advertisementSnapshotSchema,
            default: null,
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
