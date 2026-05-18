import { generateTxnId } from '../../utils/generateTxnId.js'
import Address from '../../models/addressModel.js'
import { Cart } from '../../models/cartModel.js'
import { Order } from '../../models/orderModel.js'
import { Wallet } from '../../models/walletModel.js'
import Product from '../../models/productModel.js'
import { razorpayInstance } from '../../config/razorpay.js'
import crypto from 'crypto'
import { Coupon } from '../../models/couponModel.js'
import { Offers } from '../../models/offerModel.js'
import { getOfferPrice } from '../../utils/offer.js'
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from '../../constants/orderConstants.js'

class AppError extends Error {
  constructor (message, status = 500) {
    super(message)
    this.name = 'AppError'
    this.status = status
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

async function fetchActiveOffers () {
  const now = new Date()
  return Offers.find({
    isActive: true,
    start: { $lte: now },
    end: { $gte: now }
  }).lean()
}

function calculateCouponDiscount (coupon, subtotal) {
  let discount = 0

  if (coupon.discountType === 'Flat') {
    discount = coupon.discountValue
  } else if (coupon.discountType === 'Percentage') {
    discount = (subtotal * coupon.discountValue) / 100
  }

  if (coupon.maxDiscount) {
    discount = Math.min(discount, coupon.maxDiscount)
  }

  return Math.min(discount, subtotal)
}

function isCouponValid (coupon, subtotal) {
  const now = new Date()
  return (
    coupon.isActive &&
    coupon.expiryDate >= now &&
    (!coupon.startDate || coupon.startDate <= now) &&
    subtotal >= coupon.minOrderValue &&
    (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)
  )
}

function calculateSplitDiscount (coupon, items, subtotal) {
  if (!coupon || !items || items.length === 0) return 0

  let totalDiscount = 0
  let rawDiscount = 0

  if (coupon.discountType === 'Percentage') {
    rawDiscount = (subtotal * coupon.discountValue) / 100
    if (coupon.maxDiscount) {
      rawDiscount = Math.min(rawDiscount, coupon.maxDiscount)
    }
  } else {
    rawDiscount = coupon.discountValue
  }

  items.forEach(item => {
    // item.total should be the price after offers (offerPrice * quantity)
    const itemSubtotal = item.total || item.subtotal || 0
    const itemDiscount = (itemSubtotal / subtotal) * rawDiscount
    totalDiscount += Math.min(itemDiscount, itemSubtotal)
  })

  return Math.round(totalDiscount)
}

// ─────────────────────────────────────────────
// Payment Page Load
// ─────────────────────────────────────────────

export async function buildPaymentPageData (userId, sessionCoupon) {
  const cart = await Cart.findOne({ userId }).populate('items.productId')
  const activeOffers = await fetchActiveOffers()

  let cartItems = []
  let hasInvalidItems = false

  if (cart && Array.isArray(cart.items)) {
    cartItems = cart.items.map(item => {
      const product = item.productId

      if (!product) {
        hasInvalidItems = true
        return {
          name: 'Product not found',
          isValid: false,
          message: 'Product removed'
        }
      }

      const variant = product.variants.find(v => v.varientId === item.variantId)

      if (!variant) {
        hasInvalidItems = true
        return {
          productId: product._id,
          name: product.name,
          isValid: false,
          message: 'Variant not available'
        }
      }

      let isValid = true
      let message = ''

      if (product.status !== 'active') {
        isValid = false
        message = 'Product unavailable'
      } else if (variant.stock === 0) {
        isValid = false
        message = 'Out of stock'
      } else if (item.quantity > variant.stock) {
        isValid = false
        message = `Only ${variant.stock} left`
      }

      if (!isValid) hasInvalidItems = true

      const offerPrice = getOfferPrice(product, variant.price, activeOffers)

      return {
        productId: product._id,
        variantId: item.variantId,
        quantity: item.quantity,
        name: product.name,
        brand: product.brand,
        image: variant.image?.[0] || '',
        price: offerPrice,
        stock: variant.stock,
        subtotal: offerPrice * item.quantity,
        isValid,
        message
      }
    })
  }

  const grandTotal = cartItems.reduce(
    (sum, item) => sum + (item.subtotal || 0),
    0
  )
  let discount = 0
  let finalAmount = grandTotal

  // Re-validate the session coupon — it may have expired since it was applied
  if (sessionCoupon) {
    const coupon = await Coupon.findOne({ couponCode: sessionCoupon.code })
    const now = new Date()

    if (!coupon) throw new AppError('Invalid coupon', 400)
    if (!coupon.isActive) throw new AppError('Coupon inactive', 400)
    if (coupon.expiryDate < now) throw new AppError('Coupon expired', 400)
    if (coupon.startDate && coupon.startDate > now)
      throw new AppError('Coupon not started yet', 400)
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
      throw new AppError('Coupon usage limit reached', 400)

    discount = calculateSplitDiscount(coupon, cartItems, grandTotal)
    finalAmount = Math.round(grandTotal - discount)
  }

  return {
    cartItems,
    grandTotal,
    finalAmount,
    discount: discount ? Math.round(discount) : 0,
    coupon: sessionCoupon ?? null
  }
}

// ─────────────────────────────────────────────
// Create Razorpay Order
// ─────────────────────────────────────────────

export async function createRazorpayOrder (userId, sessionCoupon) {
  const cart = await Cart.findOne({ userId }).populate('items.productId')

  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400)
  }

