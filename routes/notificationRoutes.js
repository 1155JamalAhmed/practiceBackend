const express = require("express");
const notificationController = require("../controllers/notificationControler");
const authenticationController = require("../controllers/authenticationController");

const router = express.Router();

router.use(authenticationController.protect);

router
  .route("/allowNotification/:deviceToken")
  .post(notificationController.allowNotification);

module.exports = router;
