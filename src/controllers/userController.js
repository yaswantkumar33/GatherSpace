const User = require("./../models/UserModel");

exports.getAllUser = async (req, res) => {
  const allUsers = await User.find();
  res.status(200).json({
    status: "Success",
    data: allUsers,
  });
};

exports.addUser = async (req, res) => {
  console.log(req.body);

  try {
    const bodydata = req.body;

    const newUser = await User.create(req.body);
    res.status(200).json({
      status: "Success Creating the User",
      data: newUser,
    });
  } catch (err) {
    res.status(500).json({
      status: "Failed",
      Errmessage: err.message,
    });
  }
};
