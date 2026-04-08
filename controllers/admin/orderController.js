import { Order } from '../../models/orderModel.js'
import PDFDocument from 'pdfkit'

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

    // 🔍 Search
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

    // 📦 Status
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
    res.render('Admin/order/orderListPage.ejs', {
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      status,
      dateSort,
      search
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

export const orderDetailsPage = async (req,res)=>{
  try {
    const orderId = req.params.orderId
    const order = await Order.findOne({orderId}).populate('userId')
    res.render('Admin/order/orderDetailsPage.ejs',{
      order,
      currentPage : "orders"
    })

  } catch (error) {
    console.log("Error From orderDetailsPage :",error)
  }
}