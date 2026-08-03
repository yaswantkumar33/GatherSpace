const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/UserModel");
const catchAsync = require("../utlis/catchAsync");
const AppError = require("../utlis/APIError");
const sendEmail = require("../utlis/email");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });

const parseDurationMs = (str) => {
  if (!str) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(str.slice(0, -1), 10);
  const unit = str.slice(-1);
  if (unit === "m") return n * 60 * 1000;
  if (unit === "h") return n * 60 * 60 * 1000;
  if (unit === "d") return n * 24 * 60 * 60 * 1000;
  return parseInt(str, 10) * 1000;
};

const createSendTokens = (user, statusCode, res) => {
  const accessToken = signToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  const cookieOptions = {
    httpOnly: true,
    expires: new Date(
      Date.now() + parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
    ),
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  // Set refresh token as HttpOnly cookie
  res.cookie("refreshToken", refreshToken, cookieOptions);

  const userObj = user.toObject ? user.toObject() : { ...user };
  if (userObj.password) delete userObj.password;

  res.status(statusCode).json({
    status: "success",
    accessToken,
    data: { user: userObj },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return next(new AppError("name, email and password are required", 400));
  }
  const newUser = await User.create({ name, email, password, role });
  createSendTokens(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(new AppError("Please provide email and password", 400));

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  createSendTokens(user, 200, res);
});

exports.logout = (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.status(200).json({ status: "success" });
};

exports.refreshToken = catchAsync(async (req, res, next) => {
  const token = req.cookies && req.cookies.refreshToken;
  if (!token) return next(new AppError("No refresh token, please log in", 401));

  let decoded;
  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    );
  } catch (err) {
    return next(new AppError("Invalid refresh token, please log in", 401));
  }

  const currentUser = await User.findById(decoded.id);
  if (!currentUser)
    return next(
      new AppError("The user belonging to this token no longer exists", 401),
    );
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password. Please log in again.", 401),
    );
  }

  // Issue new access token (do NOT re-send refresh token unless you want to rotate)
  const accessToken = signToken(currentUser._id);
  res.status(200).json({ status: "success", accessToken });
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token)
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401),
    );

  // 2) Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError("Invalid token! Please log in again.", 401));
  }

  // 3) Check user exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser)
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401,
      ),
    );

  // 4) Check if changed password after token issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401),
    );
  }

  // Grant access
  req.user = currentUser;
  next();
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // user must be logged in (protect middleware should run before)
  const user = await User.findById(req.user._id).select("+password");
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return next(new AppError("Provide current and new password", 400));

  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError("Your current password is wrong", 401));
  }

  user.password = newPassword;
  await user.save();

  // send new tokens
  createSendTokens(user, 200, res);
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError("Please provide your email", 400));
  const user = await User.findOne({ email });
  if (!user) return next(new AppError("There is no user with that email", 404));

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${req.protocol}://${req.get("host")}/api/v1/auth/reset-password/${resetToken}`;
  const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}\nIf you didn't request this, ignore.`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token",
      message,
    });
    res
      .status(200)
      .json({ status: "success", message: "Token sent to email!" });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Try again later.",
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) return next(new AppError("Token is invalid or has expired", 400));

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  createSendTokens(user, 200, res);
});
