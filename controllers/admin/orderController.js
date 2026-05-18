import {
  fetchAdminOrderList,
  streamOrdersPDF,
  fetchOrderDetails,
  changeOrderStatus,
  processItemReturn,
  cancelAdminOrder,
  processReturnStatus,
  changeItemStatus
} from '../../services/admin/orderService.js' 
import { generateOrderInvoice } from '../../services/user/orderService.js'
import { ORDER_STATUS } from '../../constants/orderConstants.js'
// ─────────────────────────────────────────────
// Order List — Page render
// ─────────────────────────────────────────────

export const orderListLoad = async (req, res) => {
  try {
    const { search, status, dateSort } = req.query
    const page = parseInt(req.query.page) || 1

    const data = await fetchAdminOrderList({ page, search, status, dateSort })

    res.render('Admin/order/orderListPage.ejs', { ...data, ORDER_STATUS })
  } catch (error) {
    console.error('Error from orderListLoad:', error)
    const statusCode = error.status || 500
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Export Orders PDF
// ─────────────────────────────────────────────

export const exportOrdersPDF = async (req, res) => {
  try {
    await streamOrdersPDF(res)
  } catch (error) {
    console.error('PDF Export Error:', error)
    const statusCode = error.status || 500
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Order Details — Page render
// ─────────────────────────────────────────────

export const orderDetailsPage = async (req, res) => {
  try {
    const { order } = await fetchOrderDetails(req.params.orderId)

    res.render('Admin/order/orderDetailsPage.ejs', {
      order,
      currentPage: 'orders',
      ORDER_STATUS
    })
  } catch (error) {
    console.log('Error From orderDetailsPage:', error)
    const statusCode = error.status || 500
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Update Order Status
// ─────────────────────────────────────────────

export const updateOrderStatus = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Please login first' })
    }

    await changeOrderStatus(req.params.orderId, req.body.orderStatus)

    return res.status(200).json({ success: true, message: 'Status updated successfully' })
  } catch (error) {
    console.log('Error from updateOrderStatus:', error)
    const statusCode = error.status || 500
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Update Individual Item Status
// ─────────────────────────────────────────────

export const updateItemStatus = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Please login first' })
    }

    const { orderId, itemId } = req.params
    const { status } = req.body

    await changeItemStatus(orderId, itemId, status)

    return res.status(200).json({ success: true, message: 'Item status updated successfully' })
  } catch (error) {
    console.log('Error from updateItemStatus:', error)
    const statusCode = error.status || 500
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Return Item (admin approve single item)
// ─────────────────────────────────────────────

export const returnItem = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Please login first' })
    }

    const { itemName } = await processItemReturn(
      req.params.orderId,
      req.body.itemId
    )

    return res.status(200).json({
      success: true,
      message: `${itemName} returned successfully`
    })
  } catch (error) {
    console.error('Error From ReturnItem:', error)
    const statusCode = error.status || 500
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Order Cancel (admin)
// ─────────────────────────────────────────────

export const orderCancel = async (req, res) => {
  try {
    await cancelAdminOrder(req.params.orderId)

    return res.status(200).json({ success: true, message: 'Order cancelled successfully' })
  } catch (error) {
    console.log('Error from order cancel in admin:', error)
    const statusCode = error.status || 500
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Update Return Status (Approve / Reject)
// ─────────────────────────────────────────────

export const updateReturnStatus = async (req, res) => {
  try {
    const { id, type, status } = req.body

    await processReturnStatus(id, type, status)

    return res.status(200).json({ success: true, redirect: '/admin/orders' })
  } catch (error) {
    console.log('Error from updateReturnStatus:', error)
    const statusCode = error.status || 400
    const message    = error.message || 'Server error'
    return res.status(statusCode).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Generate Invoice
// ─────────────────────────────────────────────

export const generateInvoice = async (req, res) => {
  try {
    const { pdf, orderId } = await generateOrderInvoice(req.params.orderId)

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