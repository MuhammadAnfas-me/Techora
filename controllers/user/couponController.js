import { Coupon } from '../../models/couponModel.js'
import { Cart } from '../../models/cartModel.js'
import { Offers } from '../../models/offerModel.js'
import { getOfferPrice } from '../../utils/offer.js'

export const getAvailableCoupons = async (req, res) => {
  try {
    const now = new Date()

    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gte: now },
      $or: [
        { usageLimit: null }, // unlimited coupons
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
      ]
    })

    res.status(200).json({
      success: true,
      coupons
    })
  } catch (err) {
    console.log('Error from getAvailable coupons : ', err)
    res.status(404).json({
      success: false,
      message: 'Server error',
      coupons: []
    })
  }
}

export const applyCoupon = async (req, res) => {
  try {
    const user = req.session.user
    const { code } = req.body

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      })
    }

    if (!code || !code.trim()) {
      return res.json({
        success: false,
        message: 'Enter coupon code'
      })
    }

    if (req.session.coupon) {
      return res.json({
        success: false,
        message: 'Coupon already applied'
      })
    }

    // 🔍 Find coupon
    const coupon = await Coupon.findOne({
      couponCode: code.trim().toUpperCase()
    })

    if (!coupon) {
      return res.json({
        success: false,
        message: 'Invalid coupon'
      })
    }

    const now = new Date()

    // ❌ Basic validations
    if (!coupon.isActive) {
      return res.json({
        success: false,
        message: 'Coupon inactive'
      })
    }

    if (coupon.expiryDate < now) {
      return res.json({
        success: false,
        message: 'Coupon expired'
      })
    }

    if (coupon.startDate && coupon.startDate > now) {
      return res.json({
        success: false,
        message: 'Coupon not started yet'
      })
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.json({
        success: false,
        message: 'Coupon usage limit reached'
      })
    }

    const userUsage = coupon.usedBy.find(
      u => u.userId.toString() === user.id.toString()
    )

    if (userUsage && userUsage.count >= coupon.limit) {
      return res.status(400).json({
        success: false,
        message: 'You have reached the usage limit for this coupon'
      })
    }

    // 🛒 Get cart from DB
    const cart = await Cart.findOne({ userId: user.id }).populate(
      'items.productId'
    )

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: false,
        message: 'Cart is empty'
      })
    }

    const activeOffers = await Offers.find({ isActive: true, start: { $lte: now }, end: { $gte: now } }).lean()

    // 💰 Calculate subtotal (from DB, not trusting frontend)
    let subtotal = 0

    for (let item of cart.items) {
      const product = item.productId

      if (!product) continue

      const variant = product.variants.find(
        v => v.varientId.toString() === item.variantId.toString()
      )

      if (!variant) continue
      const offerPrice = getOfferPrice(product, variant.price, activeOffers)
      subtotal += offerPrice * item.quantity
    }

    // ❌ Minimum order check
    if (subtotal < coupon.minOrderValue) {
      return res.json({
        success: false,
        message: `Minimum order ₹${coupon.minOrderValue} required`
      })
    }

    if (coupon.discountValue >= subtotal) {
      return res.json({
        success: false,
        message: 'Coupon not applicable for this order'
      })
    }

    // 💸 Calculate discount
    let discount = 0

    if (coupon.discountType === 'Flat') {
      discount = coupon.discountValue
    }

    if (coupon.discountType === 'Percentage') {
      discount = (subtotal * coupon.discountValue) / 100
    }

    // 🔒 Prevent over-discount
    discount = Math.min(discount, subtotal)
    const finalTotal = Math.round(subtotal - discount)

    // 💾 Store in session (IMPORTANT)
    req.session.coupon = {
      couponId: coupon._id,
      code: coupon.couponCode
    }

    return res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        code: coupon.couponCode,
        discount: Math.round(discount),
        finalTotal
      }
    })
  } catch (error) {
    console.log('Error in applyCoupon:', error)

    return res.status(500).json({
      success: false,
      message: 'Something went wrong'
    })
  }
}

export const removeCoupon = async (req, res) => {
  try {
    req.session.coupon = null

    const user = req.session.user

    const cart = await Cart.findOne({ userId: user.id }).populate(
      'items.productId'
    )

    let subtotal = 0

    for (let item of cart.items) {
      const variant = item.productId.variants.find(
        v => v.varientId.toString() === item.variantId.toString()
      )

      subtotal += variant.price * item.quantity
    }

    return res.json({
      success: true,
      subtotal,
      discount: 0,
      finalTotal: subtotal
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false })
  }
}
