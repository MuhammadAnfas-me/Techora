import { Order } from '../../models/orderModel.js'
import { Wallet } from '../../models/walletModel.js'
import { Coupon } from '../../models/couponModel.js'
import PDFDocument from 'pdfkit'
import Product from '../../models/productModel.js'

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
    const isOrderReturn = order.returnRequest?.status === 'Pending'

    if (isOrderReturn) {
      returnRequests.push({
        type:       'order',
        orderId:    order.orderId,
        userName:   order.userId?.fullName,
        reason:     order.returnRequest.reason,
        amount:     order.totalAmount,
        totalItems: order.items?.length || 0,
        id:         order._id
      })
      returnRequestsCount++
      return
    }

    if (order.items?.length) {
      order.items.forEach(item => {
        if (item.returnRequest?.status === 'Pending') {
          returnRequests.push({
            type:        'item',
            orderId:     order.orderId,
            userName:    order.userId?.fullName,
            productName: item.name,
            quantity:    item.quantity,
            reason:      item.returnRequest.reason,
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

  if (order.orderStatus === 'Delivered') {
    throw new AppError('Order is already delivered', 400)
  }

  if (newStatus === order.orderStatus) {
    throw new AppError('Change status and update', 400)
  }

  order.orderStatus = newStatus

  if (newStatus === 'Confirmed') order.timeline.confirmedAt = new Date()
  if (newStatus === 'Shipped')   order.timeline.shippedAt   = new Date()

  if (newStatus === 'Delivered') {
    order.timeline.deliveredAt = new Date()
    if (!['RAZORPAY', 'WALLET'].includes(order.paymentMethod)) {
      order.paymentStatus = 'Paid'
    }
  }

  if (newStatus === 'Returned') {
    order.timeline.returnedAt = new Date()
    order.paymentStatus       = 'Refunded'

    order.items.forEach(item => { item.refunds = 'refunded' })

    const wallet = await Wallet.findOne({ userId: order.userId })
    wallet.balance += order.totalAmount
    wallet.transaction.push({
      type:        'credit',
      amount:      order.totalAmount,
      description: 'Order return amount refunded'
    })
    await wallet.save()
  }

  // Sync item statuses — skip already-terminal items
  order.items.forEach(item => {
    if (!['Cancelled', 'Returned'].includes(item.status)) {
      item.status = newStatus
    }
  })

  await order.save()
}

// ─────────────────────────────────────────────
// Return Item (admin approve single item)
// ─────────────────────────────────────────────

/**
 * Marks a single order item as Returned, refunds the wallet,
 * and upgrades the whole order to Returned when all items are done.
 *
 * Returns { itemName }
 */
export async function processItemReturn (orderId, itemId) {
  if (!orderId) throw new AppError('Order id not found', 400)

  const order = await Order.findOne({ orderId })
  if (!order) throw new AppError('Order not found', 400)

  const item = order.items.find(i => i._id.toString() === itemId)
  if (!item) throw new AppError('Order item not Found', 400)

  item.status  = 'Returned'
  item.refunds = 'refunded'

  // Calculate refund and handle coupon validation
  const allReturned = order.items.every(i => i.status === 'Returned')
  const oldTotal = order.totalAmount
  let refundAmount = 0

  if (allReturned) {
    order.orderStatus = 'Returned'
    refundAmount = oldTotal
    order.totalAmount = 0
  } else {
    if (order.coupon && order.coupon.couponId) {
      const remainingItems = order.items.filter(i => !['Cancelled', 'Returned', 'Return Approved'].includes(i.status))
      const remainingSubtotal = remainingItems.reduce((sum, i) => sum + (i.total || 0), 0)

      const couponDoc = await Coupon.findById(order.coupon.couponId)
      if (couponDoc && remainingSubtotal < couponDoc.minOrderValue) {
        throw new AppError(`Returning this item would make the order total fall below the coupon's minimum requirement of ₹${couponDoc.minOrderValue}. Please process a full order return instead.`, 400)
      }
    }

    order.totalAmount = oldTotal - (item.finalTotal || item.total)
    refundAmount = oldTotal - order.totalAmount
  }

  const wallet = await Wallet.findOne({ userId: order.userId })
  wallet.balance += refundAmount
  wallet.transaction.push({
    type: 'credit',
    amount: refundAmount,
    description: allReturned ? 'Order return amount refunded' : 'Item return amount refunded'
  })

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

  if (['Shipped', 'Delivered'].includes(order.orderStatus)) {
    throw new AppError(`This Order already ${order.orderStatus}`, 400)
  }

  const allCancelled = order.items.every(i => i.status === 'Cancelled')
  if (allCancelled) throw new AppError('Order already Cancelled', 400)

  order.orderStatus = 'Cancelled'

  for (const item of order.items) {
    if (!['Returned', 'Cancelled', 'Delivered'].includes(item.status)) {
      item.status                  = 'Cancelled'
      item.cancellation.cancelledAt = new Date()

      await Product.updateOne(
        { _id: item.productId, 'variants.varientId': item.variantId },
        { $inc: { 'variants.$.stock': item.quantity } }
      )
    }
  }

  const nowAllCancelled = order.items.every(i => i.status === 'Cancelled')
  if (nowAllCancelled) order.timeline.cancelledAt = new Date()

  await order.save()
}

// ─────────────────────────────────────────────
// Update Return Status (Approve / Reject)
// ─────────────────────────────────────────────


export async function processReturnStatus (id, type, status) {
  if (type === 'order') {
    const order = await Order.findById(id)
    if (!order) throw new AppError('Order not found', 404)

    // Handle Approved status (Refund + Stock)
    if (status === 'Approved' && order.returnRequest.status !== 'Approved') {
      const oldTotal = order.totalAmount
      let refundAmount = 0
      
      // All items in order are being returned
      order.items.forEach(item => {
        if (!['Cancelled', 'Returned', 'Return Approved'].includes(item.status)) {
           // Restore stock
           Product.updateOne(
             { _id: item.productId, 'variants.varientId': item.variantId },
             { $inc: { 'variants.$.stock': item.quantity } }
           ).exec();
        }
        item.status = 'Return Approved'
        item.returnRequest.status = 'Approved'
      })
      
      order.orderStatus = 'Return Approved'
      order.returnRequest.status = 'Approved'
      
      // Refund entire remaining total
      refundAmount = oldTotal
      order.totalAmount = 0
      order.paymentStatus = 'Refunded'

      // Wallet refund
      const wallet = await Wallet.findOne({ userId: order.userId })
      if (wallet) {
        wallet.balance += refundAmount
        wallet.transaction.push({
          type: 'credit',
          amount: refundAmount,
          description: 'Order return approved - Refunded'
        })
        await wallet.save()
      }
    } else {
      order.returnRequest.status = status
      order.items.forEach(item => {
        item.returnRequest.status = status
        item.status = status === 'Approved' ? 'Return Approved' : 'Return Rejected'
      })
      order.orderStatus = status === 'Approved' ? 'Return Approved' : 'Return Rejected'
    }

    await order.save()
  } else {
    const order = await Order.findOne({ 'items._id': id })
    if (!order) throw new AppError('Order not found', 404)

    const item = order.items.id(id)
    if (!item) throw new AppError('Item not found', 404)

    // Handle Approved status
    if (status === 'Approved' && item.returnRequest.status !== 'Approved') {
       const oldTotal = order.totalAmount
       let refundAmount = 0

       // Restore stock
       await Product.updateOne(
         { _id: item.productId, 'variants.varientId': item.variantId },
         { $inc: { 'variants.$.stock': item.quantity } }
       )

       item.status = 'Return Approved'
       item.returnRequest.status = 'Approved'

       // Check if all items are now non-active
       const activeItems = order.items.filter(i => !['Cancelled', 'Returned', 'Return Approved'].includes(i.status))
       
       if (activeItems.length === 0) {
         order.orderStatus = 'Return Approved'
         refundAmount = oldTotal
         order.totalAmount = 0
         order.paymentStatus = 'Refunded'
       } else {
         // Check if remaining subtotal still satisfies coupon minOrderValue
         if (order.coupon && order.coupon.couponId) {
           const remainingSubtotal = activeItems.reduce((sum, i) => sum + (i.total || 0), 0)
           const couponDoc = await Coupon.findById(order.coupon.couponId)
           if (couponDoc && remainingSubtotal < couponDoc.minOrderValue) {
             throw new AppError(`Returning this item would make the order total fall below the coupon's minimum requirement of ₹${couponDoc.minOrderValue}. Please approve a full order return instead.`, 400)
           }
         }

         order.totalAmount = oldTotal - (item.finalTotal || item.total)
         refundAmount = oldTotal - order.totalAmount
       }

       // Wallet refund
       const wallet = await Wallet.findOne({ userId: order.userId })
       if (wallet) {
         wallet.balance += refundAmount
         wallet.transaction.push({
           type: 'credit',
           amount: refundAmount,
           description: 'Item return approved - Refunded'
         })
         await wallet.save()
       }
    } else {
      item.returnRequest.status = status
      item.status = status === 'Approved' ? 'Return Approved' : 'Return Rejected'
    }

    await order.save()
  }
}