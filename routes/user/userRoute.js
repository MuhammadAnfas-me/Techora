import express from 'express'
import rateLimit from 'express-rate-limit'
const router = express.Router()

import * as userController from '../../controllers/user/authController.js'
import * as profileController from '../../controllers/user/profileController.js'

import * as productController from '../../controllers/user/productController.js'

import * as cartController from '../../controllers/user/cartController.js'
import * as wishListController from '../../controllers/user/wishListController.js'
import * as checkOutController from '../../controllers/user/checkOutController.js'
import * as paymentController from '../../controllers/user/paymentController.js'
import * as orderController from '../../controllers/user/orderController.js'
import * as walletController from '../../controllers/user/walletController.js'
import * as couponController from "../../controllers/user/couponController.js"
import * as referelController from "../../controllers/user/referrelController.js"

import * as middlewares from '../../middlewares/user/auth.js'
import upload from '../../middlewares/cloudinary/upload.js'
import { RATE_LIMIT } from '../../constants/constant.js'

const loginLimiter = rateLimit({
  windowMs : RATE_LIMIT.LOGIN.WINDOW_MS,
  max : RATE_LIMIT.LOGIN.MAX,
  message : "Too many login attempts"
})

const signupLimiter = rateLimit({
  windowMs: RATE_LIMIT.SIGNUP.WINDOW_MS, // 15 minutes
  max: RATE_LIMIT.SIGNUP.MAX, 
  message: "Too many signup attempts, try again later"
});

const checkoutLimiter = rateLimit({
  windowMs: RATE_LIMIT.CHECKOUT.WINDOW_MS, // 15 minutes
  max: RATE_LIMIT.CHECKOUT.MAX,
  message: "Too many checkout attempts, try again later"
});

const paymentPageLimiter = rateLimit({
  windowMs: RATE_LIMIT.PAYMENT.WINDOW_MS,
  max: 40 // page loads
});

const paymentSubmitLimiter = rateLimit({
  windowMs: RATE_LIMIT.PAYMENT.WINDOW_MS,
  max: RATE_LIMIT.PAYMENT.MAX // actual payments
});

/*---------------------------------------Auth section-----------------------------------------*/
/*---------------------------------------Auth section-----------------------------------------*/
/*---------------------------------------Auth section-----------------------------------------*/

router
  .route('/login')
  .get(middlewares.isLogged, userController.loginLoad)
  .post(loginLimiter ,userController.login)

router
  .route('/signup')
  .get(middlewares.isLogged, userController.signupLoad)
  .post(signupLimiter ,userController.signUp)

 router
  .route('/check-referral').post(referelController.checkReferral) 
router
  .route('/otp-verify')
  .get(userController.otpLoad)
  .post(userController.otpVerify)

router.route('/resendOtp').post(userController.resendOtp)

router.route('/').get(userController.homeLoad)

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
/*-----------------------------------Profile section----------------------------------*/
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

router.route('/profile/edit/email').post(middlewares.isBlocked, profileController.emailChange)

router.route('/profile/edit/email-verify').post(middlewares.isBlocked, profileController.emailVerify)

/*---------------------------------Product section---------------------------------------- */
/*---------------------------------Product section---------------------------------------- */
/*---------------------------------Product section---------------------------------------- */

router.route('/products').get(middlewares.isBlocked, productController.productsList)
router.route('/products/:productId').get(middlewares.isBlocked, productController.productPage)

// --------------------------------Cart section ------------------------------------------
// --------------------------------Cart section ------------------------------------------
// --------------------------------Cart section ------------------------------------------

router
  .route('/cart')
  .get(middlewares.isBlocked, middlewares.isBlocked, middlewares.checkAuth, cartController.cartLoad)
router
  .route('/cart/add')
  .post(middlewares.isBlocked, middlewares.isBlocked, middlewares.checkAuth, cartController.addToCart)
router
  .route('/cart/delete')
  .delete(
    middlewares.isBlocked,
    middlewares.isBlocked,
    middlewares.checkAuth,
    cartController.deleteCartItem
  )
router
  .route('/cart/update-quantity')
  .patch(
    middlewares.isBlocked,
    middlewares.checkAuth,
    cartController.updateCartQuantity
  )

// ---------------------------------------- Wish List section -------------------------------
// ---------------------------------------- Wish List section -------------------------------
// ---------------------------------------- Wish List section -------------------------------

