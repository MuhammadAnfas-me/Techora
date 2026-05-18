import express from 'express'
import * as userController from '../../controllers/admin/userController.js'
import * as authController from '../../controllers/admin/authController.js'
import * as categoryController from '../../controllers/admin/categoryController.js'
import * as productController from '../../controllers/admin/productController.js'
import * as orderController from '../../controllers/admin/orderController.js'
import * as couponController from '../../controllers/admin/couponController.js'
import * as offerController from '../../controllers/admin/offerController.js'
import * as dashboardController from '../../controllers/admin/dashboardController.js'
import * as reportController from '../../controllers/admin/reportController.js'

import * as middleWares from '../../middlewares/admin/adminAuth.js'
import uploadProductImage from '../../middlewares/cloudinary/uploadProductImages.js'

const router = express.Router()

// --------------- Admin Auth -----------------------------//

router
  .route('/login')
  .get(middleWares.isAdminLogged, authController.loginLoad)
  .post(authController.login)

// --------------- User listing and Block ----------------//

router.route('/users').get(middleWares.checkAdminAuth, userController.userList)
router
  .route('/users/api')
  .get(middleWares.checkAdminAuth, userController.userListApi)
router.route('/users/block/:id').patch(userController.blockUser)

// -------------- Category lisiting and Management --------------//

router
  .route('/category')
  .get(middleWares.checkAdminAuth, categoryController.categoryListPage)
router
  .route('/category/api')
  .get(middleWares.checkAdminAuth, categoryController.categoryListApi)

router
  .route('/category/add')
  .get(middleWares.checkAdminAuth, categoryController.addCategoryLoad)
  .post(middleWares.checkAdminAuth, categoryController.addCategory)

router
  .route('/category/:id')
  .get(middleWares.checkAdminAuth, categoryController.editPageLoad)
  .patch(middleWares.checkAdminAuth, categoryController.editCategory)
  .delete(middleWares.checkAdminAuth, categoryController.deleteCategory)

// --------------- Product Listing and Management ---------------//

router
  .route('/products')
  .get(middleWares.checkAdminAuth, productController.loadProducts)

router
  .route('/products/add')
  .get(middleWares.checkAdminAuth, productController.loadAddPage)
  .post(
    middleWares.checkAdminAuth,
    uploadProductImage.fields([{ name: 'variantImages', maxCount: 20 }]),
    productController.addProduct
  )

router
  .route('/products/variants/:id')
  .get(middleWares.checkAdminAuth, productController.variantLoad)
  .delete(middleWares.checkAdminAuth, productController.deleteVariant)

router
  .route('/products/:id')
  .get(middleWares.checkAdminAuth, productController.loadEdit)
  .patch(
    middleWares.checkAdminAuth,
    uploadProductImage.any(),
    productController.editProduct
  )

router
  .route('/products/:id/block')
  .patch(middleWares.checkAdminAuth, productController.blockProduct)

// ---------------------------------- Order management ---------------------------------------
router
  .route('/orders')
  .get(middleWares.checkAdminAuth, orderController.orderListLoad)

router.get(
  '/orders/export-pdf',
  middleWares.checkAdminAuth,
  orderController.exportOrdersPDF
)

router
  .route('/orders/:orderId')
  .get(middleWares.checkAdminAuth, orderController.orderDetailsPage)
  .patch(orderController.updateOrderStatus)

router.get('/orders/:orderId/invoice', middleWares.checkAdminAuth, orderController.generateInvoice)

router.route('/orders/:orderId/cancel').patch(orderController.orderCancel)

router.route('/orders/return/update').patch(orderController.updateReturnStatus)
// For return an item not the entire order
router.patch('/orders/return/item/:orderId', orderController.returnItem)
router.patch('/orders/:orderId/items/:itemId/status', middleWares.checkAdminAuth, orderController.updateItemStatus)

//-------------------------------------- Coupon Management --------------------------------
router
  .route('/coupons')
  .get(middleWares.checkAdminAuth, couponController.couponListLoad)
  .delete(couponController.deleteCoupon)
router.route('/coupons/:code').delete(couponController.deleteCoupon)
router
  .route('/coupons/add')
  .get(middleWares.checkAdminAuth, couponController.addCouponPage)
  .post(couponController.addCoupon)

router
  .route('/coupons/edit/:code')
  .get(middleWares.checkAdminAuth, couponController.editPageLoad)
  .patch(couponController.editCoupon)

router.route('/coupons/toggle').patch(couponController.statusToggle)

// -------------------------------------- Offers Management -------------------------------------

router
  .route('/offers')
  .get(middleWares.checkAdminAuth, offerController.offerLoad)

router
  .route('/offers/add')
  .get(middleWares.checkAdminAuth, offerController.addOfferLoad)
  .post(offerController.addOffer)
router
  .route('/offer/categories/list')
  .get(middleWares.checkAdminAuth, offerController.listCategories)
router
  .route('/offer/products/list')
  .get(middleWares.checkAdminAuth, offerController.listProducts)
router
  .route('/offer/edit/:id')
  .get(middleWares.checkAdminAuth, offerController.editLoad)
  .patch(offerController.updateOffer)

  router
    .route('/offer/:id').delete(middleWares.checkAdminAuth, offerController.deleteCoupon)

  router
    .route("/offer/toggle").patch(middleWares.checkAdminAuth, offerController.toggleStatus)


router
  .route('/dashboard').get(middleWares.checkAdminAuth, dashboardController.dashboardLoad)


router
  .route('/report').get(middleWares.checkAdminAuth, reportController.reportLoad)
router.route('/report/pdf').get(middleWares.checkAdminAuth, reportController.downloadSalesReportPDF)
router.route('/report/excel').get(middleWares.checkAdminAuth, reportController.downloadSalesReportExcel)


router.route('/logout').get(authController.logout)
export default router
