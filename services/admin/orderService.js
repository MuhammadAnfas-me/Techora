import { Order } from '../../models/orderModel.js'
import { Wallet } from '../../models/walletModel.js'
import { Coupon } from '../../models/couponModel.js'
import PDFDocument from 'pdfkit'
import Product from '../../models/productModel.js'
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_STATUS,
  RETURN_STATUS
} from '../../constants/orderConstants.js'

// ─────────────────────────────────────────────
// AppError — guaranteed to carry status + message
// across every async throw / catch boundary
// ─────────────────────────────────────────────

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
// Shared helpers
// ─────────────────────────────────────────────

/** Base aggregation pipeline: joins users and unwinds. */
function buildBasePipeline (search, status) {
  const pipeline = [
    {
      $lookup: {
        from:         'users',
        localField:   'userId',
        foreignField: '_id',
        as:           'user'
      }
    },
    { $unwind: '$user' }
  ]

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { 'user.fullName': { $regex: search, $options: 'i' } },
          { orderId:         { $regex: search, $options: 'i' } }
        ]
      }
    })
  }

  if (status) {
    pipeline.push({ $match: { orderStatus: status } })
  }

  return pipeline
}

/**
 * Walks a list of orders and collects pending return requests
 * (order-level takes priority over item-level).
 *
 * Returns { returnRequests, returnRequestsCount }
 */
function collectReturnRequests (orders) {
  const returnRequests     = []
  let returnRequestsCount  = 0

  orders.forEach(order => {
    const isOrderReturn = order.returnRequest?.status === RETURN_STATUS.PENDING

    if (isOrderReturn) {
      returnRequests.push({
        type:       'order',
        orderId:    order.orderId,
        userName:   order.userId?.fullName,
        reason:     order.returnRequest.reason,
        comment:    order.returnRequest.comment || '',
        amount:     order.totalAmount,
        totalItems: order.items?.length || 0,
        id:         order._id
      })
      returnRequestsCount++
      return
    }

    if (order.items?.length) {
      order.items.forEach(item => {
        if (item.returnRequest?.status === RETURN_STATUS.PENDING) {
          returnRequests.push({
            type:        'item',
            orderId:     order.orderId,
            userName:    order.userId?.fullName,
            productName: item.name,
            quantity:    item.quantity,
            reason:      item.returnRequest.reason,
            comment:     item.returnRequest.comment || '',
            amount:      item.finalTotal,
            id:          item._id
          })
          returnRequestsCount++
        }
      })
    }
  })

  return { returnRequests, returnRequestsCount }
}

// ─────────────────────────────────────────────
// Order List
// ─────────────────────────────────────────────

/**
 * Returns paginated, filtered orders plus pending return request data.
 *
 * Returns {
 *   orders, currentPage, totalPages, totalOrders, limit,
 *   status, dateSort, search, returnRequests, returnRequestsCount
 * }
 */
export async function fetchAdminOrderList ({ page, search, status, dateSort }) {
  const limit = 10
  const skip  = (page - 1) * limit

  const basePipeline = buildBasePipeline(search, status)

  // Run count and paginated data in parallel
  const [countResult, orders] = await Promise.all([
    Order.aggregate([...basePipeline, { $count: 'total' }]),
    Order.aggregate([
      ...basePipeline,
      { $sort: { createdAt: dateSort === 'oldest' ? 1 : -1 } },
      { $skip: skip },
      { $limit: limit }
    ])
  ])

  const totalOrders = countResult[0]?.total || 0
  const totalPages  = Math.ceil(totalOrders / limit)

  const { returnRequests, returnRequestsCount } = collectReturnRequests(orders)

  return {
    orders,
    currentPage: page,
    totalPages,
    totalOrders,
    limit,
    status,
    dateSort,
    search,
    returnRequests,
    returnRequestsCount
  }
}

// ─────────────────────────────────────────────
// Export Orders PDF
// ─────────────────────────────────────────────

/**
 * Builds and streams a PDF of all orders.
 * Accepts the Express `res` object so PDFKit can pipe directly —
 * streaming is an HTTP concern but tightly coupled to pdfkit; kept
 * here for consistency, controller simply calls and awaits.
 */
