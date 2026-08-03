const User = require("./../models/UserModel");
const catchAsync = require("./../utlis/catchAsync");

exports.getAllUser = async (req, res) => {
  const allUsers = await User.find();
  res.status(200).json({
    status: "Success",
    data: allUsers,
  });
};

exports.addUser = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // if (!name || !email || !password) {
  //   return next(new AppError("name, email and password are required", 400));
  // }

  const newUser = await User.create({ name, email, password, role });

  res.status(201).json({
    status: "success",
    data: { user: newUser },
  });
});
