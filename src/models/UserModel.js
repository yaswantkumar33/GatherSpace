const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
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
  userRole: {
    type: String,
    default: "attendee",
    enum: {
      values: ["admin", "attendee", "organizer"],
      message: [1, "A user must have role!"],
    },
  },
  passwordChangedAt: {
    type: String,
  },
  passwordResetToken: {
    type: String,
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
