import puppeteer from 'puppeteer'
import ejs from 'ejs'
import path from 'path'

import { Order } from '../../models/orderModel.js'
import Product from '../../models/productModel.js'
import { Wallet } from '../../models/walletModel.js'
import { Review } from '../../models/reviewModel.js'
import { Coupon } from '../../models/couponModel.js'
import { formatDate } from '../../services/dateFormat.js'
import { getBrowser } from '../../utils/pupeteer.js'
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_STATUS,
  RETURN_STATUS
} from '../../constants/orderConstants.js'

// ─────────────────────────────────────────────
// Shared helper
// ─────────────────────────────────────────────

export const getStatusText = status => {
  switch (status) {
    case ORDER_STATUS.PLACED:
      return 'Order Placed'
    case ORDER_STATUS.CONFIRMED:
      return 'Confirmed'
    case ORDER_STATUS.SHIPPED:
      return 'Shipped - In Transit'
    case ORDER_STATUS.DELIVERED:
      return 'Delivered'
    case ORDER_STATUS.CANCELLED:
      return 'Cancelled'
    default:
      return status
  }
}

const REFUNDABLE_METHODS = [PAYMENT_METHOD.RAZORPAY, PAYMENT_METHOD.WALLET]

// ─────────────────────────────────────────────
// Order Dashboard
// ─────────────────────────────────────────────


export async function getOrderDashboardData (userId) {
  const [orders, totalOrders, delivered, shipped, cancelled] =
    await Promise.all([
      Order.find({ userId }).sort({ createdAt: -1 }).limit(4),
      Order.countDocuments({ userId }),
      Order.countDocuments({ userId, orderStatus: ORDER_STATUS.DELIVERED }),
      Order.countDocuments({ userId, orderStatus: ORDER_STATUS.SHIPPED }),
      Order.countDocuments({ userId, orderStatus: ORDER_STATUS.CANCELLED })
    ])

  return { orders, totalOrders, delivered, shipped, cancelled }
}

// ─────────────────────────────────────────────
// Order List
// ─────────────────────────────────────────────

export async function getOrderList (userId, { search, status, page }) {
  const limit = 6
  const skip = (page - 1) * limit

  const query = { userId }
  if (search) query.orderId = { $regex: search, $options: 'i' }
  if (status && status !== 'all') query.orderStatus = status

  const [orders, totalOrders] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(query)
  ])

  return {
    orders,
    currentPage: page,
    totalPages: Math.ceil(totalOrders / limit),
    search,
    status
  }
}

// ─────────────────────────────────────────────
// Order Details
// ─────────────────────────────────────────────


export async function getOrderDetails (orderId) {
  const order = await Order.findOne({ orderId })

  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }

  const allCancelled = order.items.every(i => i.status === ORDER_STATUS.CANCELLED)

  return {
    order,
    statusText: getStatusText(order.orderStatus),
    formatDate,
    allCancelled
  }
}

// ─────────────────────────────────────────────
// Invoice PDF
// ─────────────────────────────────────────────

export async function generateOrderInvoice (orderId) {
  const order = await Order.findOne({ orderId })

  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }

  const orderObj = order.toObject()

  let subtotal = order.subtotal
  let refundedTotal = 0
  let totalDiscount = order.coupon?.discount || 0

  orderObj.items.forEach(item => {
    // If item is Cancelled or Returned, add its finalTotal to refundedTotal
    if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED].includes(item.status)) {
      refundedTotal += item.finalTotal || item.total
    }
  })

  // Grand Total = (Original Total Amount) - (Refunded Total)
  const finalAmount = Math.max(0, order.totalAmount - refundedTotal)

  const invoiceData = {
    ...orderObj,
    subtotal,
    refundedTotal,
    discount: totalDiscount,
    finalAmount
  }
  const filePath = path.join('views/User/invoice.ejs')
  const html = await ejs.renderFile(filePath, { order: invoiceData, ORDER_STATUS, PAYMENT_STATUS })

  const browser = await getBrowser()

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'domcontentloaded' })

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '15px', right: '15px' }
  })

  await browser.close()

  return { pdf, orderId: order.orderId }
}

