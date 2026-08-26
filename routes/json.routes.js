var express = require("express");
var router = express.Router();
var JsonController = require("../controller/v1/json.controller.js");
var {
    adminLogin,
    requireAdminAuth,
} = require("../middleware/adminAuth.middleware.js");

router.post(
    "/adminLogin",
    adminLogin,
);

router.post(
    "/storeAdvertisement",
    requireAdminAuth,
    JsonController.storeAdvertisement,
);

router.get(
    "/getAdvertisement",
    requireAdminAuth,
    JsonController.getAdvertisement,
);

router.get(
    "/getAdvertisementAnalytics",
    requireAdminAuth,
    JsonController.getAdvertisementAnalytics,
);

router.get(
    "/getAdvertisementAnalyticsGraph",
    requireAdminAuth,
    JsonController.getAdvertisementAnalyticsGraph,
);

router.post(
    "/takeAdvertisementSnapshot",
    requireAdminAuth,
    JsonController.takeAdvertisementSnapshot,
);

router.post(
    "/applyAdvertisementSnapshot",
    requireAdminAuth,
    JsonController.applyAdvertisementSnapshot,
);

router.post(
    "/updateAdvertisement",
    requireAdminAuth,
    JsonController.updateAdvertisement,
);

router.post(
    "/getAdvertise",
    JsonController.getAdvertise,
);

router.post(
    "/setdata",
    JsonController.storeAdvertisementInRedis,
);

router.post(
    "/setLauncher",
    JsonController.LauncherSet
)

router.post(
    "/setContinueButton",
    JsonController.setContinueButton
)


module.exports = router;
