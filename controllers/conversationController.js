const Conversation = require("../models/conversationModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.getAllConvo = catchAsync(async (req, res, next) => {
  const allConvo = await Conversation.find({
    participants: req.user._id,
  });
  res.status(201).json({
    status: "success",
    data: allConvo,
  });
});

exports.createNewConversation = catchAsync(async (req, res, next) => {
  const isConvoExists = await Conversation.findOne({
    participants: [req.user._id, req.body.responderId],
  });

  if (isConvoExists) {
    return next(new AppError("Conversation already exists", 409));
  }

  if (req.user._id.toString() === req.body.responderId) {
    return next(
      new AppError("You can't create conversation with yourself", 404)
    );
  }

  const convo = await Conversation.create({
    participants: [req.user._id, req.body.responderId],
  });

  res.status(201).json({
    status: "success",
    data: convo,
  });
});