// ─────────────────────────────────────────────
// Cancel Item
// ─────────────────────────────────────────────

export async function cancelOrderItem (
  userId,
  { orderId, itemId, reason, comment }
) {
  if (!reason) {
    throw Object.assign(new Error('Please select a reason'), { status: 400 })
  }

  const order = await Order.findOne({ orderId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }

  const item = order.items.id(itemId)
  if (!item) {
    throw Object.assign(new Error('Item not Found'), { status: 404 })
  }

  if (![ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(item.status)) {
    throw Object.assign(new Error(`Cannot cancel item because its current status is ${item.status}`), { status: 400 })
  }

  const { productId, variantId, quantity } = item

  const product = await Product.findById(productId)
  if (!product) {
    throw Object.assign(new Error('Product not found'), { status: 400 })
  }

  const variant = product.variants.find(
    v => v.varientId.toString() === variantId.toString()
  )
  if (!variant) {
    throw Object.assign(new Error('Variant not found'), { status: 400 })
  }

  // Update item status
  item.status = ORDER_STATUS.CANCELLED
  item.cancellation = { reason, comment, cancelledAt: new Date() }

  // Restore stock
  variant.stock += quantity

  // Calculate refund and handle coupon validation
  const allCancelled = order.items.every(i => i.status === ORDER_STATUS.CANCELLED)
  const oldTotal = order.totalAmount
  let refundAmount = 0

  if (allCancelled) {
    order.orderStatus = ORDER_STATUS.CANCELLED
    order.cancellation = { reason, comment, cancelledAt: new Date() }
    order.timeline.cancelledAt = new Date()
    refundAmount = oldTotal
  } else {
    // Check if remaining subtotal still satisfies coupon minOrderValue
    if (order.coupon && order.coupon.couponId) {
      const remainingItems = order.items.filter(i => ![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED, ORDER_STATUS.RETURN_APPROVED].includes(i.status))
      const remainingSubtotal = remainingItems.reduce((sum, i) => sum + (i.total || 0), 0)

      const couponDoc = await Coupon.findById(order.coupon.couponId)
      if (couponDoc && remainingSubtotal < couponDoc.minOrderValue) {
        throw Object.assign(
          new Error(`Cancelling this item would make your order total fall below the coupon's minimum requirement of ₹${couponDoc.minOrderValue}. Please cancel the entire order instead.`),
          { status: 400 }
        )
      }
    }

    // order.totalAmount = oldTotal - (item.finalTotal || item.total)
    refundAmount = item.finalTotal
  }

  // Wallet refund
  if (REFUNDABLE_METHODS.includes(order.paymentMethod)) {
    const wallet = await Wallet.findOne({ userId })
    if (!wallet) throw new Error('Wallet not found')

    item.refunds = REFUND_STATUS.REFUNDED
    wallet.balance += refundAmount
    wallet.transaction.push({
      type: 'credit',
      amount: refundAmount,
      description: allCancelled ? 'Order cancellation amount refunded' : 'Item cancellation amount refunded'
    })

    if (allCancelled) {
      order.paymentStatus = PAYMENT_STATUS.REFUNDED
    }
    await wallet.save()
  }

  await order.save()
  await product.save()

  return { productName: product.name }
}

// ─────────────────────────────────────────────
// Cancel Order (whole order)
// ─────────────────────────────────────────────


export async function getOrderForCancelPage (orderId, userId) {
  const order = await Order.findOne({ orderId, userId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }
  return { order, item: null }
}


export async function getItemForCancelPage (orderId, itemId) {
  const order = await Order.findOne({ orderId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }
  const item = order.items.find(i => i._id.toString() === itemId)
  return { order, item }
}

export async function cancelWholeOrder (userId, { orderId, reason, comment }) {
  if (!reason) {
    throw Object.assign(new Error('Please select an reason'), { status: 400 })
  }

  const order = await Order.findOne({ orderId, userId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 400 })
  }

  const cancellableItems = order.items.filter(i => [ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(i.status))
  if (cancellableItems.length === 0) {
    throw Object.assign(new Error('No cancellable items found in this order'), { status: 400 })
  }

  let totalRefundAmount = 0

  for (const item of order.items) {
    if (![ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(item.status)) continue

    if (REFUNDABLE_METHODS.includes(order.paymentMethod)) {
      totalRefundAmount += (item.finalTotal || item.total)
    }

    item.status = ORDER_STATUS.CANCELLED
    item.cancellation = {
      reason,
      comment: comment?.trim() || '',
      cancelledAt: new Date()
    }

    await Product.updateOne(
      { _id: item.productId, 'variants.varientId': item.variantId },
      { $inc: { 'variants.$.stock': item.quantity } }
    )
  }

  // Sync order status
  const itemStatuses = order.items.map(i => i.status)
  const allCancelled = itemStatuses.every(s => s === ORDER_STATUS.CANCELLED)

  if (allCancelled) {
    order.orderStatus = ORDER_STATUS.CANCELLED
    order.timeline.cancelledAt = new Date()
  } else {
    // If not all cancelled, but some were delivered/shipped, orderStatus remains SHIPPED/DELIVERED
    const activeItems = itemStatuses.filter(s => 
      ![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED, ORDER_STATUS.RETURN_APPROVED, ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.RETURN_REJECTED].includes(s)
    )

    if (activeItems.length === 0) {
      if (itemStatuses.some(s => s === ORDER_STATUS.RETURNED || s === ORDER_STATUS.RETURN_APPROVED)) {
        order.orderStatus = ORDER_STATUS.PARTIALLY_RETURNED
      }
    } else if (activeItems.every(s => s === ORDER_STATUS.DELIVERED)) {
      order.orderStatus = ORDER_STATUS.DELIVERED
      order.timeline.deliveredAt = order.timeline.deliveredAt || new Date()
      order.timeline.shippedAt = order.timeline.shippedAt || new Date()
      order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()
    } else if (activeItems.some(s => s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.SHIPPED)) {
      order.orderStatus = ORDER_STATUS.SHIPPED
      order.timeline.shippedAt = order.timeline.shippedAt || new Date()
      order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()
    } else if (activeItems.some(s => s === ORDER_STATUS.CONFIRMED)) {
      order.orderStatus = ORDER_STATUS.CONFIRMED
      order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()
    }
  }

  if (totalRefundAmount > 0 && REFUNDABLE_METHODS.includes(order.paymentMethod)) {
    const wallet = await Wallet.findOne({ userId: order.userId })
    wallet.balance += totalRefundAmount
    wallet.transaction.push({
      type: 'credit',
      amount: totalRefundAmount,
      description: 'Order cancellation amount refunded'
    })
    
    if (allCancelled) {
      order.paymentStatus = PAYMENT_STATUS.REFUNDED
    }
    await wallet.save()
  }

  await order.save()

  return { orderId }
}

// ─────────────────────────────────────────────
// Return Item
// ─────────────────────────────────────────────

export async function getItemForReturnPage (orderId, itemId) {
  const order = await Order.findOne({ orderId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }
  const item = order.items.find(i => i._id.toString() === itemId)
  return { order, item }
}


export async function getOrderForReturnPage (orderId) {
  const order = await Order.findOne({ orderId })
  const total = order.items.reduce((acc,curr)=>{
    if(curr.status === ORDER_STATUS.DELIVERED){
      acc += curr.finalTotal
    }
    return acc
  },0)
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }
  return { order, item: null ,total}
}


export async function requestItemReturn (
  userId,
  { orderId, itemId, reason, comment }
) {
  if (!reason) {
    throw Object.assign(new Error('Please select a reason'), { status: 400 })
  }

  const order = await Order.findOne({ orderId, userId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 400 })
  }

  const item = order.items.id(itemId)
  if (!item) {
    throw Object.assign(new Error('Item not found'), { status: 400 })
  }

  if (item.status !== ORDER_STATUS.DELIVERED) {
    throw Object.assign(new Error('Only delivered items can be returned'), {
      status: 400
    })
  }

  if (item.status === ORDER_STATUS.RETURNED) {
    throw Object.assign(new Error('Item already returned'), { status: 400 })
  }

  item.status = ORDER_STATUS.RETURN_REQUESTED
  item.returnRequest = {
    status: RETURN_STATUS.PENDING,
    reason,
    comment: comment?.trim() || '',
    returnedAt: new Date()
  }

  const allReturned = order.items.every(i => i.status === ORDER_STATUS.RETURN_REQUESTED)
  if (allReturned) {
    order.orderStatus = ORDER_STATUS.RETURN_REQUESTED
    order.returnRequest = {
      status: RETURN_STATUS.PENDING,
      reason,
      comment: comment?.trim() || ''
    }
    order.timeline.returnedAt = new Date()
  }

  await order.save()
}


export async function requestWholeOrderReturn (
  userId,
  { orderId, reason, comment }
) {
  if (!reason) {
    throw Object.assign(new Error('Please select a reason'), { status: 400 })
  }

  const order = await Order.findOne({ orderId, userId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 400 })
  }

  if (![ORDER_STATUS.PARTIALLY_RETURNED, ORDER_STATUS.DELIVERED].includes(order.orderStatus)) {
    throw Object.assign(new Error('Only delivered orders can be returned'), {
      status: 400
    })
  }

  if (order.orderStatus === ORDER_STATUS.RETURNED) {
    throw Object.assign(new Error('Order already returned'), { status: 400 })
  }

  const now = new Date()

  const returnableItems = order.items.filter(item => ![ORDER_STATUS.RETURNED, ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURN_REJECTED, ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.RETURN_APPROVED].includes(item.status))
  
  if (returnableItems.length === 0) {
    throw Object.assign(new Error('No returnable items found in this order'), { status: 400 })
  }

  for (const item of returnableItems) {
    item.status = ORDER_STATUS.RETURN_REQUESTED
    item.returnRequest = {
      status: RETURN_STATUS.PENDING,
      reason,
      comment: comment?.trim() || '',
      returnedAt: now
    }
  }

  const allHandled = order.items.every(item => [ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.RETURNED, ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURN_APPROVED].includes(item.status))
  
  if (allHandled) {
    order.orderStatus = ORDER_STATUS.RETURN_REQUESTED
    order.returnRequest = {
      status: RETURN_STATUS.PENDING,
      reason,
      comment: comment?.trim() || '',
      requestedAt: now
    }
  }

  await order.save()

  return { orderId }
}

// ─────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────

export async function getReviewPageData (itemId) {
  const order = await Order.findOne({ 'items._id': itemId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }

  const item = order.items.find(i => i._id.toString() === itemId)

  return {
    item,
    delivered: order.timeline.deliveredAt,
    placed: order.createdAt,
    formatDate,
    itemId
  }
}


export async function submitReview (
  userId,
  itemId,
  { ratingValue, tittle, reviewDesc }
) {
  const order = await Order.findOne({ userId, 'items._id': itemId })
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 400 })
  }

  const item = order.items.find(i => i._id.toString() === itemId)

  if (item.status !== ORDER_STATUS.DELIVERED) {
    throw Object.assign(new Error('Item is not delivered'), { status: 400 })
  }

  const existing = await Review.findOne({ userId, productId: item.productId })
  if (existing) {
    throw Object.assign(new Error('You already submitted a review'), {
      status: 400
    })
  }

  await Review.create({
    userId,
    productId: item.productId,
    rating: Number(ratingValue),
    tittle,
    description: reviewDesc
  })
}
