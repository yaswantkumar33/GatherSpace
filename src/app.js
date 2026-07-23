const express = require("express");
const morgan = require("morgan");

const app = express();
app.use(express.json());
console.log("this is log from the app file");

// UserRoutes
const userRouter = require("./routes/userRoutes");
app.use("/api/v1/users", userRouter);

module.exports = app;
