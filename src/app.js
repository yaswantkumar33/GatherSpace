const express = require("express");
const morgan = require("morgan");
const cookieParser = require('cookie-parser');
const AppError = require("./utlis/APIError");
const globalErrorHandler = require("./middleware/errorMiddleware");

const app = express();
app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Routes
const userRouter = require("./routes/userRoutes");
const authRouter = require("./routes/authRoutes");

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

// 404 handler for all other routes
app.use((req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
