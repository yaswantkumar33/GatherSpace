// sync exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...", err);
  process.exit(1);
});

// after you start the server (server = app.listen(...))
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! Shutting down...", err);
  server.close(() => process.exit(1));
});

const dotenv = require("dotenv");
const mongoose = require("mongoose");
dotenv.config({ path: "./.env" });

const app = require("./src/app");

const DB = process.env.DATABASE.replace(
  "<db_password>",
  encodeURIComponent(process.env.DATABASE_PASS),
);
mongoose.connect(DB).then((con) => {
  console.log("Database Connected Sucessfully");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server started running at port ${port}`);
});
