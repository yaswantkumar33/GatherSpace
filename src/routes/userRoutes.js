const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/signup", userController.addUser); // legacy route if needed
router.get("/", userController.getAllUser);

// Protected routes
router.get("/me", authController.protect, userController.getMe);
router.patch("/update-me", authController.protect, userController.updateMe);

module.exports = router;
