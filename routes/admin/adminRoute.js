import express from 'express'
import * as userController from '../../controllers/admin/userController.js'
import * as authController from '../../controllers/admin/authController.js'
import * as categoryController from '../../controllers/admin/categoryController.js'
import * as productController from "../../controllers/admin/productController.js"

import * as middleWares from '../../middlewares/admin/adminAuth.js'

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

router.route('/category').get(categoryController.categoryListPage)
router.route('/category/api').get(categoryController.categoryListApi)

router
  .route('/category/add')
  .get(categoryController.addCategoryLoad)
  .post(categoryController.addCategory)

router
  .route('/category/:id')
  .get(categoryController.editPageLoad)
  .patch(categoryController.editCategory)
  .delete(categoryController.deleteCategory)

// --------------- Product Listing and Management ---------------//

router
  .route("/products")
  .get(productController.loadProducts)

router
  .route("/products/add")
  .get(productController.loadAddPage)
  .post(productController.addProduct)

router.route('/logout').get(authController.logout)
export default router
