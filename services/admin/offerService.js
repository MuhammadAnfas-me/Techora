import { Categories } from '../../models/categoryModel.js'
import { Order } from '../../models/orderModel.js'
import { Offers } from '../../models/offerModel.js'
import Product from '../../models/productModel.js'

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

// ─────────────────────────────────────────────
// Shared helper
// ─────────────────────────────────────────────


async function getMinProductPrice (scope, productId, categoryId) {
  let minPrice = Infinity

  if (scope === 'product') {
    const product = await Product.findById(productId)
    product?.variants?.forEach(v => {
      if (v.price < minPrice) minPrice = v.price
    })
  } else if (scope === 'category') {
    const products = await Product.find({ categoryId })
    products.forEach(p => {
      p.variants?.forEach(v => {
        if (v.price < minPrice) minPrice = v.price
      })
    })
  }

  return minPrice
}

// ─────────────────────────────────────────────
// Offer List
// ─────────────────────────────────────────────


export async function fetchOfferList ({ page, limit, search, type, status }) {
  const query = {}

  if (search) {
    query.name = { $regex: search, $options: 'i' }
  }

  if (type && type !== 'All') {
    query.type = type
  }

  if (status && status !== 'All') {
    const today = new Date()

    if (status === 'Active') {
      query.start = { $lte: today }
      query.end   = { $gte: today }
    } else if (status === 'Expired') {
      query.end = { $lt: today }
    } else if (status === 'Scheduled') {
      query.start = { $gt: today }
    }
  }

  const [totalOffers, offers] = await Promise.all([
    Offers.countDocuments(query),
    Offers.find(query)
      .sort({ createdAt: -1 })
      .populate('product', 'name')
      .populate('category', 'name')
  ])

  if (!offers) {
    throw new AppError('Failed to load offers', 400)
  }

  return {
    offers,
    currentPage: page,
    totalPages:  Math.ceil(totalOffers / limit),
    totalOffers,
    search,
    limit,
    type,
    status
  }
}

// ─────────────────────────────────────────────
// List Categories (dropdown API)
// ─────────────────────────────────────────────


export async function fetchActiveCategories () {
  const categories = await Categories.find({ isActive: true })

  if (!categories) {
    throw new AppError('Failed to fetch categories', 400)
  }

  return categories
}

// ─────────────────────────────────────────────
// List Products (dropdown API)
// ─────────────────────────────────────────────


export async function fetchActiveProducts () {
  const products = await Product.find({ status: 'active' })

  if (!products) {
    throw new AppError('Failed to fetch products', 400)
  }

  return products
}

// ─────────────────────────────────────────────
// Add Offer
// ─────────────────────────────────────────────


export async function createOffer ({
  name, type, value, scope,
  product: productId, category: categoryId,
  start, end, isActive, maxDiscount
}) {
  // ── Basic field validation ────────────────
  if (!name?.trim()) throw new AppError('Offer name required', 400)

  if (!['flat', 'percentage'].includes(type)) {
    throw new AppError('Invalid offer type', 400)
  }

  if (!value || value <= 0) throw new AppError('Invalid value', 400)

  if (type === 'percentage' && value > 80) {
    throw new AppError('Percentage cannot exceed 80', 400)
  }

  // maxDiscount validation — only relevant for percentage offers
  if (type === 'percentage' && maxDiscount !== null && maxDiscount !== undefined && maxDiscount !== '') {
    const mxD = Number(maxDiscount)
    if (isNaN(mxD) || mxD <= 0) {
      throw new AppError('Maximum discount must be a positive number', 400)
    }
  }

  if (!['product', 'category'].includes(scope)) {
    throw new AppError('Invalid scope', 400)
  }

  if (scope === 'product'  && !productId)  throw new AppError('Product required', 400)
  if (scope === 'category' && !categoryId) throw new AppError('Category required', 400)

  if (!start || !end) throw new AppError('Dates required', 400)

  if (new Date(start) >= new Date(end)) {
    throw new AppError('Invalid date range', 400)
  }

  const existingName = await Offers.findOne({ name })
  if (existingName) {
    throw new AppError('Name is already existing', 400)
  }

  const duplicateQuery =
    scope === 'product'
      ? { scope: 'product',   product:  productId,  isActive: true, isDeleted: false }
      : { scope: 'category',  category: categoryId, isActive: true, isDeleted: false }

  const existing = await Offers.findOne(duplicateQuery)
  if (existing) {
    throw new AppError('Offer already exists for this target', 400)
  }

  if (type === 'flat') {
    const minPrice = await getMinProductPrice(scope, productId, categoryId)
    if (minPrice !== Infinity && value >= minPrice) {
      throw new AppError(
        'Flat discount cannot be equal to or exceed the minimum product price.',
        400
      )
    }
  }

  const offer = new Offers({
    name:        name.trim(),
    type,
    value:       Number(value),
    maxDiscount: (type === 'percentage' && maxDiscount) ? Number(maxDiscount) : null,
    scope,
    product:  scope === 'product'  ? productId  : null,
    category: scope === 'category' ? categoryId : null,
    start,
    end,
    isActive: isActive ?? true
  })

  await offer.save()

  return offer
}

