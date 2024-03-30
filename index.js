const mongoose = require("mongoose");
const dotenv = require("dotenv");

process.on("uncaughtException", (err) => {
  console.log("Uncaught Exception! Shutting down");
  console.log(err);
  process.exit(1);
});

dotenv.config({ path: "./config.env" });
const { server: app, io } = require("./app");

const DB = process.env.DATABASE.replace(
  "<password>",
  process.env.DATABASE_PASSWORD
);

// ** connecting to mongodb
mongoose.connect(DB).then(() => console.log("DB connection successful...!"));

// ** Display environment on terminal
console.log("Environment: ", process.env.NODE_ENV);

const port = process.env.PORT;
require("./socket");

// Start server
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

// ** catching unhandled rejection
process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection! Shutting down ✨");
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  console.log("SIGTERM RECEIVED. Shutting down gracefully 👌");
  server.close(() => {
    console.log("✨ Process terminated!");
  });
});
