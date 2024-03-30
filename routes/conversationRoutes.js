const express = require("express");
const conversationController = require("../controllers/conversationController");
const authenticationController = require("../controllers/authenticationController");
const router = express.Router();

router
  .route("/")
  .get(authenticationController.protect, conversationController.getAllConvo);

router
  .route("/")
  .post(
    authenticationController.protect,
    conversationController.createNewConversation
  );

module.exports = router;
