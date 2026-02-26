import express from 'express'
const router = express.Router()
import * as userController from '../../controllers/user/authController.js'
import * as profileController from '../../controllers/user/profileController.js'

import * as productController from "../../controllers/user/productController.js"

import * as middlewares from '../../middlewares/user/auth.js'
import upload from '../../middlewares/user/upload.js'

router.route('/Techora').get(userController.landing)

/*---------------------------------------Auth section-----------------------------------------*/

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

router
  .route('/')
  .get(middlewares.checkAuth, middlewares.isBlocked, userController.homeLoad)

router
  .route('/forgot-password')
  .get(userController.forgotLoad)
  .post(userController.forgotPassword)

router
  .route('/reset-password')
  .get(userController.passwordReset)
  .patch(userController.resetPassword)

router.route('/success').get(userController.resetConfirmation)

/*-----------------------------------Profile section----------------------------------*/

router
  .route('/profile')
  .get(
    middlewares.checkAuth,
    middlewares.isBlocked,
    profileController.profileLoad
  )

router
  .route('/profile/edit')
  .get(
    middlewares.checkAuth,
    middlewares.isBlocked,
    profileController.editProfileLoad
  )
  .patch(profileController.editProfile)

router
  .route('/profile/password')
  .get(
    middlewares.checkAuth,
    middlewares.isBlocked,
    profileController.passwordeditLoad
  )
  .patch(profileController.editPassword)
router
  .route('/profile/address')
  .get(
    middlewares.checkAuth,
    middlewares.isBlocked,
    profileController.addressLoad
  )
  .post(profileController.addAddress)

router
  .route('/profile/address/:id')
  .get(
    middlewares.checkAuth,
    middlewares.isBlocked,
    profileController.addressEditLoad
  )
  .patch(profileController.editAddress)
  .delete(profileController.deleteAddress)

router
  .route('/profile/image')
  .patch(upload.single('profileImage'), profileController.updateProfileImage)
  .delete(profileController.removeProfileImage)

router.route('/profile/edit/email').post(profileController.emailChange)

router.route('/profile/edit/email-verify').post(profileController.emailVerify)

/*---------------------------------Product section---------------------------------------- */

router.route("/products").get(productController.productsList)

router.route('/logout').get(userController.logout)

export default router