  const activeOffers = await fetchActiveOffers()
  let subtotal = 0
  const itemsWithOffers = []

  for (const item of cart.items) {
    const product = item.productId
    const variant = product.variants.find(
      v => v.varientId.toString() === item.variantId.toString()
    )
    if (variant) {
      const offerPrice = getOfferPrice(product, variant.price, activeOffers)
      const itemSubtotal = offerPrice * item.quantity
      subtotal += itemSubtotal
      itemsWithOffers.push({ subtotal: itemSubtotal })
    }
  }

  let discount = 0

  if (sessionCoupon) {
    const coupon = await Coupon.findById(sessionCoupon.couponId)
    if (coupon) {
      discount = calculateSplitDiscount(coupon, itemsWithOffers,subtotal)
    }
  }

  const finalTotal = Math.round(subtotal - discount)

  const order = await razorpayInstance.orders.create({
    amount: Math.round(finalTotal * 100),
    currency: 'INR',
    receipt: 'order_' + Date.now()
  })

  return { key: process.env.RAZOR_KEY, order }
}

// ─────────────────────────────────────────────
// Verify Razorpay Payment Signature
// ─────────────────────────────────────────────

export function verifyRazorpaySignature ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
}) {
  const body = razorpay_order_id + '|' + razorpay_payment_id

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZOR_SECRET)
    .update(body.toString())
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    throw new AppError('Payment verification failed', 400)
  }

  return { paymentId: razorpay_payment_id }
}

// ─────────────────────────────────────────────
// Place Order
// ─────────────────────────────────────────────

