import { Order } from '../../models/orderModel.js'
import { formatDate } from '../../services/dateFormat.js'
import puppeteer from 'puppeteer'
import ejs from 'ejs'
import path from 'path'
import { fileURLToPath } from 'url'
import Product from '../../models/productModel.js'
import { resendOtp } from './authController.js'

const getStatusText = status => {
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

export const OrderLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      res.redirect('/')
    }
    const orders = await Order.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(4)
    const totalOrders = await Order.countDocuments({ userId: user.id })
    const delivered = await Order.countDocuments({
      userId: user.id,
      orderStatus: 'Delivered'
    })
    const shipped = await Order.countDocuments({
      userId: user.id,
      orderStatus: 'Shipped'
    })
    const cancelled = await Order.countDocuments({
      userId: user.id,
      orderStatus: 'Cancelled'
    })
    res.render('User/order/orderPage.ejs', {
      orders,
      totalOrders,
      delivered,
      shipped,
      cancelled
    })
  } catch (error) {
    console.log(error)
  }
}

export const orderListPage = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      res.redirect('/')
    }
    const search = req.query.search || ''
    const status = req.query.status || ''

    const page = parseInt(req.query.page) || 1
    const limit = 6
    const skip = (page - 1) * limit

    let query = { userId: user.id }

    if (search) {
      query.orderId = { $regex: search, $options: 'i' }
    }
    if (status && status !== 'all') {
      query.orderStatus = status
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
    const totalOrders = await Order.countDocuments(query)

    if (req.headers.accept.includes('json')) {
      return res.json({
        orders,
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        search,
        status
      })
    }

    res.render('User/order/orderListPage.ejs', {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      search,
      status
    })
  } catch (error) {
    console.error('error from orderListPage:', error)
  }
}

export const orderDetailsLoad = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const user = req.session.user
    if (!user) {
      return res.redirect('/')
    }
    if (!orderId) {
      return res.status(404).render('404', { message: 'Order id not found' })
    }

    const order = await Order.findOne({ orderId })
    if (!order) {
      return res.status(404).render('404', { message: 'Order not found' })
    }
    const allCancelled = order.items.every(i => i.status === 'Cancelled')

    res.render('User/order/orderDetails.ejs', {
      order,
      statusText: getStatusText(order.orderStatus),
      formatDate,
      allCancelled
    })
  } catch (error) {
    console.error('Error from orderDetailsPage :', error)
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const generateInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.id

    const order = await Order.findOne({
      orderId
    })

    if (!order) {
      return res.status(404).send('Order not found')
    }

    // ✅ Render EJS to HTML
    const filePath = path.join('views/User/invoice.ejs')

    const html = await ejs.renderFile(filePath, { order })

    // 🚀 Launch Puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // ✅ Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '15px',
        right: '15px'
      }
    })

    await browser.close()

    // 📥 Send as download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${order.orderId}.pdf`
    })

    res.send(pdf)
  } catch (error) {
    console.error('Puppeteer Error:', error)
    res.status(500).send('PDF generation failed')
  }
}

export const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params
    const { reason, comment } = req.body

    const order = await Order.findOne({ orderId })

    const item = order.items.id(itemId)
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not Found'
      })
    }

    if (item.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Already Cancelled'
      })
    }
    const { productId, variantId, quantity } = item
    const product = await Product.findOne({ _id: productId })
    if (!product) {
      return res.status(400).json({
        success: false,
        message: 'Product not found'
      })
    }

    const variant = product.variants.find(
      v => v.varientId.toString() === variantId.toString()
    )

    if(!reason){
      return res.status(400).json({
        success : false,
        message : "Please select a reason"
      })
    }
    if (!variant) {
      return res.status(400).json({
        success: false,
        message: 'Variant not found'
      })
    }
    item.status = 'Cancelled'
    item.cancellation = {
      reason,
      comment,
      cancelledAt: new Date()
    }
    variant.stock += quantity

    const allCancelled = order.items.every(i => i.status === 'Cancelled')

    if (allCancelled) {
      order.orderStatus = 'Cancelled'
      order.cancellation = {
        reason,
        comment,
        cancelledAt: new Date()
      }
    }

    await order.save()
    await product.save()
    return res.status(200).json({
      success: true,
      message: `${product.name} cancelled successfully`
    })
  } catch (error) {
    console.error('Error from cancelItem :', error)
  }
}

