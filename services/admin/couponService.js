import { Coupon } from '../../models/couponModel.js'
import { Order } from '../../models/orderModel.js'


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


function resolveUsageBar (coupon) {
  let usedBar  = 0
  let barClass = 'bar-green'

  if (coupon.usageLimit !== null) {
    usedBar = Math.min(Math.round((coupon.usedCount / coupon.usageLimit) * 100), 100)
    if (usedBar >= 90)  barClass = 'bar-orange'
    if (usedBar === 100) barClass = 'bar-gray'
  }

  return { usedBar, barClass }
}


function resolveCouponStatus (coupon) {
  if (!coupon.isActive) return 'Disabled'
  if (new Date(coupon.expiryDate) < new Date()) return 'Expired'
  return 'Active'
}

function validateDiscountValues (discountType, discountValue, minOrder, maxDiscount) {
  const dVal = Number(discountValue)
  const mOrder = Number(minOrder)
  const mxDiscount = maxDiscount !== null ? Number(maxDiscount) : null

  if (isNaN(dVal) || dVal <= 0) {
    throw new AppError('Discount value must be a positive number', 400)
  }

  if (isNaN(mOrder) || mOrder < 0) {
    throw new AppError('Minimum order value must be a non-negative number', 400)
  }

  if (mxDiscount !== null && (isNaN(mxDiscount) || mxDiscount <= 0)) {
    throw new AppError('Maximum discount must be a positive number', 400)
  }

  if (discountType === 'Flat' && dVal >= mOrder) {
    throw new AppError('Flat discount must be less than the minimum order value', 400)
  }

  if (discountType === 'Percentage') {
    if (dVal > 80) {
      throw new AppError('Percentage discount cannot exceed 80%', 400)
    }
  }
}

function validateCouponCode(code) {
  const trimmed = code?.trim()
  if (!trimmed) throw new AppError('Coupon code is required', 400)
  
  const regex = /^[A-Z0-9]{3,15}$/
  if (!regex.test(trimmed.toUpperCase())) {
    throw new AppError('Coupon code must be 3-15 characters and alphanumeric (no spaces)', 400)
  }
  return trimmed.toUpperCase()
}

// ─────────────────────────────────────────────
// Coupon List
// ─────────────────────────────────────────────


export async function fetchCouponList ({ page, search, type, status }) {
  const limit = 8
  const skip  = (page - 1) * limit

  const query = { isDeleted: { $ne: true } }

  if (search) {
    query.couponCode = { $regex: search, $options: 'i' }
  }

  if (type && type !== 'All') {
    query.discountType = type
  }

  if (status && status !== 'All Status') {
    if (status === 'Active') {
      query.isActive    = true
      query.expiryDate  = { $gte: new Date() }
    } else if (status === 'Expired') {
      query.expiryDate  = { $lt: new Date() }
    } else if (status === 'Disabled') {
      query.isActive    = false
    }
  }

  const [coupons, totalCoupons] = await Promise.all([
    Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Coupon.countDocuments()          
  ])

  const totalPages = Math.ceil(totalCoupons / limit)

  const formattedCoupons = coupons.map(c => {
    const { usedBar, barClass } = resolveUsageBar(c)

    return {
      code:        c.couponCode,
      type:        c.discountType,
      value:       c.discountValue,
      minOrder:    c.minOrderValue,
      usageLimit:  c.usageLimit === null ? 'Unlimited' : c.usageLimit,
      used:        c.usedCount,
      usedBar,
      barClass,
      expiry:      c.expiryDate,
      status:      resolveCouponStatus(c),
      toggleOn:    c.isActive
    }
  })

  return { coupons: formattedCoupons, currentPage: page, totalPages, totalCoupons, limit, search, type, status }
}

// ─────────────────────────────────────────────
// Add Coupon
// ─────────────────────────────────────────────


