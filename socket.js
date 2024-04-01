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
    next("unauthorized");
  }
});

io.on("connection", async (socket) => {
  if (!socket.user) {
    socket.disconnect();
  }

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

  socket.on("newMessage", async (data, callback) => {
    const { message, convoId } = data;
    try {
      if (!socket.user) {
        return callback(new Error("user is not authorised"));
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
            "cOEAQqG2fCbqV9Yl8FLb1b:APA91bEBx3szDF-w-qwgl0qkZyN9ZJ_wLWaZcdRa1EooqRywG9fuo4jR5p-6AdhnBDBk48H9pK7QoO68GFdgQMxFqwPgFghT4_I-x2OvaZOUyDiuSvVfizRy3__q7p3Q_E3Uheb38I7R",
          ],
          savedMessage,
          socket.user.name
        );
      }
    } catch (err) {
      console.log(err);
      socket.disconnect();
    }
  });
});
