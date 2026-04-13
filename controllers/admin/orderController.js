import { Order } from '../../models/orderModel.js'
import PDFDocument from 'pdfkit'
import Product from '../../models/productModel.js'

export const orderListLoad = async (req, res) => {
  try {
    const { search, status, dateSort } = req.query

    const page = parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const basePipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' }
    ]

    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { 'user.fullName': { $regex: search, $options: 'i' } },
            { orderId: { $regex: search, $options: 'i' } }
          ]
        }
      })
    }

    if (status) {
      basePipeline.push({
        $match: { orderStatus: status }
      })
    }

    // 📊 Get total count (IMPORTANT)
    const countPipeline = [...basePipeline, { $count: 'total' }]
    const countResult = await Order.aggregate(countPipeline)
    const totalOrders = countResult[0]?.total || 0

    // 📅 Sort + Pagination
    const dataPipeline = [
      ...basePipeline,
      {
        $sort: { createdAt: dateSort === 'oldest' ? 1 : -1 }
      },
      { $skip: skip },
      { $limit: limit }
    ]

    const orders = await Order.aggregate(dataPipeline)

    const totalPages = Math.ceil(totalOrders / limit)

    const returnOrders = await Order.find({}).populate('userId').lean()

    let returnRequests = []
    let returnRequestsCount = 0

    orders.forEach(order => {
      const isOrderReturn = order.returnRequest?.status === 'Pending'

      // 🟢 ORDER LEVEL
      if (isOrderReturn) {
        returnRequests.push({
          type: 'order',
          orderId: order.orderId,
          userName: order.userId?.fullName,
          reason: order.returnRequest.reason,
          amount: order.totalAmount,
          totalItems: order.items?.length || 0,
          id: order._id
        })

        returnRequestsCount++

        return // 🚨 IMPORTANT → skip item loop
      }

      // 🔵 ITEM LEVEL (ONLY if no full order return)
      if (order.items?.length) {
        order.items.forEach(item => {
          if (item.returnRequest?.status === 'Pending') {
            returnRequests.push({
              type: 'item',
              orderId: order.orderId,
              userName: order.userId?.fullName,
              productName: item.name,
              quantity: item.quantity,
              reason: item.returnRequest.reason,
              amount: item.price,
              id: item._id
            })

            returnRequestsCount++
          }
        })
      }
    })

    res.render('Admin/order/orderListPage.ejs', {
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
    })
  } catch (error) {
    console.error('Error from orderListLoad :', error)
  }
}

export const exportOrdersPDF = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $sort: { createdAt: -1 } }
    ])

    const doc = new PDFDocument({ margin: 30, size: 'A4' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=orders.pdf')

    doc.pipe(res)

    // 🏷 Title
    doc.fontSize(18).text('Orders Report', { align: 'center' }).moveDown()

    // 📍 Table position
    let startY = 100

    // 📌 Column positions
    const col = {
      orderId: 40,
      customer: 120,
      status: 260,
      date: 330,
      amount: 450
    }

    // 🔹 Header
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('Order ID', col.orderId, startY)
    doc.text('Customer', col.customer, startY)
    doc.text('Status', col.status, startY)
    doc.text('Date', col.date, startY)
    doc.font('Helvetica-Bold').text('Amount', col.amount, startY, {
      width: 90, // FIXED WIDTH (important)
      align: 'right' // RIGHT ALIGN (very important)
    })
    doc.font('Helvetica') // reset

    // 🔽 Line under header
    doc
      .moveTo(40, startY + 15)
      .lineTo(550, startY + 15)
      .stroke()

    let y = startY + 25

    doc.font('Helvetica')

    // 🔁 Rows
    orders.forEach((order, index) => {
      // 🛑 Page break
      if (y > 750) {
        doc.addPage()
        y = 50
      }
      doc.fontSize(9)
      doc.text(order.orderId, col.orderId, y, { width: 70 })
      doc.text(order.user?.fullName || 'N/A', col.customer, y, { width: 120 })
      doc.text(order.orderStatus, col.status, y)
      doc.text(
        new Date(order.createdAt).toISOString().split('T')[0],
        col.date,
        y
      )

      const amount = Number(order.totalAmount).toLocaleString('en-IN')

      doc
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(`₹ ${amount}`, col.amount, y, {
          width: 100, // 🔥 increase width
          align: 'right', // right align
          lineBreak: false // 🔥 prevents clipping
        })
      doc.font('Helvetica')
      y += 20
    })

    doc.end()
  } catch (error) {
    console.error('PDF Export Error:', error)
  }
}

export const orderDetailsPage = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const order = await Order.findOne({ orderId }).populate('userId')
    res.render('Admin/order/orderDetailsPage.ejs', {
      order,
      currentPage: 'orders'
    })
  } catch (error) {
    console.log('Error From orderDetailsPage :', error)
  }
}

