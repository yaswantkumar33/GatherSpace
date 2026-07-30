const AppError = require("./../utlis/APIError");

const handleCastErrorDB = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}.`, 400);
const handleDuplicateFieldsDB = (err) => {
  const value = Object.values(err.keyValue)[0];
  return new AppError(
    `Duplicate field value: ${value}. Use another value!`,
    400,
  );
};
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Invalid input data. ${errors.join(". ")}`, 400);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res
      .status(err.statusCode)
      .json({ status: err.status, message: err.message });
  }
  console.error("ERROR 💥", err);
  return res
    .status(500)
    .json({ status: "error", message: "Something went wrong" });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
    return;
  }

  let error = { ...err, message: err.message };
  if (err.name === "CastError") error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === "ValidationError") error = handleValidationErrorDB(err);

  sendErrorProd(error, res);
};
