const { messaging } = require("../firebase/firebaseInit");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");

exports.allowNotification = catchAsync(async (req, res, next) => {
  const deviceToken = req.params.deviceToken;

  const updatedUser = await User.findOneAndUpdate(
    { _id: req.user._id },
    { deviceToken },
    {
      new: true,
    }
  );

  console.log("updated user", updatedUser);

  res.status(200).json({
    status: "Success",
    data: {
      message: `${deviceToken} saved successfully`,
    },
  });
});

exports.fcmSendThisNotification = async (deviceTokens, data) => {
  try {
    const res = await messaging.send({
      token: deviceTokens[0],
      data: {
        message: data.message.toString(),
        sender: data.sender.toString(),
        receiver: data.receiver.toString(),
        conversation: data.conversation.toString(),
        _id: data._id.toString(),
      },
    });

    // Response is an object of the form { responses: [] }
    console.log("notification send successfully", res);
  } catch (err) {
    console.log("Error sending message:", err);
  }
};
