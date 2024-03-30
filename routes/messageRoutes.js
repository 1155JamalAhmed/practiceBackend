const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const authenticationController = require("../controllers/authenticationController");

router.use(authenticationController.protect);

router.route("/:conversationId").get(messageController.getAllMessByConvoId);

module.exports = router;
