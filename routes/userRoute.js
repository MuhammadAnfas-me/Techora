import express from 'express'
const router = express.Router()
import * as userController from '../controllers/userAuth/authController.js'

router.route("/Techora").get(userController.landing)

router
  .route('/login')
  .get(userController.loginLoad)
  .post(userController.login)

router
  .route('/signup')
  .get(userController.signupLoad)
  .post(userController.signUp)

router
  .route('/otp-verify')
  .get(userController.otpLoad)
  .post(userController.otpVerify)

router
  .route("/resendOtp")
  .post(userController.resendOtp)

export default router