export async function streamOrdersPDF (res) {
  const orders = await Order.aggregate([
    {
      $lookup: {
        from: 'users', localField: 'userId', foreignField: '_id', as: 'user'
      }
    },
    { $unwind: '$user' },
    { $sort: { createdAt: -1 } }
  ])

  const doc = new PDFDocument({ margin: 30, size: 'A4' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename=orders.pdf')
  doc.pipe(res)

  doc.fontSize(18).text('Orders Report', { align: 'center' }).moveDown()

  let startY = 100
  const col  = { orderId: 40, customer: 120, status: 260, date: 330, amount: 450 }

  // Header row
  doc.fontSize(10).font('Helvetica-Bold')
  doc.text('Order ID',  col.orderId,  startY)
  doc.text('Customer',  col.customer, startY)
  doc.text('Status',    col.status,   startY)
  doc.text('Date',      col.date,     startY)
  doc.font('Helvetica-Bold').text('Amount', col.amount, startY, { width: 90, align: 'right' })
  doc.font('Helvetica')

  doc.moveTo(40, startY + 15).lineTo(550, startY + 15).stroke()

  let y = startY + 25

  orders.forEach(order => {
    if (y > 750) { doc.addPage(); y = 50 }

    doc.fontSize(9)
    doc.text(order.orderId,                                    col.orderId,  y, { width: 70 })
    doc.text(order.user?.fullName || 'N/A',                   col.customer, y, { width: 120 })
    doc.text(order.orderStatus,                                col.status,   y)
    doc.text(new Date(order.createdAt).toISOString().split('T')[0], col.date, y)

    const amount = Number(order.totalAmount).toLocaleString('en-IN')
    doc.font('Helvetica-Bold').fillColor('#000000')
       .text(`₹ ${amount}`, col.amount, y, { width: 100, align: 'right', lineBreak: false })
    doc.font('Helvetica')

    y += 20
  })

  doc.end()
}

// ─────────────────────────────────────────────
// Order Details
// ─────────────────────────────────────────────

/**
 * Fetches a single order with populated user for the admin detail page.
 * Returns { order }
 */
export async function fetchOrderDetails (orderId) {
  const order = await Order.findOne({ orderId }).populate('userId')
  if (!order) throw new AppError('Order not found', 404)
  return { order }
}

// ─────────────────────────────────────────────
// Update Order Status
// ─────────────────────────────────────────────

/**
 * Applies a new status to an order, updates the timeline, and handles:
 *  - COD payment marking on Delivered
 *  - Wallet refund + item refund flags on Returned
 *  - Item-level status sync (skipping Cancelled / Returned items)
 */
export async function changeOrderStatus (orderId, newStatus) {
  if (!orderId)   throw new AppError('Order id not found', 400)
  if (!newStatus) throw new AppError('Nothing to update', 400)

  const order = await Order.findOne({ orderId })
  if (!order) throw new AppError('Order not found', 400)

  if (order.orderStatus === ORDER_STATUS.DELIVERED) {
    throw new AppError('Order is already delivered', 400)
  }

  const statusWeight = {
    [ORDER_STATUS.PLACED]: 1,
    [ORDER_STATUS.CONFIRMED]: 2,
    [ORDER_STATUS.SHIPPED]: 3,
    [ORDER_STATUS.DELIVERED]: 4,
    [ORDER_STATUS.RETURN_REQUESTED]: 5,
    [ORDER_STATUS.RETURN_APPROVED]: 6,
    [ORDER_STATUS.RETURN_REJECTED]: 7,
    [ORDER_STATUS.RETURNED]: 8
  }

  if (statusWeight[order.orderStatus] && statusWeight[newStatus] && statusWeight[newStatus] < statusWeight[order.orderStatus]) {
    throw new AppError(`Cannot move order status backward from ${order.orderStatus} to ${newStatus}`, 400)
  }

  if (newStatus === order.orderStatus) {
    throw new AppError('Change status and update', 400)
  }

  order.orderStatus = newStatus

  if (newStatus === ORDER_STATUS.CONFIRMED) {
    order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()
  }

  if (newStatus === ORDER_STATUS.SHIPPED) {
    order.timeline.shippedAt = order.timeline.shippedAt || new Date()
    order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()
  }

  if (newStatus === ORDER_STATUS.DELIVERED) {
    order.timeline.deliveredAt = order.timeline.deliveredAt || new Date()
    order.timeline.shippedAt = order.timeline.shippedAt || new Date()
    order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()

    if (![PAYMENT_METHOD.RAZORPAY, PAYMENT_METHOD.WALLET].includes(order.paymentMethod)) {
      order.paymentStatus = PAYMENT_STATUS.PAID
    }
  }

  if (newStatus === ORDER_STATUS.RETURNED) {
    order.timeline.returnedAt = new Date()
    order.paymentStatus       = PAYMENT_STATUS.REFUNDED

    // Calculate refund only for items not yet refunded
    let totalToRefund = 0
    order.items.forEach(item => {
      if (![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED].includes(item.status)) {
        totalToRefund += (item.finalTotal || item.total)
        item.status    = ORDER_STATUS.RETURNED
        item.refunds   = REFUND_STATUS.REFUNDED
      }
    })

    if (totalToRefund > 0) {
      const wallet = await Wallet.findOne({ userId: order.userId })
      wallet.balance += totalToRefund
      wallet.transaction.push({
        type:        'credit',
        amount:      totalToRefund,
        description: 'Order marked as returned (remaining amount)'
      })
      await wallet.save()
    }
  }

  // Sync item statuses
  order.items.forEach(item => {
    // Skip already terminal items
    if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED].includes(item.status)) return

    // If whole order is RETURNED, all active/approved items should also be RETURNED
    if (newStatus === ORDER_STATUS.RETURNED) {
      item.status = ORDER_STATUS.RETURNED
      return
    }

    // Otherwise, skip items that are already in return flow (requested/approved/rejected)
    // as we shouldn't move them back to SHIPPED/DELIVERED
    if (![ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.RETURN_APPROVED, ORDER_STATUS.RETURN_REJECTED].includes(item.status)) {
      item.status = newStatus
    }
  })

  await order.save()
}

