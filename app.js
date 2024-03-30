const express = require("express");
const morgan = require("morgan");
const path = require("path");
// ** import for security purposes
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const http = require("http");
/** ----------------------------- **/

const cookieParser = require("cookie-parser");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");

const compression = require("compression");
const cors = require("cors");
const app = express();

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.enable("trust proxy");

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// ** It is for static file routing
app.use(express.static(path.join(__dirname, "public")));

// ** Implement CORS
app.use(cors());
// Access-Control-Allow-Origin *

// api.natours.com, front-end natours.com
// app.use(cors({
//   origin: 'https://www.natours.com'
// }))

app.options("*", cors());

// ** make HTTP headers secure
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// ** set limit on request from same IP -> brute force handled
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many request from this IP, Please try again in an hour!",
});
app.use("/api", limiter);

// app.post(
//   "/webhook-checkout",
//   express.raw({ type: "application/json" }),
//   bookingController.webhookCheckout
// );

//  middlewares
// ** development logging
if (process.env.NODE_ENV === "development") {
  // ** morgan is used to console information about the request
  app.use(morgan("dev"));
}

// ** here express.json is the middleware which is a function that can modify incomming request data
// ** here it is used to have access to body of the request
// ** body parser
app.use(
  express.json({
    limit: "10kb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10kb",
  })
);
app.use(cookieParser());

// ** Data sanitization
// ** 1) ->  NoSQL query injection handled
app.use(mongoSanitize());

// ** 2) -> XSS handled
app.use(xss());

// ** prevent parameter pollution (same paramter with different value ?sort=duration&sort=price)
app.use(
  hpp({
    // ** List of properties which can have multiple values
    whiteList: [
      "duration",
      "ratingsQuantity",
      "ratingsAverage",
      "maxGroupSize",
      "difficulty",
      "price",
    ],
  })
);

app.use(compression());

// ** a middleware to connect date to the incommming request
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

const userRouter = require("./routes/userRoutes");
const messageRouter = require("./routes/messageRoutes");
const conversationRouter = require("./routes/conversationRoutes");
const notificationRouter = require("./routes/notificationRoutes");
app.use("/api/v1/users", userRouter);
app.use("/api/v1/messages", messageRouter);
app.use("/api/v1/conversations", conversationRouter);
app.use("/api/v1/notifications", notificationRouter);

// ** all other routes than the defined above will lead to this error route
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = { server, io };
