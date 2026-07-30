const express = require("express");
const router = express.Router();


const userController = require("./../controllers/userController");

router.route("/signup").post(userController.addUser);
router.route("/users").get(userController.getAllUser);

module.exports = router;