/**
 * Updates a single item's status and syncs the parent order status.
 */
export async function changeItemStatus(orderId, itemId, newStatus) {
  const order = await Order.findOne({ orderId })
  if (!order) throw new AppError('Order not found', 404)

  const item = order.items.id(itemId)
  if (!item) throw new AppError('Item not found', 404)

  if (item.status === newStatus) return

  // Prevent moving back from terminal states
  const terminalStatuses = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED]
  if (terminalStatuses.includes(item.status) && !terminalStatuses.includes(newStatus)) {
     throw new AppError(`Cannot change status back from ${item.status}`, 400)
  }

  // Basic forward-only flow validation
  const statusWeight = {
    [ORDER_STATUS.PLACED]: 1,
    [ORDER_STATUS.CONFIRMED]: 2,
    [ORDER_STATUS.SHIPPED]: 3,
    [ORDER_STATUS.DELIVERED]: 4,
    [ORDER_STATUS.RETURN_REQUESTED]: 5,
    [ORDER_STATUS.RETURN_APPROVED]: 6,
    [ORDER_STATUS.RETURN_REJECTED]: 7,
    [ORDER_STATUS.RETURNED]: 8
  }

  if (statusWeight[item.status] && statusWeight[newStatus] && statusWeight[newStatus] < statusWeight[item.status]) {
    throw new AppError(`Cannot move status backward from ${item.status} to ${newStatus}`, 400)
  }

  item.status = newStatus

  syncOrderStatus(order)
  await order.save()
}

