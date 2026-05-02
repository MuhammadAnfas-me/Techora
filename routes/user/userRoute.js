import express from 'express'
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

/*---------------------------------------Auth section-----------------------------------------*/
/*---------------------------------------Auth section-----------------------------------------*/
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

router.route('/profile/edit/email').post(profileController.emailChange)

router.route('/profile/edit/email-verify').post(profileController.emailVerify)

/*---------------------------------Product section---------------------------------------- */
/*---------------------------------Product section---------------------------------------- */
/*---------------------------------Product section---------------------------------------- */

router.route('/products').get(productController.productsList)
router.route('/products/:productId').get(productController.productPage)

// --------------------------------Cart section ------------------------------------------
// --------------------------------Cart section ------------------------------------------
// --------------------------------Cart section ------------------------------------------

router
  .route('/cart')
  .get(middlewares.isBlocked, middlewares.checkAuth, cartController.cartLoad)
router
  .route('/cart/add')
  .post(middlewares.isBlocked, middlewares.checkAuth, cartController.addToCart)
router
  .route('/cart/delete')
  .delete(
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

router.route('/wishlist').get(wishListController.wishListLoad)
router.post('/wishlist/add', wishListController.toggleItem)
router.delete('/wishlist/remove', wishListController.removeProduct)

//----------------------------------------- checkout page------------------------------------
//----------------------------------------- checkout page------------------------------------
//----------------------------------------- checkout page------------------------------------

router.get('/checkout', checkOutController.checkOutLoad)
router.route('/checkout').post(checkOutController.validateCart)

// --------------------------- Payment section ----------------------------------------------
// --------------------------- Payment section ----------------------------------------------
// --------------------------- Payment section ----------------------------------------------

router.get('/checkout/payment', paymentController.paymentPageLoad)
router.get('/checkout/payment/success', paymentController.orderSuccess)

router.post('/place-order', paymentController.placeOrder)
router.get('/order-details', paymentController.fetchOrderDetails)

// -------------------------------Order section---------------------------------------------
// -------------------------------Order section---------------------------------------------
// -------------------------------Order section---------------------------------------------
router.get('/profile-orders', orderController.OrderLoad)
router.get('/orders', orderController.orderListPage)
router.get('/orders/:orderId', orderController.orderDetailsLoad)

router.get('/orders/:id/invoice', orderController.generateInvoicePDF)

router
  .route('/orders/:id/cancel')
  .get(orderController.orderCancelLoad)
  .patch(orderController.orderCancel)

router
  .route('/orders/:orderId/cancel/:itemId')
  .get(orderController.itemCancelLoad)
  .patch(orderController.cancelItem)

router
  .route('/orders/:orderId/return')
  .get(orderController.orderReturnLoad)
  .patch(orderController.returnOrder)
router
  .route('/orders/:orderId/return/:itemId')
  .get(orderController.itemReturnLoad)
  .patch(orderController.returnOrderItem)

// ------------------------------------ Payment Section ----------------------------------------
// ------------------------------------ Payment Section ----------------------------------------
// ------------------------------------ Payment Section ----------------------------------------

router.post('/create-order', paymentController.createOrder)
router.post('/verify-payment', paymentController.verifyPayment)
router.get('/checkout/payment/failed', middlewares.checkAuth, paymentController.paymentFailedPage)


//-------------------------------------- Wallet Section -----------------------------------------
//-------------------------------------- Wallet Section -----------------------------------------
//-------------------------------------- Wallet Section -----------------------------------------

router.get('/profile-wallet',middlewares.checkAuth,walletController.loadWallet)
router.post('/wallet/create-order',walletController.createWalletOrder)
router.post('/wallet/verify-payment',walletController.verifyWalletPayment)

// ------------------------------------- Coupon managment --------------------------------------
// ------------------------------------- Coupon managment --------------------------------------
// ------------------------------------- Coupon managment --------------------------------------

router
  .route("/available-coupons")
  .get(couponController.getAvailableCoupons)

router
  .route("/apply-coupon").post(couponController.applyCoupon)
router
  .route('/remove-coupon').post(couponController.removeCoupon)

// ------------------------------------- Referrel Section --------------------------------------
// ------------------------------------- Referrel Section --------------------------------------
// ------------------------------------- Referrel Section --------------------------------------

router
  .route("/profile-referral")
  .get(referelController.referralLoad)



router.route("/contact").get(profileController.contactLoad).post(profileController.contactMail)
router.route('/logout').get(userController.logout)

export default router
