const { redisClient } = require("../../config/redisClient.js");

const Advertisement = require("../../model/advertisementSetting.model.js");
const deviceRefferalModel = require("../../model/deviceRefferal.model.js");

const SETTING_TYPES = {
    NORMAL: "normal",
    MARKETING: "marketing",
};

const getRedisKey = (settingType, packageName) =>
    settingType === SETTING_TYPES.MARKETING
        ? `advertisement:${packageName}`
        : `advertisement:normal:${packageName}`;

const getReferralRedisKey = (packageName) =>
    `advertisement:referral:${packageName}`;

const getReferralKeys = (referralKey) =>
    typeof referralKey === "string"
        ? [
            ...new Set(
                referralKey
                    .split(",")
                    .map((key) => key.trim())
                    .filter(Boolean)
            ),
        ]
        : [];

const normalizeReferralKey = (referralKey) =>
    getReferralKeys(referralKey).join(",");

const getRequestedSettingType = (body) => {
    const value = body.settingType ?? body.type ?? body.userType;

    if (typeof value !== "string") {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (
        ["marketing", "marketinguser", "marketing_user"].includes(
            normalizedValue
        )
    ) {
        return SETTING_TYPES.MARKETING;
    }

    if (normalizedValue === SETTING_TYPES.NORMAL) {
        return SETTING_TYPES.NORMAL;
    }

    return null;
};

const SNAPSHOT_CONFIG = {
    [SETTING_TYPES.NORMAL]: {
        settingField: "normalSetting",
        snapshotField: "normalSettingSnapshot",
    },
    [SETTING_TYPES.MARKETING]: {
        settingField: "marketingUserSetting",
        snapshotField: "marketingUserSettingSnapshot",
    },
};

const getSnapshotConfig = (body) => {
    const settingType = getRequestedSettingType(body);

    if (!settingType) {
        return null;
    }

    return {
        settingType,
        ...SNAPSHOT_CONFIG[settingType],
    };
};

const validateSettings = (settings, fieldName) => {
    if (!Array.isArray(settings)) {
        return `${fieldName} must be an array`;
    }

    for (const setting of settings) {
        if (typeof setting?.key !== "string" || !setting.key.trim()) {
            return `Key is required in ${fieldName}`;
        }

        if (
            Object.prototype.hasOwnProperty.call(setting, "value") &&
            setting.value !== null &&
            !["string", "boolean", "number"].includes(typeof setting.value)
        ) {
            return `Value in ${fieldName} must be a string, boolean, number, or null`;
        }
    }

    return null;
};

const cleanSettings = (settings) =>
    settings.map((setting) => ({
        key: setting.key.trim(),
        value:
            setting.value === undefined || setting.value === null
                ? ""
                : String(setting.value).trim(),
    }));

const copyAdvertisementSettings = (settings) =>
    settings.map((setting) => ({
        key: setting.key,
        value: setting.value,
    }));

const turnTrueAdvertisementSettingsOff = (settings) =>
    settings.map((setting) => ({
        key: setting.key,
        value:
            setting.value === true || setting.value === "true"
                ? "false"
                : setting.value,
    }));

const getSettingsFromBody = (body, { isUpdate = false } = {}) => {
    const hasNormalSetting = Object.prototype.hasOwnProperty.call(
        body,
        "normalSetting"
    );
    const hasMarketingUserSetting = Object.prototype.hasOwnProperty.call(
        body,
        "marketingUserSetting"
    );
    const hasSettings = Object.prototype.hasOwnProperty.call(body, "settings");
    const requestedType = getRequestedSettingType(body);
    const suppliedType = body.settingType ?? body.type ?? body.userType;

    if (hasSettings && suppliedType !== undefined && !requestedType) {
        return { error: "settingType must be either normal or marketing" };
    }

    const result = {};

    if (hasNormalSetting) {
        result.normalSetting = body.normalSetting;
    }

    if (hasMarketingUserSetting) {
        result.marketingUserSetting = body.marketingUserSetting;
    }

    // Also support a request that updates only one group:
    // { settingType: "normal|marketing", settings: [...] }.
    if (hasSettings) {
        if (requestedType === SETTING_TYPES.MARKETING) {
            result.marketingUserSetting = body.settings;
        } else {
            result.normalSetting = body.settings;
        }
    }

    if (Object.keys(result).length === 0) {
        return {
            error: "normalSetting, marketingUserSetting, or settings is required",
        };
    }

    if (!isUpdate && !("normalSetting" in result)) {
        result.normalSetting = [];
    }

    if (!isUpdate && !("marketingUserSetting" in result)) {
        result.marketingUserSetting = [];
    }

    for (const [fieldName, settings] of Object.entries(result)) {
        const error = validateSettings(settings, fieldName);

        if (error) {
            return { error };
        }

        result[fieldName] = cleanSettings(settings);
    }

    return { settings: result };
};

const getRedisValue = (advertisement, settingType) => ({
    appName: advertisement.appName,
    packageName: advertisement.packageName,
    status: advertisement.status,
    settings:
        settingType === SETTING_TYPES.MARKETING
            ? advertisement.marketingUserSetting
            : advertisement.normalSetting,
});

const storeAdvertisementInRedis = async (advertisement) => {
    await Promise.all([
        redisClient.set(
            getRedisKey(SETTING_TYPES.NORMAL, advertisement.packageName),
            JSON.stringify(getRedisValue(advertisement, SETTING_TYPES.NORMAL))
        ),
        redisClient.set(
            getRedisKey(SETTING_TYPES.MARKETING, advertisement.packageName),
            JSON.stringify(getRedisValue(advertisement, SETTING_TYPES.MARKETING))
        ),
        redisClient.set(
            getReferralRedisKey(advertisement.packageName),
            advertisement.referralKey || "gclid"
        )
    ]);
};

const getPackageReferralKey = async (packageName) => {
    const redisKey = getReferralRedisKey(packageName);
    const cachedReferralKey = await redisClient.get(redisKey);

    if (cachedReferralKey) {
        return cachedReferralKey;
    }

    const advertisement = await Advertisement.findOne({ packageName });
    const referralKey =
        typeof advertisement?.referralKey === "string" &&
            advertisement.referralKey.trim()
            ? advertisement.referralKey.trim()
            : "gclid";

    if (advertisement) {
        await redisClient.set(redisKey, referralKey);
    }

    return referralKey;
};

exports.storeAdvertisement = async (req, res, next) => {
    try {
        const { appName, packageName, status } = req.body;
        const referralKey = req.body.referralKey ?? req.body.refferalKey;
        const normalizedReferralKey = normalizeReferralKey(referralKey);

        if (!appName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "App name is required",
            });
        }

        if (!packageName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Package name is required",
            });
        }

        if (
            referralKey !== undefined &&
            !normalizedReferralKey
        ) {
            return res.status(400).json({
                success: false,
                message: "referralKey must be a non-empty string",
            });
        }

        const parsedSettings = getSettingsFromBody(req.body);

        if (parsedSettings.error) {
            return res.status(400).json({
                success: false,
                message: parsedSettings.error,
            });
        }

        const trimmedAppName = appName.trim();
        const trimmedPackageName = packageName.trim();

        // Check same packageName already exists
        const existingAdvertisement = await Advertisement.findOne({
            packageName: trimmedPackageName,
        });

        if (existingAdvertisement) {
            return res.status(400).json({
                success: false,
                message: "Advertisement with this package name already exists",
            });
        }

        // Create new advertisement
        const advertisement = await Advertisement.create({
            appName: trimmedAppName,
            packageName: trimmedPackageName,
            referralKey:
                normalizedReferralKey || "gclid",
            status: typeof status === "boolean" ? status : true,
            ...parsedSettings.settings,
        });

        await storeAdvertisementInRedis(advertisement);

        return res.status(200).json({
            success: true,
            message: "Advertisement configuration saved successfully",
            data: advertisement,
        });

    } catch (error) {
        console.error("Error storing advertisement:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save advertisement configuration",
            error: error.message,
        });
    }
};

