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

import * as middlewares from '../../middlewares/user/auth.js'
import upload from '../../middlewares/cloudinary/upload.js'

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

router.route('/products').get(productController.productsList)
router.route('/products/:productId').get(productController.productPage)

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

router.route("/wishlist").get(wishListController.wishListLoad)
router.post("/wishlist/add",wishListController.toggleItem)
router.delete("/wishlist/remove",wishListController.removeProduct)


//----------------------------------------- checkout page------------------------------------
router.get('/checkout',checkOutController.checkOutLoad)
router.route("/checkout").post(checkOutController.validateCart)

// --------------------------- Payment section ----------------------------------------------

router.get("/checkout/payment",paymentController.paymentPageLoad)
router.get("/checkout/success",paymentController.orderSuccess)

router.post("/place-order",paymentController.placeOrder)
router.get("/order-details",paymentController.fetchOrderDetails)

// -------------------------------Order section---------------------------------------------
router.get("/profile-orders",orderController.OrderLoad)
router.get("/orders",orderController.orderListPage)
router.get("/orders/:orderId",orderController.orderDetailsLoad)

router.get("/orders/:id/invoice",orderController.generateInvoicePDF)

router
.route("/orders/:id/cancel")
.get(orderController.orderCancelLoad)
.patch(orderController.orderCancel)

router
  .route("/orders/:orderId/cancel/:itemId")
  .get(orderController.itemCancelLoad)
  .patch(orderController.cancelItem)

router
  .route("/orders/:orderId/return")
  .get(orderController.orderReturnLoad)
  .patch(orderController.returnOrder)
router
  .route("/orders/:orderId/return/:itemId")
  .get(orderController.itemReturnLoad)
  .patch(orderController.returnOrderItem)



router.route('/logout').get(userController.logout)

export default router