function syncOrderStatus(order) {
  const itemStatuses = order.items.map(i => i.status)
  
  const allCancelled = itemStatuses.every(s => s === ORDER_STATUS.CANCELLED)
  const allReturned = itemStatuses.every(s => s === ORDER_STATUS.RETURNED)

  if (allCancelled) {
    order.orderStatus = ORDER_STATUS.CANCELLED
    order.timeline.cancelledAt = order.timeline.cancelledAt || new Date()
    return
  }
  
  if (allReturned) {
    order.orderStatus = ORDER_STATUS.RETURNED
    order.timeline.returnedAt = order.timeline.returnedAt || new Date()
    return
  }

  const activeItems = itemStatuses.filter(s => 
    ![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED, ORDER_STATUS.RETURN_APPROVED, ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.RETURN_REJECTED].includes(s)
  )
  
  if (activeItems.length === 0) {
     // If no strictly "active" items, but some are RETURN_APPROVED etc, we handle that
     if (itemStatuses.some(s => s === ORDER_STATUS.RETURNED || s === ORDER_STATUS.RETURN_APPROVED)) {
       order.orderStatus = ORDER_STATUS.PARTIALLY_RETURNED
     }
     return
  }

  if (activeItems.every(s => s === ORDER_STATUS.DELIVERED)) {
    order.orderStatus = ORDER_STATUS.DELIVERED
    order.timeline.deliveredAt = order.timeline.deliveredAt || new Date()
    order.timeline.shippedAt   = order.timeline.shippedAt || new Date()
    order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()

    // COD Handling: If entire order is delivered, mark as Paid
    if (order.paymentMethod === PAYMENT_METHOD.COD && order.paymentStatus !== PAYMENT_STATUS.PAID) {
      order.paymentStatus = PAYMENT_STATUS.PAID
    }
  } else if (activeItems.some(s => s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.SHIPPED)) {
    order.orderStatus = ORDER_STATUS.SHIPPED
    order.timeline.shippedAt   = order.timeline.shippedAt || new Date()
    order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()
  } else if (activeItems.some(s => s === ORDER_STATUS.CONFIRMED)) {
    order.orderStatus = ORDER_STATUS.CONFIRMED
    order.timeline.confirmedAt = order.timeline.confirmedAt || new Date()
  } else {
    order.orderStatus = ORDER_STATUS.PLACED
  }

  // Handle PARTIALLY_RETURNED if some items are already returned or in return flow
  if (itemStatuses.some(s => [ORDER_STATUS.RETURNED, ORDER_STATUS.RETURN_APPROVED, ORDER_STATUS.RETURN_REQUESTED].includes(s)) && 
      order.orderStatus !== ORDER_STATUS.RETURNED) {
    order.orderStatus = ORDER_STATUS.PARTIALLY_RETURNED
  }
}

// ─────────────────────────────────────────────
// Return Item (admin approve single item)
// ─────────────────────────────────────────────

export async function processItemReturn(orderId, itemId) {
  if (!orderId) throw new AppError('Order id not found', 400)

  const order = await Order.findOne({ orderId })
  if (!order) throw new AppError('Order not found', 400)

  const item = order.items.find(i => i._id.toString() === itemId)
  if (!item) throw new AppError('Order item not Found', 400)

  // ✅ Prevent double refund
  if (item.refunds === REFUND_STATUS.REFUNDED || item.status === ORDER_STATUS.RETURNED) {
    throw new AppError('Item already returned/refunded', 400)
  }

  if (item.status !== ORDER_STATUS.RETURN_APPROVED) {
    throw new AppError('Item return must be approved before processing', 400)
  }

  // ✅ Update item status
  item.status = ORDER_STATUS.RETURNED
  item.refunds = REFUND_STATUS.REFUNDED

  // ── Refund Calculation (SAFE) ─────────────
  const getRefundAmount = (item) => {
    // always prefer finalPrice (after coupon split)
    return item.finalTotal ?? item.total
  }

  const allReturned = order.items.every(i => i.status === ORDER_STATUS.RETURNED)

  let refundAmount = 0

  if (allReturned) {
    // FULL ORDER RETURN
    order.orderStatus = ORDER_STATUS.RETURNED
    refundAmount = order.totalAmount
    order.paymentStatus = PAYMENT_STATUS.REFUNDED
  } else {
    // PARTIAL RETURN
    refundAmount = getRefundAmount(item)
    order.orderStatus = ORDER_STATUS.PARTIALLY_RETURNED
  }

  // ── Wallet Handling ──────────────────────
  let wallet = await Wallet.findOne({ userId: order.userId })

  if (!wallet) {
    wallet = await Wallet.create({
      userId: order.userId,
      balance: 0,
      transaction: []
    })
  }

  wallet.balance += refundAmount

  wallet.transaction.push({
    type: 'credit',
    amount: refundAmount,
    description: allReturned
      ? 'Order return amount refunded'
      : `Refund for item: ${item.name}`
  })

  // ── Restore Stock ────────────────────────
  await Product.updateOne(
    { _id: item.productId, 'variants.varientId': item.variantId },
    { $inc: { 'variants.$.stock': item.quantity } }
  )

  await wallet.save()
  await order.save()

  return { itemName: item.name }
}