exports.getAdvertisement = async (req, res, next) => {
    try {
        const search = req.query.search?.trim() || "";
        const status = req.query.status;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};

        if (search) {
            query.appName = {
                $regex: search,
                $options: "i",
            };
        }

        if (status === "true") {
            query.status = true;
        } else if (status === "false") {
            query.status = false;
        }

        const totalAdvertisements = await Advertisement.countDocuments(query);

        const advertisements = await Advertisement.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const packageNames = advertisements.map(
            (advertisement) => advertisement.packageName
        );

        const deviceCounts = await deviceRefferalModel.aggregate([
            {
                $match: {
                    packageName: { $in: packageNames },
                    $or: [
                        { isLauncherSet: true },
                        { isContinueButtonSet: true },
                    ],
                },
            },
            {
                // Count every device only once inside each package.
                $group: {
                    _id: {
                        packageName: "$packageName",
                        deviceId: "$deviceId",
                    },
                    isLauncherSet: {
                        $max: { $cond: ["$isLauncherSet", 1, 0] },
                    },
                    isContinueButtonSet: {
                        $max: { $cond: ["$isContinueButtonSet", 1, 0] },
                    },
                },
            },
            {
                $group: {
                    _id: "$_id.packageName",
                    isLauncherSetDeviceCount: { $sum: "$isLauncherSet" },
                    isContinueButtonSetDeviceCount: {
                        $sum: "$isContinueButtonSet",
                    },
                },
            },
        ]);

        const deviceCountMap = new Map(
            deviceCounts.map((count) => [count._id, count])
        );

        const advertisementsWithDeviceCounts = advertisements.map(
            (advertisement) => {
                const counts = deviceCountMap.get(advertisement.packageName);

                return {
                    ...advertisement,
                    isLauncherSetDeviceCount:
                        counts?.isLauncherSetDeviceCount || 0,
                    isContinueButtonSetDeviceCount:
                        counts?.isContinueButtonSetDeviceCount || 0,
                };
            }
        );

        return res.status(200).json({
            success: true,
            message: "Advertisement fetched successfully",
            data: advertisementsWithDeviceCounts,
            page,
            totalPages: Math.ceil(totalAdvertisements / limit),
            totalCount: totalAdvertisements,
        });

    } catch (err) {
        console.error("❌ getAdvertisement error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch advertisement configuration",
            error: err.message,
        });
    }
};

