import { Categories } from '../../models/categoryModel.js'
import Product from '../../models/productModel.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
dayjs.extend(relativeTime)


class AppError extends Error {
  constructor (message, status = 500) {
    super(message)
    this.name   = 'AppError'
    this.status = status
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ─────────────────────────────────────────────
// Category List (API)
// ─────────────────────────────────────────────


export async function fetchCategoryList ({ page, search, status }) {
  const limit = 5
  const skip  = (page - 1) * limit

  const filter = {}

  if (search) {
    filter.name = { $regex: escapeRegex(search), $options: 'i' }
  }

  if (status === 'Active') {
    filter.isActive = true
  } else if (status === 'Inactive') {
    filter.isActive = false
  }

  const [categories, total, productCount] = await Promise.all([
    Categories.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Categories.countDocuments(filter),
    Product.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }])
  ])

  const countMap = {}
  productCount.forEach(item => {
    countMap[item._id.toString()] = item.count
  })

  const categoriesWithCount = categories.map(category => ({
    ...category,
    productCount: countMap[category._id.toString()] || 0
  }))

  return {
    categories: categoriesWithCount,
    total,
    filter: { search, status },
    totalPages: Math.ceil(total / limit),
    page
  }
}

// ─────────────────────────────────────────────
// Add Category
// ─────────────────────────────────────────────

export async function createCategory ({ name, isActive }) {
  const trimmed = name?.trim()

  if (!trimmed) {
    throw new AppError('All fields required', 400)
  }

  const exists = await Categories.findOne({
    name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' }
  })

  if (exists) {
    throw new AppError('Category name already used', 400)
  }

  await Categories.create({ name: trimmed, isActive })
}

// ─────────────────────────────────────────────
// Edit Page Load
// ─────────────────────────────────────────────

export async function getCategoryForEdit (id) {
  const category = await Categories.findById(id)

  if (!category) {
    throw new AppError("Category doesn't exist", 400)
  }

  const productsCount = await Product.countDocuments({ categoryId: category._id })

  category.lastUpdated = dayjs(category.updatedAt).fromNow()

  return { category, productsCount }
}

// ─────────────────────────────────────────────
// Edit Category
// ─────────────────────────────────────────────


export async function updateCategory (id, { name, isActive }) {
  const existing = await Categories.findOne({
    _id: { $ne: id },
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
  })

  if (existing) {
    throw new AppError('Name already exists', 400)
  }

  // Existence check
  const category = await Categories.findById(id)
  if (!category) {
    throw new AppError("This category doesn't exist", 400)
  }

  const updateFields = {}
  if (name     !== undefined) updateFields.name     = name.trim()
  if (isActive !== undefined) updateFields.isActive = isActive

  if (Object.keys(updateFields).length === 0) {
    throw new AppError('Nothing to update', 400)
  }

  const updated = await Categories.findOneAndUpdate(
    { _id: id },
    { $set: updateFields },
    { new: true, runValidators: true }
  )

  if (!updated) {
    throw new AppError('Category not found', 404)
  }

  return updated
}

// ─────────────────────────────────────────────
// Delete Category
// ─────────────────────────────────────────────


export async function deleteCategoryHandler (id) {
  const category = await Categories.findById(id)

  if (!category) {
    throw new AppError("Category doesn't exist", 400)
  }

  await Categories.deleteOne({ _id: id })
}