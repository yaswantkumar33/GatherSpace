const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "UserName is Required"],
  },
  email: {
    type: String,
    required: [true, "A email for the user is required"],
    unique: [true, "Email must be unique"],
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, "A password for the user is required"],
    select: false,
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
    type: Date,
  },
  passwordResetToken: {
    type: String,
  },
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, saltRounds);
  this.passwordChangedAt = Date.now();
});
userSchema.methods.checkPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