exports.takeAdvertisementSnapshot = async (req, res) => {
    try {
        const packageName = req.body.packageName?.trim();
        const snapshotConfig = getSnapshotConfig(req.body);

        if (!packageName) {
            return res.status(400).json({
                success: false,
                message: "Package name is required",
            });
        }

        if (!snapshotConfig) {
            return res.status(400).json({
                success: false,
                message: "settingType must be either normal or marketing",
            });
        }

        const { settingType, settingField, snapshotField } = snapshotConfig;

        const advertisement = await Advertisement.findOne({ packageName });

        if (!advertisement) {
            return res.status(404).json({
                success: false,
                message: "Advertisement configuration not found",
            });
        }

        if (advertisement[snapshotField]) {
            return res.status(409).json({
                success: false,
                message:
                    `A pending ${settingType} snapshot already exists for this package`,
                data: advertisement[snapshotField],
            });
        }

        advertisement[snapshotField] = {
            settings: copyAdvertisementSettings(
                advertisement[settingField]
            ),
            snapshotAt: new Date(),
        };
        advertisement[settingField] = turnTrueAdvertisementSettingsOff(
            advertisement[settingField]
        );

        await advertisement.save();
        await storeAdvertisementInRedis(advertisement);

        return res.status(200).json({
            success: true,
            message:
                `${settingType} advertisement snapshot created and true values disabled successfully`,
            data: {
                packageName: advertisement.packageName,
                settingType,
                snapshot: advertisement[snapshotField],
                settings: advertisement[settingField],
            },
        });
    } catch (error) {
        console.error("Error taking advertisement snapshot:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to take advertisement snapshot",
            error: error.message,
        });
    }
};

exports.applyAdvertisementSnapshot = async (req, res) => {
    try {
        const packageName = req.body.packageName?.trim();
        const snapshotConfig = getSnapshotConfig(req.body);

        if (!packageName) {
            return res.status(400).json({
                success: false,
                message: "Package name is required",
            });
        }

        if (!snapshotConfig) {
            return res.status(400).json({
                success: false,
                message: "settingType must be either normal or marketing",
            });
        }

        const { settingType, settingField, snapshotField } = snapshotConfig;

        const advertisement = await Advertisement.findOne({ packageName });

        if (!advertisement) {
            return res.status(404).json({
                success: false,
                message: "Advertisement configuration not found",
            });
        }

        if (!advertisement[snapshotField]) {
            return res.status(404).json({
                success: false,
                message:
                    `No pending ${settingType} snapshot found for this package`,
            });
        }

        const snapshotAt = advertisement[snapshotField].snapshotAt;

        // Fully replace only the selected array with its own snapshot.
        advertisement[settingField] = copyAdvertisementSettings(
            advertisement[snapshotField].settings
        );

        // Keep the snapshot until MongoDB and Redis contain the restored data.
        await advertisement.save();
        await storeAdvertisementInRedis(advertisement);

        advertisement[snapshotField] = null;
        await advertisement.save();

        return res.status(200).json({
            success: true,
            message:
                `${settingType} advertisement snapshot applied successfully`,
            data: {
                advertisement,
                settingType,
                appliedSnapshotAt: snapshotAt,
            },
        });
    } catch (error) {
        console.error("Error applying advertisement snapshot:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to apply advertisement snapshot",
            error: error.message,
        });
    }
};

