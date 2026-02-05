import express from 'express'
const router = express.Router()
import * as userController from '../../controllers/user/authController.js'
import * as profileController from '../../controllers/user/profileController.js'
import * as middlewares from '../../middlewares/auth.js'

router.route('/Techora').get(userController.landing)

router
  .route('/login')
  .get(middlewares.isLogged, userController.loginLoad)
  .post(userController.login)

router
  .route('/signup')
  .get(middlewares.isLogged, userController.signupLoad)
  .post(userController.signUp)

router
  .route('/otp-verify')
  .get(userController.otpLoad)
  .post(userController.otpVerify)

router.route('/resendOtp').post(userController.resendOtp)

router.route('/').get(middlewares.checkAuth, userController.homeLoad)

router
  .route('/forgot-password')
  .get(userController.forgotLoad)
  .post(userController.forgotPassword)

router
  .route('/reset-password')
  .get(userController.passwordReset)
  .patch(userController.resetPassword)

router.route('/success').get(userController.resetConfirmation)

router
  .route('/profile')
  .get(middlewares.checkAuth, profileController.profileLoad)

router
  .route('/profile/edit')
  .get(middlewares.checkAuth, profileController.editProfileLoad)
  .patch(profileController.editProfile)

router
  .route('/profile/password')
  .get(middlewares.checkAuth, profileController.passwordeditLoad)
  .patch(profileController.editPassword)
router
  .route('/profile/address')
  .get(middlewares.checkAuth, profileController.addressLoad)
  .post(profileController.addAddress)

router
  .route('/profile/address/:id')
  .get(profileController.addressEditLoad)
  .patch(profileController.editAddress)
  .delete(profileController.deleteAddress)

router.route('/logout').get(userController.logout)

export default router