export async function createCoupon ({
  couponCode,
  discountType,
  discountValue,
  minOrder,
  usageLimit,
  limitPerUser,
  startDate,
  expiryDate,
  isActive,
  internalNotes,
  maxDiscount
}) {
  couponCode = validateCouponCode(couponCode)

  if (!discountType)  throw new AppError('Please select discount type', 400)
  if (!discountValue) throw new AppError('Please enter discount value', 400)
  if (!minOrder)      throw new AppError('Please enter Minimum order value', 400)
  if (!limitPerUser)  throw new AppError('Limit is required', 400)
  if (!startDate)     throw new AppError('Please select starting date', 400)
  if (!expiryDate)    throw new AppError('Please select expiry date', 400)

  if (Number(limitPerUser) <= 0) throw new AppError('Limit per user must be at least 1', 400)

  const now = new Date()
  now.setHours(0,0,0,0)
  if (new Date(startDate) < now) {
    throw new AppError('Start date cannot be in the past', 400)
  }

  const exists = await Coupon.findOne({ couponCode: couponCode.toUpperCase() })
  if (exists) {
    throw new AppError('Coupon already exists', 400)
  }

  validateDiscountValues(discountType, discountValue, minOrder, maxDiscount)

  const newCoupon = new Coupon({
    couponCode:    couponCode.toUpperCase(),
    discountType,
    discountValue,
    minOrderValue: minOrder,
    maxDiscount:   maxDiscount === null ? null : Number(maxDiscount),
    usageLimit:    usageLimit === null ? null : Number(usageLimit),
    limit:         limitPerUser,
    startDate,
    expiryDate,
    isActive,
    internalNotes: internalNotes || ''
  })

  await newCoupon.save()
}

// ─────────────────────────────────────────────
// Edit Page Load
// ─────────────────────────────────────────────

export async function getCouponByCode (code) {
  const coupon = await Coupon.findOne({ couponCode: code })
  if (!coupon) {
    throw new AppError('Coupon not found', 404)
  }
  return coupon
}

// ─────────────────────────────────────────────
// Edit Coupon
// ─────────────────────────────────────────────


export async function updateCoupon (currentCode, {
  couponCode,
  discountType,
  discountValue,
  minOrder,
  usageLimit,
  limitPerUser,
  startDate,
  expiryDate,
  isActive,
  internalNotes,
  maxDiscount
}) {
  minOrder      = Number(minOrder)
  discountValue = Number(discountValue)
  couponCode = validateCouponCode(couponCode)

  if (!discountType)  throw new AppError('Please select discount type', 400)
  if (!discountValue) throw new AppError('Please enter discount value', 400)
  if (!minOrder)      throw new AppError('Please enter Minimum order value', 400)
  if (!limitPerUser)  throw new AppError('Limit is required', 400)
  if (!startDate)     throw new AppError('Please select starting date', 400)
  if (!expiryDate)    throw new AppError('Please select expiry date', 400)

  if (Number(limitPerUser) <= 0) throw new AppError('Limit per user must be at least 1', 400)

  if (usageLimit !== null && usageLimit !== '' && Number(usageLimit) <= 0) {
    throw new AppError('Usage limit must be greater than 0', 400)
  }

  if (new Date(startDate) >= new Date(expiryDate)) {
    throw new AppError('Expiry date must be after start date', 400)
  }

  const existingCoupon = await Coupon.findOne({ couponCode: currentCode })
  if (!existingCoupon) {
    throw new AppError('Coupon not found', 404)
  }

  const duplicate = await Coupon.findOne({
    couponCode,
    _id: { $ne: existingCoupon._id }
  })
  if (duplicate) {
    throw new AppError('Coupon already exists', 400)
  }

  validateDiscountValues(discountType, discountValue, minOrder, maxDiscount)

  await Coupon.findOneAndUpdate(
    { _id: existingCoupon._id },
    {
      couponCode:    couponCode.toUpperCase(),
      discountType,
      discountValue,
      minOrderValue: minOrder,
      maxDiscount:   maxDiscount === null ? null : Number(maxDiscount),
      usageLimit:    usageLimit === null ? null : Number(usageLimit),
      limit:         limitPerUser,
      startDate,
      expiryDate,
      isActive,
      internalNotes: internalNotes || ''
    }
  )
}

// ─────────────────────────────────────────────
// Status Toggle
// ─────────────────────────────────────────────


export async function toggleCouponStatus (code) {
  const coupon = await Coupon.findOne({ couponCode: code })
  if (!coupon) {
    throw new AppError('Coupon not found', 400)
  }

  coupon.isActive = !coupon.isActive
  await coupon.save()

  return {
    isActive: coupon.isActive,
    message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`
  }
}

// ─────────────────────────────────────────────
// Delete Coupon (soft delete)
// ─────────────────────────────────────────────


export async function softDeleteCoupon (code) {
  if (!code) {
    throw new AppError('Coupon name is required', 400)
  }

  const coupon = await Coupon.findOne({ couponCode: code })
  if (!coupon) {
    throw new AppError('Coupon not found', 404)
  }

  if (coupon.isDeleted) {
    throw new AppError('Coupon already deleted', 400)
  }

  const isUsed = await Order.exists({ couponCode: coupon.couponCode })
  if (isUsed) {
    throw new AppError('Cannot delete coupon already used in orders', 400)
  }

  coupon.isDeleted = true
  coupon.isActive  = false
  await coupon.save()
}