// ─────────────────────────────────────────────
// Order Cancel (admin)
// ─────────────────────────────────────────────


export async function cancelAdminOrder (orderId) {
  if (!orderId) throw new AppError('Order Id not found', 400)

  const order = await Order.findOne({ orderId })
  if (!order) throw new AppError('Order not found', 400)

  const cancellableItems = order.items.filter(i => [ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(i.status))
  if (cancellableItems.length === 0) {
    throw new AppError('No cancellable items found in this order', 400)
  }

  for (const item of order.items) {
    if ([ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(item.status)) {
      item.status = ORDER_STATUS.CANCELLED
      item.cancellation.cancelledAt = new Date()

      await Product.updateOne(
        { _id: item.productId, 'variants.varientId': item.variantId },
        { $inc: { 'variants.$.stock': item.quantity } }
      )
    }
  }

  syncOrderStatus(order)
  await order.save()
}

// ─────────────────────────────────────────────
// Update Return Status (Approve / Reject)
// ─────────────────────────────────────────────


export async function processReturnStatus(id, type, status) {
  let order

  // ── Fetch Order ───────────────────────────
  if (type === 'order') {
    order = await Order.findById(id)
  } else {
    order = await Order.findOne({ 'items._id': id })
  }

  if (!order) throw new AppError('Order not found', 404)

  // ── ORDER LEVEL ───────────────────────────
  if (type === 'order') {
    if (order.returnRequest.status !== RETURN_STATUS.PENDING) {
      throw new AppError('Return request is already processed', 400)
    }

    order.returnRequest.status = status

    order.items.forEach(item => {
      item.returnRequest.status = status
      item.status =
        status === RETURN_STATUS.APPROVED ? ORDER_STATUS.RETURN_APPROVED : ORDER_STATUS.RETURN_REJECTED

      // mark for refund (don't calculate)
      if (status === RETURN_STATUS.APPROVED) {
        item.refundStatus = REFUND_STATUS.PENDING
      }
    })

    order.orderStatus =
      status === RETURN_STATUS.APPROVED ? ORDER_STATUS.RETURN_APPROVED : ORDER_STATUS.RETURN_REJECTED

    if (status === RETURN_STATUS.APPROVED) {
      order.paymentStatus = PAYMENT_STATUS.REFUND_PENDING
    }

    await order.save()
    return order
  }

  // ── ITEM LEVEL ────────────────────────────
  const item = order.items.id(id)
  if (!item) throw new AppError('Item not found', 404)

  if (item.returnRequest.status !== RETURN_STATUS.PENDING) {
    throw new AppError('Item return request is already processed', 400)
  }

  if (status === RETURN_STATUS.APPROVED) {
    item.returnRequest.status = RETURN_STATUS.APPROVED
    item.status = ORDER_STATUS.RETURN_APPROVED

    // mark only this item
    item.refundStatus = REFUND_STATUS.PENDING

    // Check if all items returned
    const activeItems = order.items.filter(
      i => ![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED, ORDER_STATUS.RETURN_APPROVED].includes(i.status)
    )

    if (activeItems.length === 0) {
      order.orderStatus = ORDER_STATUS.RETURN_APPROVED
      order.paymentStatus = PAYMENT_STATUS.REFUND_PENDING
    } else {
      order.orderStatus = ORDER_STATUS.PARTIALLY_RETURNED
    }

  } else {
    item.returnRequest.status = status
    item.status = ORDER_STATUS.RETURN_REJECTED
  }

  await order.save()
  return order
}