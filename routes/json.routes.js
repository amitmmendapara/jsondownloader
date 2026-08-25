var express = require("express");
var router = express.Router();
var JsonController = require("../controller/v1/json.controller.js");

router.post(
    "/storeAdvertisement",
    JsonController.storeAdvertisement,
);

router.get(
    "/getAdvertisement",
    JsonController.getAdvertisement,
);

router.post(
    "/takeAdvertisementSnapshot",
    JsonController.takeAdvertisementSnapshot,
);

router.post(
    "/applyAdvertisementSnapshot",
    JsonController.applyAdvertisementSnapshot,
);

router.post(
    "/updateAdvertisement",
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
