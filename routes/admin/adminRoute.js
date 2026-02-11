import express from 'express'
import * as userController from '../../controllers/admin/userController.js'
import * as authController from '../../controllers/admin/authController.js'
import * as middleWares from "../../middlewares/admin/adminAuth.js"

const router = express.Router()

router.route('/login').get(middleWares.isAdminLogged, authController.loginLoad).post(authController.login)

router.route('/users').get(middleWares.checkAdminAuth, userController.userList)
router.route('/users/block/:id').patch(userController.blockUser)

router.route("/logout").get(authController.logout)
export default router
