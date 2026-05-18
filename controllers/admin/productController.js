import mongoose from 'mongoose'
import { Categories } from '../../models/categoryModel.js'
import Product from '../../models/productModel.js'
import {
  getProductList,
  validateAndCreateProduct,
  getProductWithVariants,
  updateProduct,
  toggleProductStatus,
  removeVariant
} from '../../services/admin/productService.js'

// ─── LOAD PRODUCTS ────────────────────────────────────────────────────────────

const loadProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const search = (req.query.search || '').trim()
    const status = (req.query.status || '').trim()
    const brand = (req.query.brand || '').trim()
    const category = (req.query.category || '').trim()

    const { products, categories, total, totalPages } = await getProductList({
      page,
      search,
      status,
      brand,
      category
    })

    return res.render('Admin/products/productList', {
      currentPage: 'products',
      products,
      categories,
      totalPages,
      total,
      page,
      selectedCategory: category,
      selectedBrand: brand,
      selectedStockStatus: status,
      search
    })
  } catch (error) {
    console.error('Error from loadProducts', error.message)
    return res.status(500).json({ success: false, message: 'Failed to load products' })
  }
}

// ─── LOAD ADD PAGE ────────────────────────────────────────────────────────────

const loadAddPage = async (req, res) => {
  const categories = await Categories.find({ isActive: true })
  res.render('Admin/products/addPage', { currentPage: 'products', categories })
}

// ─── ADD PRODUCT ──────────────────────────────────────────────────────────────

const addProduct = async (req, res) => {
  try {
    const { name, categoryId, brand, status, shortDescription, fullDescription, specifications, variants, imageMap } = req.body
    const uploadedFiles = req.files?.variantImages || []

    await validateAndCreateProduct({
      name,
      categoryId,
      brand,
      status,
      shortDescription,
      fullDescription,
      specifications,
      variants,
      imageMap,
      uploadedFiles
    })

    return res.status(201).json({ success: true, message: 'Product added successfully' })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message })
    }
    console.error('addProduct error:', error)
    return res.status(500).json({ message: 'Failed to add product' })
  }
}

// ─── VARIANT LIST ─────────────────────────────────────────────────────────────

const variantLoad = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1

    const { product, total, totalPages } = await getProductWithVariants({
      productId: req.params.id,
      page
    })

    res.render('Admin/products/variantsList.ejs', {
      currentPage: 'products',
      product,
      totalPages,
      page,
      total
    })
  } catch (error) {
    const statusCode = error.status || 500
    res.status(statusCode).render('error', { 
      statusCode, 
      message: error.message || 'Server Error' 
    })
  }
}

// ─── LOAD EDIT PAGE ───────────────────────────────────────────────────────────

const loadEdit = async (req, res) => {
  const id = req.params.id

  const [product, categories] = await Promise.all([
    Product.findById(id),
    Categories.find({ isActive: true })
  ])

  res.render('Admin/products/editPage.ejs', {
    currentPage: 'products',
    product,
    categories
  })
}

// ─── EDIT PRODUCT ─────────────────────────────────────────────────────────────

const editProduct = async (req, res) => {
  try {
    const id = req.params.id

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product Id' })
    }

    const product = await updateProduct({ id, body: req.body, files: req.files })

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message })
    }
    console.error('editProduct error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update product', error: error.message })
  }
}

// ─── BLOCK / UNBLOCK PRODUCT ──────────────────────────────────────────────────

const blockProduct = async (req, res) => {
  try {
    const product = await toggleProductStatus(req.params.id)

    return res.status(200).json({
      success: true,
      message: `Product ${product.status === 'active' ? 'unblocked' : 'blocked'} successfully`
    })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message })
    }
    console.error('Error from blockProduct:', error)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

// ─── DELETE VARIANT ───────────────────────────────────────────────────────────

const deleteVariant = async (req, res) => {
  try {
    await removeVariant(req.params.id)

    return res.status(200).json({ success: true, message: 'Variant deleted successfully' })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message })
    }
    console.error('Error from deleteVariant:', error)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export {
  loadProducts,
  loadAddPage,
  addProduct,
  variantLoad,
  loadEdit,
  editProduct,
  blockProduct,
  deleteVariant
}
