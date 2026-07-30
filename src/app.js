const express = require("express");
const morgan = require("morgan");
const AppError = require("./utlis/APIError");
const globalErrorHandler = require("./middleware/errorMiddleware");

const app = express();
app.use(express.json());

if (process.env.YENVIRONMENT == "development") {
  app.use(morgan("dev"));
}

// UserRoutes
const userRouter = require("./routes/userRoutes");
app.use("/api/v1/auth", userRouter);

app.all("/", (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});
app.use(globalErrorHandler);

module.exports = app;