router.route('/wishlist').get(middlewares.isBlocked, wishListController.wishListLoad)
router.post('/wishlist/add',middlewares.isBlocked, wishListController.toggleItem)
router.delete('/wishlist/remove', wishListController.removeProduct)

//----------------------------------------- checkout page------------------------------------
//----------------------------------------- checkout page------------------------------------
//----------------------------------------- checkout page------------------------------------

router
  .route('/checkout')
  .get(checkoutLimiter, middlewares.isBlocked, checkOutController.checkOutLoad)
  .post(checkoutLimiter ,middlewares.isBlocked, checkOutController.validateCart)

// --------------------------- Payment section ----------------------------------------------
// --------------------------- Payment section ----------------------------------------------
// --------------------------- Payment section ----------------------------------------------

router.get('/checkout/payment', paymentPageLimiter, middlewares.isBlocked,  paymentController.paymentPageLoad)
router.get('/checkout/payment/success', paymentSubmitLimiter, middlewares.isBlocked, paymentController.orderSuccess)

router.post('/place-order',middlewares.isBlocked, paymentController.placeOrder)
router.get('/order-details',middlewares.isBlocked, paymentController.fetchOrderDetails)

// -------------------------------Order section---------------------------------------------
// -------------------------------Order section---------------------------------------------
// -------------------------------Order section---------------------------------------------
router.get('/profile-orders',middlewares.isBlocked, orderController.OrderLoad)
router.get('/orders',middlewares.isBlocked, orderController.orderListPage)
router.get('/orders/:orderId',middlewares.isBlocked, orderController.orderDetailsLoad)

router.get('/orders/:id/invoice',middlewares.isBlocked, orderController.generateInvoicePDF)

router
  .route('/orders/:id/cancel')
  .get(middlewares.isBlocked, orderController.orderCancelLoad)
  .patch(middlewares.isBlocked, orderController.orderCancel)

router
  .route('/orders/:orderId/cancel/:itemId')
  .get(middlewares.isBlocked, orderController.itemCancelLoad)
  .patch(middlewares.isBlocked, orderController.cancelItem)

router
  .route('/orders/:orderId/return')
  .get(middlewares.isBlocked, orderController.orderReturnLoad)
  .patch(middlewares.isBlocked, orderController.returnOrder)
router
  .route('/orders/:orderId/return/:itemId')
  .get(middlewares.isBlocked, orderController.itemReturnLoad)
  .patch(middlewares.isBlocked, orderController.returnOrderItem)

router
  .route('/orders/:itemId/review')
  .get(orderController.reviewLoad)
  .post(orderController.addReview)

// ------------------------------------ Payment Section ----------------------------------------
// ------------------------------------ Payment Section ----------------------------------------
// ------------------------------------ Payment Section ----------------------------------------

router.post('/create-order',middlewares.isBlocked, paymentController.createOrder)
router.post('/verify-payment',middlewares.isBlocked,  paymentController.verifyPayment)
router.get('/checkout/payment/failed',middlewares.isBlocked, middlewares.checkAuth, paymentController.paymentFailedPage)


//-------------------------------------- Wallet Section -----------------------------------------
//-------------------------------------- Wallet Section -----------------------------------------
//-------------------------------------- Wallet Section -----------------------------------------

router.get('/profile-wallet',middlewares.isBlocked, middlewares.checkAuth,walletController.loadWallet)
router.post('/wallet/create-order',middlewares.isBlocked, walletController.createWalletOrder)
router.post('/wallet/verify-payment',middlewares.isBlocked, walletController.verifyWalletPayment)

// ------------------------------------- Coupon managment --------------------------------------
// ------------------------------------- Coupon managment --------------------------------------
// ------------------------------------- Coupon managment --------------------------------------

router
  .route("/available-coupons")
  .get(middlewares.isBlocked, couponController.getAvailableCoupons)

router
  .route("/apply-coupon").post(middlewares.isBlocked, couponController.applyCoupon)
router
  .route('/remove-coupon').post(middlewares.isBlocked, couponController.removeCoupon)

// ------------------------------------- Referrel Section --------------------------------------
// ------------------------------------- Referrel Section --------------------------------------
// ------------------------------------- Referrel Section --------------------------------------

router
  .route("/profile-referral")
  .get(middlewares.isBlocked, referelController.referralLoad)



router.route("/contact").get(middlewares.isBlocked, profileController.contactLoad).post(profileController.contactMail)
router.route('/logout').get(userController.logout)

export default router
