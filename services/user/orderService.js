import { Order } from '../../models/orderModel.js'
import Product from '../../models/productModel.js'
import { Wallet } from '../../models/walletModel.js'
import { Review } from '../../models/reviewModel.js'
import { Coupon } from '../../models/couponModel.js'
import { formatDate } from '../../services/dateFormat.js'
import puppeteer from 'puppeteer'
import ejs from 'ejs'
import path from 'path'

// ─────────────────────────────────────────────
// Shared helper
// ─────────────────────────────────────────────

export const getStatusText = status => {
  switch (status) {
    case 'Placed':
      return 'Order Placed'
    case 'Confirmed':
      return 'Confirmed'
    case 'Shipped':
      return 'Shipped - In Transit'
    case 'Delivered':
      return 'Delivered'
    case 'Cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

const REFUNDABLE_METHODS = ['RAZORPAY', 'WALLET']

// ─────────────────────────────────────────────
// Order Dashboard
// ─────────────────────────────────────────────


export async function getOrderDashboardData (userId) {
  const [orders, totalOrders, delivered, shipped, cancelled] =
    await Promise.all([
      Order.find({ userId }).sort({ createdAt: -1 }).limit(4),
      Order.countDocuments({ userId }),
      Order.countDocuments({ userId, orderStatus: 'Delivered' }),
      Order.countDocuments({ userId, orderStatus: 'Shipped' }),
      Order.countDocuments({ userId, orderStatus: 'Cancelled' })
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

  const allCancelled = order.items.every(i => i.status === 'Cancelled')

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
    if (['Cancelled', 'Returned', 'Return Approved'].includes(item.status)) {
      refundedTotal += item.finalTotal || item.total
    }
  })

  // Grand Total = (Original Total Amount) - (Refunded Total)
  const finalAmount = order.totalAmount - refundedTotal

  const invoiceData = {
    ...orderObj,
    subtotal,
    refundedTotal,
    discount: totalDiscount,
    finalAmount
  }
  const filePath = path.join('views/User/invoice.ejs')
  const html = await ejs.renderFile(filePath, { order: invoiceData })

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })

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

  if (item.status === 'Cancelled') {
    throw Object.assign(new Error('Already Cancelled'), { status: 400 })
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
  item.status = 'Cancelled'
  item.cancellation = { reason, comment, cancelledAt: new Date() }

  // Restore stock
  variant.stock += quantity

  // Calculate refund and handle coupon validation
  const allCancelled = order.items.every(i => i.status === 'Cancelled')
  const oldTotal = order.totalAmount
  let refundAmount = 0

  if (allCancelled) {
    order.orderStatus = 'Cancelled'
    order.cancellation = { reason, comment, cancelledAt: new Date() }
    order.timeline.cancelledAt = new Date()
    refundAmount = oldTotal
    order.totalAmount = 0
  } else {
    // Check if remaining subtotal still satisfies coupon minOrderValue
    if (order.coupon && order.coupon.couponId) {
      const remainingItems = order.items.filter(i => !['Cancelled', 'Returned', 'Return Approved'].includes(i.status))
      const remainingSubtotal = remainingItems.reduce((sum, i) => sum + (i.total || 0), 0)

      const couponDoc = await Coupon.findById(order.coupon.couponId)
      if (couponDoc && remainingSubtotal < couponDoc.minOrderValue) {
        throw Object.assign(
          new Error(`Cancelling this item would make your order total fall below the coupon's minimum requirement of ₹${couponDoc.minOrderValue}. Please cancel the entire order instead.`),
          { status: 400 }
        )
      }
    }

    order.totalAmount = oldTotal - (item.finalTotal || item.total)
    refundAmount = oldTotal - order.totalAmount
  }

  // Wallet refund
  if (REFUNDABLE_METHODS.includes(order.paymentMethod)) {
    const wallet = await Wallet.findOne({ userId })
    if (!wallet) throw new Error('Wallet not found')

    item.refunds = 'refunded'
    wallet.balance += refundAmount
    wallet.transaction.push({
      type: 'credit',
      amount: refundAmount,
      description: allCancelled ? 'Order cancellation amount refunded' : 'Item cancellation amount refunded'
    })

    if (allCancelled) {
      order.paymentStatus = 'Refunded'
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

  if (['Shipped', 'Delivered'].includes(order.orderStatus)) {
    throw Object.assign(new Error('Your order already Shipped'), {
      status: 400
    })
  }

  const allCancelled = order.items.every(i => i.status === 'Cancelled')
  if (allCancelled) {
    throw Object.assign(new Error('You already Cancelled'), { status: 200 })
  }

  let totalAmount = 0

  for (const item of order.items) {
    if (item.status === 'Cancelled') continue
    if (REFUNDABLE_METHODS.includes(order.paymentMethod)) {
      totalAmount += item.finalTotal
    }
    item.status = 'Cancelled'
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

  order.orderStatus = 'Cancelled'
  order.timeline.cancelledAt = new Date()

  if (REFUNDABLE_METHODS.includes(order.paymentMethod)) {
    for (const item of order.items) {
      item.refunds = 'refunded'
    }
    const wallet = await Wallet.findOne({ userId: order.userId })
    wallet.balance += totalAmount
    wallet.transaction.push({
      type: 'credit',
      amount: totalAmount,
      description: 'Order cancellation amount refunded'
    })
    order.paymentStatus = 'Refunded'
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
  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }
  return { order, item: null }
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

  if (item.status !== 'Delivered') {
    throw Object.assign(new Error('Only delivered items can be returned'), {
      status: 400
    })
  }

  if (item.status === 'Returned') {
    throw Object.assign(new Error('Item already returned'), { status: 400 })
  }

  item.status = 'Return Requested'
  item.returnRequest = {
    status: 'Pending',
    reason,
    comment: comment?.trim() || '',
    returnedAt: new Date()
  }

  const allReturned = order.items.every(i => i.status === 'Return Requested')
  if (allReturned) {
    order.orderStatus = 'Return Requested'
    order.returnRequest = {
      status: 'Pending',
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

  if (order.orderStatus !== 'Delivered') {
    throw Object.assign(new Error('Only delivered orders can be returned'), {
      status: 400
    })
  }

  if (order.orderStatus === 'Returned') {
    throw Object.assign(new Error('Order already returned'), { status: 400 })
  }

  const now = new Date()

  for (const item of order.items) {
    if (item.status === 'Returned' || item.status === 'Cancelled') continue
    item.status = 'Return Requested'
    item.returnRequest = {
      status: 'Pending',
      reason,
      comment: comment?.trim() || '',
      returnedAt: now
    }
  }

  const allReturned = order.items.every(item => item.status === 'Returned')
  if (allReturned) {
    order.orderStatus = 'Return Requested'
    order.returnRequest = {
      status: 'Pending',
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

  if (item.status !== 'Delivered') {
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