export async function placeUserOrder (
  userId,
  userMongoId,
  { addressId, paymentMethod, paymentId, sessionCoupon }
) {
  try {
    // ── Address ───────────────────────────────
    const addressDoc = await Address.findOne({ userId, _id: addressId })
    if (!addressDoc) throw new AppError('Address not found', 400)

    // ── Cart ──────────────────────────────────
    const cart = await Cart.findOne({ userId: userMongoId }).populate(
      'items.productId'
    )

    if (!cart || cart.items.length === 0) {
      throw new AppError('Cart is empty', 400)
    }

    const activeOffers = await fetchActiveOffers()

    let orderItems = []
    let subtotal = 0

    for (const item of cart.items) {
      const product = item.productId

      if (!product) throw new AppError('Product not found', 400)

      const variant = product.variants.find(
        v => v.varientId.toString() === item.variantId.toString()
      )

      if (!variant)
        throw new AppError(`${product.name} variant not available`, 400)
      if (product.status === 'inactive')
        throw new AppError(`${product.name} is unavailable`, 400)
      if (variant.stock === 0 || item.quantity > variant.stock) {
        throw new AppError(
          `${product.name} is out of stock or has insufficient quantity`,
          400
        )
      }

      const offerPrice = getOfferPrice(product, variant.price, activeOffers)
      const itemTotal = offerPrice * item.quantity
      subtotal += itemTotal

      orderItems.push({
        productId: product._id,
        name: product.name,
        brand: product.brand,
        variantId: item.variantId,
        color: variant.color,
        quantity: item.quantity,
        price: offerPrice,
        total: itemTotal,
        image: variant.image?.[0] || ''
      })
    }

    // ── Coupon ────────────────────────────────
    let discount = 0
    let couponData = null

    if (sessionCoupon) {
      const coupon = await Coupon.findById(sessionCoupon.couponId)

      if (coupon && isCouponValid(coupon, subtotal)) {
        // Calculate split discount for usage recording and final amount
        discount = calculateSplitDiscount(coupon, orderItems, subtotal)

        couponData = {
          couponId: coupon._id,
          code: coupon.couponCode,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discount
        }

        // Record per-user usage — upsert
        const existingUser = coupon.usedBy.find(
          u => u.userId.toString() === userMongoId.toString()
        )

        if (existingUser) {
          await Coupon.updateOne(
            { _id: coupon._id, 'usedBy.userId': userMongoId },
            { $inc: { usedCount: 1, 'usedBy.$.count': 1 } }
          )
        } else {
          await Coupon.updateOne(
            { _id: coupon._id },
            {
              $push: { usedBy: { userId: userMongoId, count: 1 } },
              $inc: { usedCount: 1 }
            }
          )
        }
      }
    }

    // ── Apply Discount Split to Items ────────
    const itemCount = orderItems.length

    if (couponData && itemCount > 0) {
      const overallDiscount = couponData.discount;
      let remainingDiscount = overallDiscount;

      orderItems = orderItems.map((item, index) => {
        let itemDiscount;
        if (index === itemCount - 1) {
          itemDiscount = remainingDiscount;
        } else {
          itemDiscount = Math.round((item.total / subtotal) * overallDiscount);
          itemDiscount = Math.min(itemDiscount, item.total);
          remainingDiscount -= itemDiscount;
        }

        return {
          ...item,
          discount: itemDiscount,
          finalTotal: item.total - itemDiscount
        }
      });

      couponData.discount = overallDiscount;
      discount = overallDiscount;
    } else {
      orderItems = orderItems.map(item => ({
        ...item,
        discount: 0,
        finalTotal: item.total
      }))
      discount = 0;
    }

    const totalAmount = orderItems.reduce((sum, item) => sum + item.finalTotal, 0)

    // ── Build order document ──────────────────
    const orderId = 'ORD' + Date.now()

    const newOrder = new Order({
      userId: userMongoId,
      orderId,
      addressId,
      items: orderItems,
      subtotal,
      totalAmount,
      coupon: couponData,
      address: {
        name: addressDoc.fullName,
        phone: addressDoc.phone,
        addressLine1: addressDoc.addressLine1,
        addressLine2: addressDoc.addressLine2,
        city: addressDoc.city,
        state: addressDoc.state,
        zipCode: addressDoc.zipCode
      },
      orderStatus: ORDER_STATUS.PLACED
    })

    // ── Payment ───────────────────────────────
    if (paymentMethod === PAYMENT_METHOD.COD) {
      newOrder.paymentMethod = PAYMENT_METHOD.COD
      newOrder.paymentStatus = PAYMENT_STATUS.PENDING
    } else if (paymentMethod === PAYMENT_METHOD.WALLET) {
      const wallet = await Wallet.findOne({ userId: userMongoId })

      if (!wallet || wallet.balance < totalAmount) {
        throw new AppError('Insufficient wallet balance', 400)
      }

      wallet.transaction.push({
        txnId: generateTxnId(),
        type: 'debit',
        amount: totalAmount,
        description: 'Order payment'
      })
      wallet.balance -= totalAmount
      await wallet.save()

      newOrder.paymentMethod = PAYMENT_METHOD.WALLET
      newOrder.paymentStatus = PAYMENT_STATUS.PAID
    } else {
      newOrder.paymentMethod = PAYMENT_METHOD.RAZORPAY
      newOrder.paymentStatus = PAYMENT_STATUS.PAID
      newOrder.razorpayPaymentId = paymentId
    }

    await newOrder.save()
    await Cart.findOneAndDelete({ userId: userMongoId })

    // ── Deduct stock ──────────────────────────
    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId._id, 'variants.varientId': item.variantId },
        { $inc: { 'variants.$.stock': -item.quantity } }
      )
    }

    return { orderId: newOrder.orderId, clearCoupon: true }
  } catch (error) {
    console.error('Order placement failed:', error);

    // ✅ If it was a Razorpay payment and we have a paymentId, it means the user has paid.
    // If the order creation failed (e.g., stock out), we should refund to wallet.
    if (paymentMethod === PAYMENT_METHOD.RAZORPAY && paymentId) {
      try {
        const wallet = await Wallet.findOne({ userId: userMongoId });
        if (wallet) {
          // Re-calculate subtotal and discount if needed, or just fetch payment from razorpay
          // For simplicity, we can fetch the payment details from Razorpay to be 100% sure of the amount
          const payment = await razorpayInstance.payments.fetch(paymentId);
          const refundAmt = payment.amount / 100; // Razorpay amount is in paise

          wallet.balance += refundAmt;
          wallet.transaction.push({
            txnId: generateTxnId(),
            type: 'credit',
            amount: refundAmt,
            description: `Refund for failed order: ${error.message}`
          });
          await wallet.save();
          console.log(`Refunded ${refundAmt} to wallet for user ${userMongoId}`);
          
          error.message = `${error.message}. Since payment was successful, ₹${refundAmt} has been refunded to your wallet.`;
        }
      } catch (refundError) {
        console.error('Failed to process automatic refund:', refundError);
      }
    }
    throw error;
  }
}

// ─────────────────────────────────────────────
// Fetch Order Summary (success page API)
// ─────────────────────────────────────────────

export async function fetchOrderSummary (orderId) {
  const order = await Order.findOne({ orderId })
  if (!order) throw new AppError('Order not found', 400)

  return {
    orderId: order.orderId,
    orderDate: order.createdAt,
    address1: order.address.addressLine1,
    address2: order.address.addressLine2
  }
}