export const itemCancelLoad = async (req, res) => {
  try {
    const { orderId, itemId } = req.params
    const user = req.session.user

    if (!user) {
      return res.redirect('/')
    }

    if (!orderId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    const order = await Order.findOne({
      orderId
    })
    const item = order.items.find(item => item._id.toString() === itemId)

    res.render('User/order/orderCancelPage.ejs', {
      order,
      item
    })
  } catch (error) {
    console.log('Error from orderCancelLoad :', error)
  }
}

export const orderCancelLoad = async (req, res) => {
  try {
    const orderId = req.params.id
    const user = req.session.user

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Please login first'
      })
    }

    if (!orderId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    const order = await Order.findOne({
      orderId,
      userId: user.id
    })

    res.render('User/order/orderCancelPage.ejs', {
      order,
      item : null
    })
  } catch (error) {
    console.log('Error from orderCancelLoad :', error)
  }
}

export const orderCancel = async (req, res) => {
  try {
    const user = req.session.user
    const orderId = req.params.id

    if (!user) {
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
    const order = await Order.findOne({
      orderId,
      userId: user.id
    })

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      })
    }

    const { reason, comment } = req.body

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Please select an reason'
      })
    }

    if (['Shipped', 'Delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Your order already Shipped'
      })
    }
    let allCancelled = order.items.every(i => i.status === 'Cancelled')

    if (allCancelled) {
      return res.json({
        success: false,
        message: 'You already Cancelled'
      })
    }

    for (const item of order.items) {
      if (item.status !== 'Cancelled') {
        item.status = 'Cancelled'

        item.cancellation = {
          reason,
          comment: comment?.trim() || '',
          cancelledAt: new Date()
        }
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
    // allCancelled = order.items.every(i => i.status === 'Cancelled')
    order.orderStatus = 'Cancelled'
    // if (allCancelled) {
      order.timeline.cancelledAt = new Date()
    // }

    order.save()
    return res.status(200).json({
      success: true,
      message: `${orderId} has Cancelled`
    })
  } catch (error) {
    console.log('Error from orderCancel', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}


export const itemReturnLoad = async (req, res) => {
  try {
    const {orderId,itemId} = req.params
    const user = req.session.user

    if (!user) {
      return res.redirect("/")
    }

    if (!orderId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    const order = await Order.findOne({
      orderId
    })
    
    const item = order.items.find(item => item._id.toString() === itemId)
    res.render('User/order/orderReturnPage.ejs', {
      order,
      item
    })
  } catch (error) {
    console.log('Error from orderCancelLoad :', error)
  }
}

export const orderReturnLoad = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const user = req.session.user

    if (!user) {
      return res.redirect("/")
    }

    if (!orderId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    const order = await Order.findOne({
      orderId
    })

    res.render('User/order/orderReturnPage.ejs', {
      order,
      item:null
    })
  } catch (error) {
    console.log('Error from orderCancelLoad :', error)
  }
}


export const returnOrderItem = async (req, res) => {
  try {
    const user = req.session.user;
    const { orderId, itemId } = req.params;
    const { reason, comment } = req.body;

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Please login first"
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please select a reason"
      });
    }

    const order = await Order.findOne({
      orderId,
      userId: user.id
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order not found"
      });
    }

    const item = order.items.id(itemId);

    if (!item) {
      return res.status(400).json({
        success: false,
        message: "Item not found"
      });
    }

    if (item.status !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered items can be returned"
      });
    }

    if (item.status === "Returned") {
      return res.status(400).json({
        success: false,
        message: "Item already returned"
      });
    }

    item.status = "Return Requested";
    item.returnRequest = {
      status : "Pending",
      reason,
      comment: comment?.trim() || "",
      returnedAt: new Date()
    };

    const allReturned = order.items.every(i => i.status === "Return Requested");

    if (allReturned) {
      order.orderStatus = "Return Requested";
      order.returnRequest={
        status : "Pending",
        reason,
        comment : comment?.trim() || ""
      }
      order.timeline.returnedAt = new Date();
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Item returned successfully"
    });

  } catch (error) {
    console.log("Error in returnOrderItem:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export const returnOrder = async (req, res) => {
  try {
    const user = req.session.user;
    const orderId = req.params.orderId
    const { reason, comment } = req.body;

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Please login first"
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please select a reason"
      });
    }

    const order = await Order.findOne({
      orderId,
      userId: user.id
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned"
      });
    }

    if (order.orderStatus === "Returned") {
      return res.status(400).json({
        success: false,
        message: "Order already returned"
      });
    }

    const now = new Date();

    for (const item of order.items) {

      if (item.status === "Returned") continue;

      item.status = "Return Requested";

      item.returnRequest = {
        status : "Pending",
        reason,
        comment: comment?.trim() || "",
        returnedAt: now
      };

    }

    order.orderStatus = "Return Request";

    order.returnRequest = {
      status : "Pending",
      reason,
      comment: comment?.trim() || "",
      requestedAt: now
    };

    await order.save();

    return res.status(200).json({
      success: true,
      message: `${orderId} returned successfully`
    });

  } catch (error) {
    console.log("Error in returnOrder:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};