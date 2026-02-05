import express from "express";
import * as userController from "../../controllers/admin/userController.js"

const router = express.Router()

router.route("/users").get(userController.userList)

export default router