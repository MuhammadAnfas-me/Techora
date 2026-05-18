import Product from '../../models/productModel.js'
import { Categories } from '../../models/categoryModel.js'

const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')


export const getProductList = async ({ page, search, status, brand, category }) => {
  const limit = 5

  const filter = {}

  if (search) {
    filter.name = { $regex: escapeRegex(search), $options: 'i' }
  }
  if (category) filter.categoryId = category
  if (brand) filter.brand = brand

  const categories = await Categories.find()

  let products = await Product.find(filter)
    .populate('categoryId', 'name')
    .sort({ createdAt : -1 })
    .lean()

  if (status) {
    products = products.filter(product => {
      const totalStock = (product.variants || []).reduce((sum, variant) => {
        return sum + (Number(variant.stock) || 0)
      }, 0)

      if (status === 'In Stock') return totalStock > 15
      if (status === 'Low Stock') return totalStock > 0 && totalStock < 15
      if (status === 'Out of Stock') return totalStock === 0

      return true
    })
  }

  const total = products.length
  const totalPages = Math.ceil(total / limit) || 1
  const skip = (page - 1) * limit

  products = products.slice(skip, skip + limit)

  return { products, categories, total, totalPages }
}


export const validateAndCreateProduct = async ({
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
}) => {
  if (!name?.trim()) throw { status: 400, message: 'Product name is required' }
  if (!categoryId?.trim()) throw { status: 400, message: 'Category is required' }
  if (!brand?.trim()) throw { status: 400, message: 'Brand is required' }

  const trimmedName = name.trim()

  const existingName = await Product.findOne({
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' }
  })
  if (existingName) throw { status: 400, message: 'Product name already exist' }

  let parsedSpecifications = []
  let parsedVariants = []
  let parsedImageMap = []

  try {
    parsedSpecifications = specifications ? JSON.parse(specifications) : []
  } catch {
    throw { status: 400, message: 'Invalid specifications data' }
  }

  try {
    parsedVariants = variants ? JSON.parse(variants) : []
  } catch {
    throw { status: 400, message: 'Invalid variants data' }
  }

  try {
    parsedImageMap = imageMap ? JSON.parse(imageMap) : []
  } catch {
    throw { status: 400, message: 'Invalid image map data' }
  }

  if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
    throw { status: 400, message: 'At least one variant is required' }
  }

  for (let i = 0; i < parsedVariants.length; i++) {
    const v = parsedVariants[i]

    if (!v?.sku?.trim()) {
      throw { status: 400, message: `Variant ${i + 1}: SKU is required` }
    }
    if (v.price === '' || Number(v.price) < 0) {
      throw { status: 400, message: `Variant ${i + 1}: Enter valid price` }
    }
    if (v.stock === '' || Number(v.stock) < 0) {
      throw { status: 400, message: `Variant ${i + 1}: Enter valid stock` }
    }
  }

  const variantImageBuckets = parsedVariants.map(() => [])

  uploadedFiles.forEach((file, index) => {
    const variantIndex = Number(parsedImageMap[index])
    if (Number.isNaN(variantIndex) || variantIndex < 0 || variantIndex >= parsedVariants.length) return
    variantImageBuckets[variantIndex].push(file.path)
  })

  const finalVariants = parsedVariants.map((variant, index) => ({
    sku: variant.sku.trim(),
    price: Number(variant.price),
    color: variant.color,
    colorCode: variant.colorCode,
    stock: Number(variant.stock),
    status: variant.status || 'Active',
    image: variantImageBuckets[index]
  }))

  const product = new Product({
    name: trimmedName,
    categoryId,
    brand: brand.trim(),
    status: status || 'active',
    shortDescription: shortDescription?.trim() || '',
    fullDescription: fullDescription?.trim() || '',
    specifications: Array.isArray(parsedSpecifications) ? parsedSpecifications : [],
    variants: finalVariants
  })

  await product.save()

  return product
}


export const getProductWithVariants = async ({ productId, page }) => {
  const limit = 5
  const skip = (page - 1) * limit

  const product = await Product.findById(productId).populate('categoryId', 'name')
  if (!product) throw { status: 404, message: 'Product not found' }

  const total = product.variants?.length || 0
  const totalPages = Math.ceil(total / limit) || 1

  product.variants = (product.variants || []).slice(skip, skip + limit)

  return { product, total, totalPages }
}


export const updateProduct = async ({ id, body, files }) => {
  const product = await Product.findById(id)
  if (!product) throw { status: 404, message: 'Product not found' }

  let {
    name,
    categoryId,
    brand,
    status,
    shortDescription,
    fullDescription,
    specifications,
    variants
  } = body

  name = name?.trim()

  const existingName = await Product.findOne({
    _id: { $ne: id },
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
  })
  if (existingName) throw { status: 400, message: 'Product name already exist' }

  product.name = String(name || '').trim()
  product.categoryId = categoryId
  product.brand = String(brand || '').trim()
  product.status = String(status || '').trim()
  product.shortDescription = String(shortDescription || '').trim()
  product.fullDescription = String(fullDescription || '').trim()

  let parsedSpecifications = []
  if (specifications) {
    try {
      const specs = JSON.parse(specifications)
      if (Array.isArray(specs)) {
        parsedSpecifications = specs
          .map(item => ({
            label: String(item.label || '').trim(),
            value: String(item.value || ' ').trim()
          }))
          .filter(item => item.label && item.value)
      }
    } catch {
      throw { status: 400, message: 'Invalid specification format' }
    }
  }
  product.specifications = parsedSpecifications

  let parsedVariants = []
  if (variants) {
    try {
      const vars = JSON.parse(variants)
      if (Array.isArray(vars)) parsedVariants = vars
    } catch {
      throw { status: 400, message: 'Invalid variants format' }
    }
  }

  const allFiles = Array.isArray(files) ? files : []
  const variantImageMap = {}

  allFiles.forEach(file => {
    if (file.fieldname.startsWith('variantImages_')) {
      const index = Number(file.fieldname.split('_')[1])
      if (!Number.isNaN(index)) {
        if (!variantImageMap[index]) variantImageMap[index] = []
        variantImageMap[index].push(file.path)
      }
    }
  })

  product.variants = parsedVariants.map((variant, index) => {
    const oldVariant = product.variants?.[index] || {}
    const newImages = variantImageMap[index] || []

    return {
      color: variant.color || '',
      colorCode: variant.colorCode || '#0000',
      price: Number(variant.price || 0),
      stock: Number(variant.stock || 0),
      varientId: oldVariant.varientId,
      sku: String(variant.sku),
      image: [
        ...(Array.isArray(variant.image) ? variant.image : []).filter(
          img => typeof img === 'string' && img.trim()
        ),
        ...newImages
      ]
    }
  })

  await product.save()

  return product
}

// ─── BLOCK / UNBLOCK PRODUCT ─────────────────────────────────────────────────

export const toggleProductStatus = async (productId) => {
  const product = await Product.findById(productId)
  if (!product) throw { status: 404, message: 'Product not found' }

  product.status = product.status === 'active' ? 'inactive' : 'active'
  await product.save()

  return product
}

// ─── DELETE VARIANT ───────────────────────────────────────────────────────────

export const removeVariant = async (variantId) => {
  const product = await Product.findOne({ 'variants.varientId': variantId })
  if (!product) throw { status: 404, message: 'Variant not found' }

  if (product.variants.length === 1) {
    throw { status: 400, message: 'At least one variant is required' }
  }

  product.variants = product.variants.filter(v => v.varientId !== variantId)
  await product.save()

  return product
}