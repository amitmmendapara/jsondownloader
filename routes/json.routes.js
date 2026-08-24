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
    "/updateAdvertisement",
    JsonController.updateAdvertisement,
);

router.post(
    "/getAdvertise",
    JsonController.getAdvertise,
);


module.exports = router;