exports.updateAdvertisement = async (req, res, next) => {
    try {
        const { id, appName, packageName, status } = req.body;
        const referralKey = req.body.referralKey ?? req.body.refferalKey;
        const normalizedReferralKey = normalizeReferralKey(referralKey);

        // Validate _id
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id is required",
            });
        }

        // Validate appName
        if (!appName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "App name is required",
            });
        }

        // Validate packageName
        if (!packageName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Package name is required",
            });
        }

        if (
            referralKey !== undefined &&
            !normalizedReferralKey
        ) {
            return res.status(400).json({
                success: false,
                message: "referralKey must be a non-empty string",
            });
        }

        const parsedSettings = getSettingsFromBody(req.body, {
            isUpdate: true,
        });

        if (parsedSettings.error) {
            return res.status(400).json({
                success: false,
                message: parsedSettings.error,
            });
        }

        const trimmedAppName = appName.trim();
        const trimmedPackageName = packageName.trim();

        // Find advertisement by _id
        const advertisement = await Advertisement.findById(id);

        if (!advertisement) {
            return res.status(404).json({
                success: false,
                message: "Advertisement configuration not found",
            });
        }

        // Check same packageName in another record
        const existingPackage = await Advertisement.findOne({
            packageName: trimmedPackageName,
            _id: { $ne: id },
        });

        if (existingPackage) {
            return res.status(400).json({
                success: false,
                message: "Advertisement with this package name already exists",
            });
        }

        const oldPackageName = advertisement.packageName;

        // Update MongoDB
        advertisement.appName = trimmedAppName;
        advertisement.packageName = trimmedPackageName;

        if (referralKey !== undefined) {
            advertisement.referralKey = normalizedReferralKey;
        }

        if (typeof status === "boolean") {
            advertisement.status = status;
        }

        for (const [fieldName, settings] of Object.entries(
            parsedSettings.settings
        )) {
            advertisement[fieldName] = settings;
        }

        await advertisement.save();

        if (oldPackageName !== advertisement.packageName) {
            await Promise.all([
                redisClient.del(
                    getRedisKey(SETTING_TYPES.NORMAL, oldPackageName)
                ),
                redisClient.del(
                    getRedisKey(SETTING_TYPES.MARKETING, oldPackageName)
                ),
                redisClient.del(
                    `advertisement:marketing:${oldPackageName}`
                ),
                redisClient.del(getReferralRedisKey(oldPackageName)),
            ]);
        }

        await storeAdvertisementInRedis(advertisement);

        return res.status(200).json({
            success: true,
            message: "Advertisement configuration updated successfully",
            data: advertisement,
        });

    } catch (error) {
        console.error("Error updating advertisement:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update advertisement configuration",
            error: error.message,
        });
    }
};


exports.getAdvertise = async (req, res, next) => {
    try {
        const { packageName, refferal_url, deviceId, isStage } = req.body;

        if (!packageName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "packageName is required",
            });
        }

        let selectedPackageName = packageName.trim();
        if (isStage == true) {
            selectedPackageName = "com.stage.tvanimespace";
        }

        const referralKey = await getPackageReferralKey(selectedPackageName);
        const referralKeys = getReferralKeys(referralKey);
        const isFromUserMarketing =
            typeof refferal_url === "string" &&
            referralKeys.some((key) => refferal_url.includes(key));

        let isFromReferral = isFromUserMarketing;

        if (deviceId) {
            const alreadyExist = await deviceRefferalModel.findOne({
                deviceId,
                packageName: selectedPackageName,
            });

            if (!alreadyExist) {
                await deviceRefferalModel.create({
                    deviceId,
                    packageName: selectedPackageName,
                    isFromReferral,
                    ...(refferal_url && { referralUrl: refferal_url }),
                });
            } else {
                // The first request permanently classifies this device/package.
                isFromReferral = alreadyExist.isFromReferral === true;
            }
        }

        const settingType = isFromReferral
            ? SETTING_TYPES.MARKETING
            : SETTING_TYPES.NORMAL;
        const key = getRedisKey(settingType, selectedPackageName);
        const packageData = await redisClient.get(key);
        const Package = packageData ? JSON.parse(packageData) : null;

        return res.status(200).json({
            success: true,
            message: "Advertisement fetched successfully",
            data: {
                ...Package,
                isFromReferral: true, // this is static true all time we managed based on config data
            },
        });
    } catch (err) {
        console.log("🚀 ~ err:", err)

        return res.status(500).json({
            success: false,
            message: "Failed to fetch advertisement configuration",
            error: err.message,
        });
    }
};

