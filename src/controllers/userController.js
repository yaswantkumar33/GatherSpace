const User = require("./../models/UserModel");

exports.getAllUser = (req, res) => {
  res.status(200).json({
    message: "this is the response fom the user get all controller",
    status: "'Req Sucessfull",
  });
};

exports.addUser = (req, res) => {
  console.log(req.body);
  const bodydata = req.body;
  res.status(200).json({
    status: "Success",
    data: bodydata,
  });
};
