const { io } = require("./app");
const {
  fcmSendThisNotification,
} = require("./controllers/notificationControler");
const Conversation = require("./models/conversationModel");
const Message = require("./models/messageModel");
const User = require("./models/userModel");
const { authenticate } = require("./utils/authHandler");

const userIdRefToSocket = {};

// authentication
io.use(async (socket, next) => {
  try {
    const authenticatedUser = await authenticate(
      socket.handshake.headers.token
    );
    socket.user = authenticatedUser;
    userIdRefToSocket[authenticatedUser._id.toString()] = socket.id;
    next();
  } catch (err) {
    socket.emit("unauthenticated", "You are not authenticated");
    socket.disconnect();
  }
});

io.on("connection", async (socket) => {
  socket.on("joinRoom", async ({ convoId }) => {
    if (!socket.user) {
      return socket.emit("unauthenticated", "You are not authenticated");
    }

    try {
      const isConvoBelongsToUser = await Conversation.findOne({
        _id: convoId,
        participants: socket.user._id,
      });

      if (!isConvoBelongsToUser) {
        return socket.emit(
          "wrongConvo",
          "You doesn't belong to this conversation"
        );
      }

      socket.join(`${convoId}`);
    } catch (err) {
      socket.disconnect();
    }
  });

  socket.on("newMessage", async (data) => {
    const { message, convoId } = data;
    try {
      if (!socket.user) {
        return io
          .to(socket.id)
          .emit("unauthorized", "You are not authenticated");
      }

      if (!message || !convoId) {
        return;
      }

      const convo = await Conversation.findOne({
        _id: convoId,
        participants: socket.user._id,
      });

      if (!convo) {
        console.log("wrong convo");
        return socket.emit(
          "wrongConvo",
          "You doesn't belong to this conversation"
        );
      }

      console.log("going to emit");
      const savedMessage = await Message.create({
        message: message,
        sender: socket.user._id,
        receiver: convo.participants.filter(
          (participant) => participant.toString() !== socket.user._id.toString()
        )[0],
        conversation: convo._id,
      });

      // broadcast to room except the one who send the message
      //1. need to find out whether receiver is on the conversation => joined the room ? yes => no notification
      socket.broadcast
        .to(convo._id.toString())
        .emit("newMessage", savedMessage);

      //2. no, then is user has avaliable connection to the socket => send notification through socket

      if (userIdRefToSocket[`${savedMessage.receiver.toString()}`]) {
        socket
          .to(userIdRefToSocket[`${savedMessage.receiver.toString()}`])
          .emit("pushMessage", savedMessage);
      } else {
        //3. no available connection then send a push notification to the user device
        const receiverUser = await User.findById(savedMessage.receiver);
        // receiverUser?.deviceToken &&
        await fcmSendThisNotification(
          // [receiverUser?.deviceToken],
          [
            "cykSkTRm5rZEWVwGtsu2dT:APA91bEEq6QF-kdxHvd3ilfl7i4NFlByPlcebtKcxgKjd1IDnldOeN7kmuTWUCfMl6YMqEY5jhNDfdrbr3p75v8w9hFTxxxPUINQx_h0T2dUaXKQzfq9nXDaeK__xdZ2Rs03twEWYzTO",
          ],
          savedMessage
        );
      }
    } catch (err) {
      console.log(err);
      socket.disconnect();
    }
  });
});