exports.storeAdvertisementInRedis = async (req, res) => {
    try {
        const refernceDoc = await Advertisement.findOne({ packageName: "com.stage.tvanimespace" });

        const normalSeetings = refernceDoc.normalSetting;
        const marketingSeetings = refernceDoc.marketingUserSetting;

        const mainDocument = await Advertisement.findOne({ packageName: "quick.math.calculator" });

        const normalSeetingsMain = mainDocument.normalSetting;
        const marketingSeetingsMain = mainDocument.marketingUserSetting;
        const mainMap = new Map();
        const mainMarketingMap = new Map();

        for (const normalS of normalSeetingsMain) {
            mainMap.set(normalS.key, normalS);
        }

        for (const marketingS of marketingSeetingsMain) {
            mainMarketingMap.set(marketingS.key, marketingS);
        }

        const MaininnerNotexistKeysNormal = []
        for (const normalS of normalSeetings) {
            if (!mainMap.has(normalS.key)) {
                MaininnerNotexistKeysNormal.push({
                    key: normalS.key,
                    value: normalS.value,
                })
            }
        }

        const MaininnerNotexistKeysMarketing = []
        for (const marketingS of marketingSeetings) {
            if (!mainMarketingMap.has(marketingS.key)) {
                MaininnerNotexistKeysMarketing.push({
                    key: marketingS.key,
                    value: marketingS.value,
                })
            }
        }

        const updatedDocument = await Advertisement.findOneAndUpdate({
            packageName: "quick.math.calculator"
        },
            {
                $push: {
                    normalSetting: {
                        $each: MaininnerNotexistKeysNormal
                    },
                    marketingUserSetting: {
                        $each: MaininnerNotexistKeysMarketing
                    }
                }
            },
            {
                new: true,
                runValidators: true,
            }
        )

        await storeAdvertisementInRedis(updatedDocument);

        const key = getRedisKey(SETTING_TYPES.NORMAL, "quick.math.calculator");
        const packageData = await redisClient.get(key);
        const Package = packageData ? JSON.parse(packageData) : null;
        console.log("🚀 ~ Package:", Package.settings.length)

        const keyM = getRedisKey(SETTING_TYPES.MARKETING, "quick.math.calculator");
        const packageDataM = await redisClient.get(keyM);
        const PackageM = packageDataM ? JSON.parse(packageDataM) : null;
        console.log("🚀 ~ Package M:", PackageM.settings.length)

        return res.status(200).json({
            success: true,
            message: "Advertisement fetched successfully",
            data: {
                MaininnerNotexistKeysNormal,
                MaininnerNotexistKeysMarketing,
                referncekeys: normalSeetings.length,
                refernceMarketingKeys: marketingSeetings.length,
                mainKeys: normalSeetingsMain.length,
                mainMarketingKeys: marketingSeetingsMain.length,
                addedKeys: MaininnerNotexistKeysNormal.length,
                addedMarketingKeys: MaininnerNotexistKeysMarketing.length,
                totalKeys: updatedDocument.normalSetting.length,
                totalMarketingKeys: updatedDocument.marketingUserSetting.length,
                totalMainKeys: updatedDocument.normalSetting.length + updatedDocument.marketingUserSetting.length
            },
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,

        });
    }
}

exports.LauncherSet = async (req, res) => {
    try {
        const { packageName, deviceId } = req.body;
        console.log("🚀 ~ packageName:", packageName)
        console.log("🚀 ~ deviceId:", deviceId)

        if (!packageName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Package name is required",
            });
        }

        if (!deviceId?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Device id is required",
            });
        }

        const result = await deviceRefferalModel.findOneAndUpdate(
            {
                packageName,
                deviceId,
            },
            {
                $set: {
                    isLauncherSet: true,
                },
            }
        )
        console.log("🚀 ~ result:", result)

        return res.status(200).json({
            success: true,
            message: "Launcher set successfully",
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}


exports.setContinueButton = async (req, res) => {
    try {
        const { packageName, deviceId } = req.body;
        console.log("🚀 ~ packageName:", packageName)
        console.log("🚀 ~ deviceId:", deviceId)

        if (!packageName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Package name is required",
            });
        }

        if (!deviceId?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Device id is required",
            });
        }

        const result = await deviceRefferalModel.findOneAndUpdate(
            {
                packageName,
                deviceId,
            },
            {
                $set: {
                    isContinueButtonSet: true,
                },
            }
        )
        console.log("🚀 ~ result:", result)

        return res.status(200).json({
            success: true,
            message: "continue button set successfully",
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}
