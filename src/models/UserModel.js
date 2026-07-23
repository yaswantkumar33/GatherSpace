const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "UserName is Required"],
  },
  email: {
    type: String,
    required: [true, "A email for the user is required"],
  },
  password: {
    type: String,
  },
});

const User = mongoose.model("User", userSchema);
module.export = User;
