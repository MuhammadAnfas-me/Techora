import { Coupon } from '../../models/couponModel.js'
import { Cart } from '../../models/cartModel.js'
import { Offers } from '../../models/offerModel.js'
import { getOfferPrice } from '../../utils/offer.js'

// ─────────────────────────────────────────────
// Shared helper
// ─────────────────────────────────────────────


async function fetchActiveOffers () {
  const now = new Date()
  return Offers.find({
    isActive: true,
    start: { $lte: now },
    end: { $gte: now }
  }).lean()
}

async function calculateCartSubtotal (cart, activeOffers) {
  let subtotal = 0

  for (const item of cart.items) {
    const product = item.productId
    if (!product) continue

    const variant = product.variants.find(
      v => v.varientId.toString() === item.variantId.toString()
    )
    if (!variant) continue

    const offerPrice = getOfferPrice(product, variant.price, activeOffers)
    subtotal += offerPrice * item.quantity
  }

  return subtotal
}

// ─────────────────────────────────────────────
// Get Available Coupons
// ─────────────────────────────────────────────


export async function fetchAvailableCoupons () {
  const now = new Date()

  return Coupon.find({
    isActive: true,
    expiryDate: { $gte: now },
    $or: [
      { usageLimit: null },
      { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
    ]
  })
}

// ─────────────────────────────────────────────
// Apply Coupon
// ─────────────────────────────────────────────

export async function applyUserCoupon ({ code, userId, alreadyApplied }) {
  if (!code || !code.trim()) {
    throw Object.assign(new Error('Enter coupon code'), { status: 200 })
  }

  if (alreadyApplied) {
    throw Object.assign(new Error('Coupon already applied'), { status: 200 })
  }

  // ── Lookup ────────────────────────────────
  const coupon = await Coupon.findOne({
    couponCode: code.trim().toUpperCase()
  })

  if (!coupon) {
    throw Object.assign(new Error('Invalid coupon'), { status: 200 })
  }

  const now = new Date()

  // ── Basic validations ─────────────────────
  if (!coupon.isActive) {
    throw Object.assign(new Error('Coupon inactive'), { status: 200 })
  }

  if (coupon.expiryDate < now) {
    throw Object.assign(new Error('Coupon expired'), { status: 200 })
  }

  if (coupon.startDate && coupon.startDate > now) {
    throw Object.assign(new Error('Coupon not started yet'), { status: 200 })
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw Object.assign(new Error('Coupon usage limit reached'), { status: 200 })
  }

  // ── Per-user usage limit ──────────────────
  const userUsage = coupon.usedBy.find(
    u => u.userId.toString() === userId.toString()
  )

  if (userUsage && userUsage.count >= coupon.limit) {
    throw Object.assign(
      new Error('You have reached the usage limit for this coupon'),
      { status: 400 }
    )
  }

  // ── Cart subtotal ─────────────────────────
  const cart = await Cart.findOne({ userId }).populate('items.productId')

  if (!cart || cart.items.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { status: 200 })
  }

  const activeOffers = await fetchActiveOffers()
  const subtotal = await calculateCartSubtotal(cart, activeOffers)

  // ── Order value checks ────────────────────
  if (subtotal < coupon.minOrderValue) {
    throw Object.assign(
      new Error(`Minimum order ₹${coupon.minOrderValue} required`),
      { status: 200 }
    )
  }

  if (coupon.discountValue >= subtotal) {
    throw Object.assign(
      new Error('Coupon not applicable for this order'),
      { status: 200 }
    )
  }

  // ── Discount calculation (Split Logic) ────
  const itemCount = cart.items.length
  let discount = 0

  if (itemCount > 0) {
    for (const item of cart.items) {
      const product = item.productId
      const variant = product.variants.find(
        v => v.varientId.toString() === item.variantId.toString()
      )
      const offerPrice = getOfferPrice(product, variant.price, activeOffers)
      const itemSubtotal = offerPrice * item.quantity
      
      let itemDiscount = 0
      if (coupon.discountType === 'Percentage') {
        const splitPercentage = coupon.discountValue / itemCount
        itemDiscount = Math.round((itemSubtotal * splitPercentage) / 100)
      } else {
        itemDiscount = Math.round(coupon.discountValue / itemCount)
      }
      
      discount += Math.min(itemDiscount, itemSubtotal)
    }
  }

  // Apply maxDiscount cap
  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
    discount = coupon.maxDiscount
  }

  const finalTotal = Math.round(subtotal - discount)

  return {
    couponId: coupon._id,
    code: coupon.couponCode,
    discount: Math.round(discount),
    finalTotal,
    subtotal
  }
}

// ─────────────────────────────────────────────
// Remove Coupon
// ─────────────────────────────────────────────


export async function recalculateAfterCouponRemoval (userId) {
  const cart = await Cart.findOne({ userId }).populate('items.productId')

  const activeOffers = await fetchActiveOffers()
  let subtotal = 0

  for (const item of cart.items) {
    const product = item.productId
    const variant = product.variants.find(
      v => v.varientId.toString() === item.variantId.toString()
    )
    const offerPrice = getOfferPrice(product, variant.price, activeOffers)
    subtotal += offerPrice * item.quantity
  }

  return { subtotal, discount: 0, finalTotal: subtotal }
}