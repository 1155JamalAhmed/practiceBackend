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

exports.fcmSendThisNotification = async (deviceTokens, data, senderName) => {
  try {
    const res = await messaging.sendEachForMulticast({
      tokens: deviceTokens,
      data: {
        message: data.message.toString(),
        sender: data.sender.toString(),
        receiver: data.receiver.toString(),
        conversation: data.conversation.toString(),
        senderName: senderName,
        _id: data._id.toString(),
      },
      notification: {
        title: `Received a message from ${senderName}`,
        body: data.message,
        // image: "http://localhost:3000/jamal3.jpg",
      },
      webpush: {
        fcm_options: {
          link: "/",
        },
      },
    });

    // Response is an object of the form { responses: [] }
    console.log("notification send successfully", res);
    console.log("notification send successfully", res?.responses[0]?.error);
  } catch (err) {
    console.log("Error sending message:", err.error);
  }
};
