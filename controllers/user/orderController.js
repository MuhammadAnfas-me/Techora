import {
  getOrderDashboardData,
  getOrderList,
  getOrderDetails,
  generateOrderInvoice,
  cancelOrderItem,
  getItemForCancelPage,
  getOrderForCancelPage,
  cancelWholeOrder,
  getItemForReturnPage,
  getOrderForReturnPage,
  requestItemReturn,
  requestWholeOrderReturn,
  getReviewPageData,
  submitReview
} from '../../services/user/orderService.js'
import { ORDER_STATUS, PAYMENT_METHOD } from '../../constants/orderConstants.js'
// ─────────────────────────────────────────────
// Order Dashboard
// ─────────────────────────────────────────────

export const OrderLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const data = await getOrderDashboardData(user.id)

    res.render('User/order/orderPage.ejs', { ...data, ORDER_STATUS })
  } catch (error) {
    console.log(error)
  }
}

// ─────────────────────────────────────────────
// Order List
// ─────────────────────────────────────────────

export const orderListPage = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const data = await getOrderList(user.id, {
      search: req.query.search || '',
      status: req.query.status || '',
      page: parseInt(req.query.page) || 1
    })

    if (req.headers.accept?.includes('json')) {
      return res.json(data)
    }

    res.render('User/order/orderListPage.ejs', { ...data, ORDER_STATUS })
  } catch (error) {
    console.error('error from orderListPage:', error)
  }
}

// ─────────────────────────────────────────────
// Order Details
// ─────────────────────────────────────────────

export const orderDetailsLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const orderId = req.params.orderId
    if (!orderId) {
      return res.status(404).render('error', { statusCode: 404, message: 'Order id not found' })
    }

    const data = await getOrderDetails(orderId)

    res.render('User/order/orderDetails.ejs', { ...data, ORDER_STATUS, PAYMENT_METHOD })
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).render('error', { statusCode: 404, message: error.message })
    }
    console.error('Error from orderDetailsPage:', error)
  }
}

// ─────────────────────────────────────────────
// Invoice PDF
// ─────────────────────────────────────────────

export const generateInvoicePDF = async (req, res) => {
  try {
    const { pdf, orderId } = await generateOrderInvoice(req.params.id)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${orderId}.pdf`
    })

    res.send(pdf)
  } catch (error) {
    if (error.status === 404) return res.status(404).send(error.message)
    console.error('Puppeteer Error:', error)
    res.status(500).send('PDF generation failed')
  }
}

// ─────────────────────────────────────────────
// Cancel Item
// ─────────────────────────────────────────────

export const itemCancelLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const { orderId, itemId } = req.params
    if (!orderId) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    const data = await getItemForCancelPage(orderId, itemId)
    res.render('User/order/orderCancelPage.ejs', { ...data, ORDER_STATUS })
  } catch (error) {
    console.log('Error from orderCancelLoad:', error)
  }
}

export const cancelItem = async (req, res) => {
  try {
    const user = req.session.user
    const { orderId, itemId } = req.params
    const { reason, comment } = req.body

    const { productName } = await cancelOrderItem(user.id, {
      orderId,
      itemId,
      reason,
      comment
    })

    return res.status(200).json({
      success: true,
      message: `${productName} cancelled successfully`
    })
  } catch (error) {
    console.error('Error from cancelItem:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error'
    })
  }
}

// ─────────────────────────────────────────────
// Cancel Whole Order
// ─────────────────────────────────────────────

export const orderCancelLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const orderId = req.params.id
    if (!orderId) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    const data = await getOrderForCancelPage(orderId, user.id)
    res.render('User/order/orderCancelPage.ejs', { ...data, ORDER_STATUS })
  } catch (error) {
    console.log('Error from orderCancelLoad:', error)
  }
}

export const orderCancel = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      return res.status(400).json({ success: false, message: 'Please login first' })
    }

    const orderId = req.params.id
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order id not found' })
    }

    const { reason, comment } = req.body

    const result = await cancelWholeOrder(user.id, { orderId, reason, comment })

    return res.status(200).json({
      success: true,
      message: `${result.orderId} has Cancelled`
    })
  } catch (error) {
    console.log('Error from orderCancel:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error'
    })
  }
}

// ─────────────────────────────────────────────
// Return Item
// ─────────────────────────────────────────────

export const itemReturnLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const { orderId, itemId } = req.params
    if (!orderId) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    const data = await getItemForReturnPage(orderId, itemId)
    res.render('User/order/orderReturnPage.ejs', data)
  } catch (error) {
    console.log('Error from orderCancelLoad:', error)
  }
}

export const returnOrderItem = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      return res.status(400).json({ success: false, message: 'Please login first' })
    }

    const { orderId, itemId } = req.params
    const { reason, comment } = req.body

    await requestItemReturn(user.id, { orderId, itemId, reason, comment })

    return res.status(200).json({ success: true, message: 'Item return Request sented successfully' })
  } catch (error) {
    console.log('Error in returnOrderItem:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error'
    })
  }
}

// ─────────────────────────────────────────────
// Return Whole Order
// ─────────────────────────────────────────────

export const orderReturnLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const orderId = req.params.orderId
    if (!orderId) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    const data = await getOrderForReturnPage(orderId)
    res.render('User/order/orderReturnPage.ejs', data)
  } catch (error) {
    console.log('Error from orderCancelLoad:', error)
  }
}

export const returnOrder = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      return res.status(400).json({ success: false, message: 'Please login first' })
    }

    const orderId = req.params.orderId
    const { reason, comment } = req.body

    const result = await requestWholeOrderReturn(user.id, {
      orderId,
      reason,
      comment
    })

    return res.status(200).json({
      success: true,
      message: `${result.orderId} return Request sented successfully`
    })
  } catch (error) {
    console.log('Error in returnOrder:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error'
    })
  }
}

// ─────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────

export const reviewLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/login')

    const data = await getReviewPageData(req.params.itemId)
    res.render('User/order/reviewPage.ejs', data)
  } catch (error) {
    console.log(error)
    res.redirect('/')
  }
}

export const addReview = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/login')

    const { ratingValue, tittle, reviewDesc } = req.body

    await submitReview(user.id, req.params.itemId, {
      ratingValue,
      tittle,
      reviewDesc
    })

    res.status(200).json({ success: true, message: 'Review submited successfully' })
  } catch (error) {
    console.error(error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error'
    })
  }
}