const User = require("../models/UserModel");
const catchAsync = require("../utlis/catchAsync");
const AppError = require("../utlis/APIError");

// GET /api/v1/users (list) - keep as admin-only later
exports.getAllUser = catchAsync(async (req, res, next) => {
  const allUsers = await User.find().select("-password");
  res.status(200).json({
    status: "success",
    results: allUsers.length,
    data: { users: allUsers },
  });
});

// signup route previously used addUser; keep for compatibility if needed
exports.addUser = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return next(new AppError("name, email and password are required", 400));
  }

  const newUser = await User.create({ name, email, password, role });
  const userObj = newUser.toObject();
  if (userObj.password) delete userObj.password;

  res.status(201).json({
    status: "success",
    data: { user: userObj },
  });
});

// Get own profile (protected route should set req.user)
exports.getMe = (req, res, next) => {
  const user = req.user;
  res.status(200).json({ status: "success", data: { user } });
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // Prevent password updates here
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route is not for password updates. Use /update-password.",
        400,
      ),
    );
  }

  const filteredBody = {};
  ["name", "email"].forEach((field) => {
    if (req.body[field]) filteredBody[field] = req.body[field];
  });

  const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true,
  }).select("-password");
  res.status(200).json({ status: "success", data: { user: updatedUser } });
});
