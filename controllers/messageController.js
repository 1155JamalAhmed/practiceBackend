const catchAsync = require("../utils/catchAsync");
const Message = require("../models/messageModel");
const mongoose = require("mongoose");

exports.getAllMessByConvoId = catchAsync(async (req, res, next) => {
  const conversationId = req.params.conversationId;
  const convoId = new mongoose.Types.ObjectId(conversationId);
  const allMessages = await Message.find({
    conversation: convoId,
    $or: [{ sender: req.user._id }, { receiver: req.user._id }],
  });
  res.status(200).json({
    status: "Success",
    data: allMessages,
  });
});