// ─────────────────────────────────────────────
// Edit Page Load
// ─────────────────────────────────────────────


export async function getOfferForEdit (name) {
  const offer = await Offers.findOne({ name })

  if (!offer) {
    throw new AppError('Offer not found', 404)
  }

  let items    = null
  let selected = null

  if (offer.category != null) {
    items    = await Categories.find()
    selected = items.find(item => item._id.equals(offer.category))
  } else if (offer.product != null) {
    items    = await Product.find()
    selected = items.find(item => item._id.equals(offer.product))
  }

  return { offer, items, selected, selectedId: selected._id }
}

// ─────────────────────────────────────────────
// Update Offer
// ─────────────────────────────────────────────

export async function updateOffer (nameId, {
  name, type, value, start, end,
  scope, product: productId, category: categoryId, isActive, maxDiscount
}) {
  // ── Basic validation ──────────────────────
  if (!name || !type || !value || !start || !end) {
    throw new AppError('All fields required', 400)
  }

  if (new Date(start) >= new Date(end)) {
    throw new AppError('Expiry must be after start date', 400)
  }

  if (type === 'percentage' && value > 80) {
    throw new AppError('Percentage cannot exceed 80', 400)
  }

  // maxDiscount validation — only relevant for percentage offers
  if (type === 'percentage' && maxDiscount !== null && maxDiscount !== undefined && maxDiscount !== '') {
    const mxD = Number(maxDiscount)
    if (isNaN(mxD) || mxD <= 0) {
      throw new AppError('Maximum discount must be a positive number', 400)
    }
  }

  // ── Flat discount vs min product price ────
  if (type === 'flat') {
    const minPrice = await getMinProductPrice(scope, productId, categoryId)
    if (minPrice !== Infinity && value >= minPrice) {
      throw new AppError(
        'Flat discount cannot be equal to or exceed the minimum product price.',
        400
      )
    }
  }

  const updateData = {
    name,
    type,
    value:       Number(value),
    maxDiscount: (type === 'percentage' && maxDiscount) ? Number(maxDiscount) : null,
    start,
    end,
    scope,
    product:  scope === 'product'  ? productId  : null,
    category: scope === 'category' ? categoryId : null,
    isActive
  }

  await Offers.findOneAndUpdate({ name: nameId }, updateData, { new: true })
}

// ─────────────────────────────────────────────
// Delete Offer (soft delete)
// ─────────────────────────────────────────────

export async function softDeleteOffer (offerId) {
  if (!offerId) {
    throw new AppError('Offer Id is required', 400)
  }

  const offer = await Offers.findById(offerId)
  if (!offer)          throw new AppError('Offer not found', 404)
  if (offer.isDeleted) throw new AppError('Offer already deleted', 400)

  const isUsed = await Order.exists({ _id: offerId })
  if (isUsed) {
    throw new AppError('Cannot delete Offer already used in orders', 400)
  }

  offer.isDeleted = true
  offer.isActive  = false
  await offer.save()
}

// ─────────────────────────────────────────────
// Toggle Status
// ─────────────────────────────────────────────


export async function toggleOfferStatus (id) {
  const offer = await Offers.findById(id)
  if (!offer) {
    throw new AppError('Offer not found', 400)
  }

  offer.isActive = !offer.isActive
  await offer.save()

  return {
    isActive: offer.isActive,
    message:  `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`
  }
}