export const updateOrderStatus = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Please login first'
      })
    }
    const orderId = req.params.orderId
    const status = req.body.orderStatus

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Nothing to update'
      })
    }
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order id not found'
      })
    }

    const order = await Order.findOne({ orderId })
    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      })
    }

    if (order.orderStatus === 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Order is already delivered'
      })
    }

    order.orderStatus = status
    if (status === 'Confirmed') {
      order.timeline.confirmedAt = new Date()
    }
    if (status === 'Shipped') {
      order.timeline.shippedAt = new Date()
    }
    if (status === 'Delivered') {
      order.timeline.deliveredAt = new Date()
      order.paymentStatus = 'Paid'
    }

    order.items.forEach(item => {
      if (!['Cancelled', 'Returned'].includes(item.status)) item.status = status
    })

    await order.save()
    return res.status(200).json({
      success: true,
      message: 'Status updated successfully'
    })
  } catch (error) {
    console.log('Error from updateOrderStatus :', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const returnItem = async (req, res) => {
  const admin = req.session.admin
  const orderId = req.params.orderId
  const itemId = req.body.itemId
  console.log("Call reached")
  try {
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Please login first'
      })
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order id not found'
      })
    }
  
    const order = await Order.findOne({ orderId })
    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      })
    }

    const item = order.items.find(i => i._id.toString() === itemId)
    const allReturned = order.items.every(item => item.status === "Returned")
    if(allReturned){
      order.orderStatus = "Returned"
    }
    
    if(!item){
      return res.status(400).json({
        success : false,
        message : "Order item not Found"
      })
    }

    item.status = "Returned"
    await order.save()
    return res.status(200).json({
      success : true,
      message : `${item.name} returned successfully`
    })
  } catch (error) {
    console.error("Error From ReturnItem :",error)
    return res.status(500).json({
      success : false,
      message : "Server error"
    })
  }

}

export const orderCancel = async (req, res) => {
  try {
    const orderId = req.params.orderId
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order Id not found'
      })
    }

    const order = await Order.findOne({ orderId })

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      })
    }

    if (['Shipped', 'Delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `This Order already ${order.orderStatus}`
      })
    }

    let allCancelled = order.items.every(i => i.status === 'Cancelled')

    if (allCancelled) {
      return res.json({
        success: false,
        message: 'Order already Cancelled'
      })
    }

    order.orderStatus = 'Cancelled'

    // order.items.forEach(item => {
    //   if (!['Returned', 'Cancelled', 'Delivered'].includes(item.status)) {
    //     item.status = 'Cancelled'
    //     await Product.updateOne(
    //             {
    //               _id: item.productId,
    //               'variants.varientId': item.variantId
    //             },
    //             {
    //               $inc: { 'variants.$.stock': item.quantity }
    //             }
    //           )
    //   }
    // })
    for (const item of order.items) {
      // ✅ Update item status
      if (!['Returned', 'Cancelled', 'Delivered'].includes(item.status)) {
        item.status = 'Cancelled'
        item.cancellation.cancelledAt = new Date()
        // ✅ Restore stock to correct variant
        await Product.updateOne(
          {
            _id: item.productId,
            'variants.varientId': item.variantId
          },
          {
            $inc: { 'variants.$.stock': item.quantity }
          }
        )
      }
    }

    allCancelled = order.items.every(i => i.status === 'Cancelled')
    if (allCancelled) {
      order.timeline.cancelledAt = new Date()
    }

    await order.save()
    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    })
  } catch (error) {
    console.log('Error from order cancel in admin :', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const updateReturnStatus = async (req, res) => {
  const { id, type, status } = req.body
  try {
    if (type === 'order') {
      const order = await Order.findById(id)

      if (order.returnRequest.status !== 'Approved' && status === 'Approved') {
        for (let item of order.items) {
          await Product.updateOne(
            {
              _id: item.productId,
              'variants.varientId': item.variantId
            },
            {
              $inc: { 'variants.$.stock': item.quantity }
            }
          )
        }
      }

      order.returnRequest.status = status
      order.items.forEach(item => {
        item.returnRequest.status = status
        if (status === 'Approved') {
          item.status = 'Return Approved'
        } else {
          item.status = 'Return Rejected'
        }
      })
      if (status === 'Approved') {
        order.orderStatus = 'Return Approved'
      } else {
        order.orderStatus = 'Return Rejected'
      }
      await order.save()
    } else {
      const order = await Order.findOne({
        'items._id': id
      })

      const item = order.items.id(id)

      if (item.returnRequest.status !== 'Approved' && status === 'Approved') {
        await Product.updateOne(
          {
            _id: item.productId,
            'variants.varientId': item.variantId
          },
          {
            $inc: { 'variants.$.stock': item.quantity }
          }
        )
      }
      item.returnRequest.status = status
      if (status === 'Approved') {
        item.status = 'Return Approved'
      } else {
        item.status = 'Return Rejected'
      }
      let allReturned = order.items.every(item => {
        item.status === 'Return Requested'
      })
      if (allReturned) {
        order.orderStatus = 'Return Requested'
      }
      await order.save()
    }
    res.status(200).json({
      success: true,
      redirect: '/admin/orders'
    })
  } catch (error) {
    console.log(error)
    return res.status(400).json({
      success: false,
      message: 'Server error'
    })
  }
}
