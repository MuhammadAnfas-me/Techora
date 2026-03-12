import express from 'express'
import * as userController from '../../controllers/admin/userController.js'
import * as authController from '../../controllers/admin/authController.js'
import * as categoryController from '../../controllers/admin/categoryController.js'
import * as productController from "../../controllers/admin/productController.js"

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

router.route('/category').get(middleWares.checkAdminAuth,categoryController.categoryListPage)
router.route('/category/api').get(middleWares.checkAdminAuth,categoryController.categoryListApi)

router
  .route('/category/add')
  .get(middleWares.checkAdminAuth,categoryController.addCategoryLoad)
  .post(middleWares.checkAdminAuth,categoryController.addCategory)

router
  .route('/category/:id')
  .get(middleWares.checkAdminAuth,categoryController.editPageLoad)
  .patch(middleWares.checkAdminAuth,categoryController.editCategory)
  .delete(middleWares.checkAdminAuth,categoryController.deleteCategory)

  


// --------------- Product Listing and Management ---------------//

router
  .route("/products")
  .get(middleWares.checkAdminAuth,productController.loadProducts)

router
  .route("/products/add")
  .get(middleWares.checkAdminAuth,productController.loadAddPage)
  .post(middleWares.checkAdminAuth,uploadProductImage.fields([
    {name : "variantImages" , maxCount : 20}
  ]),productController.addProduct)


router
  .route("/products/variants/:id")
  .get(middleWares.checkAdminAuth,productController.variantLoad)
  .delete(middleWares.checkAdminAuth,productController.deleteVariant)

router
  .route("/products/:id")
  .get(middleWares.checkAdminAuth,productController.loadEdit)
  .patch(middleWares.checkAdminAuth,uploadProductImage.any()
  ,productController.editProduct)

router
  .route("/products/:id/block")
  .patch(middleWares.checkAdminAuth,productController.blockCategory)



router.route('/logout').get(authController.logout)
export default router
