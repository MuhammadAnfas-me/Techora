import {
  buildPaymentPageData,
  createRazorpayOrder,
  verifyRazorpaySignature,
  placeUserOrder,
  fetchOrderSummary
} from '../../services/user/paymentService.js' 

// ─────────────────────────────────────────────
// Payment Page Load
// ─────────────────────────────────────────────

export const paymentPageLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const data = await buildPaymentPageData(user.id, req.session.coupon ?? null)

    res.render('User/paymentPage.ejs', data)
  } catch (error) {
    console.log('Error from paymentPageLoad:', error)

    const status  = error.status || 500
    const message = error.message || 'Something went wrong'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Create Razorpay Order
// ─────────────────────────────────────────────

export const createOrder = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/login')

    const { key, order } = await createRazorpayOrder(
      user.id,
      req.session.coupon ?? null
    )

    res.json({ success: true, key, order })
  } catch (error) {
    console.log('Error from createOrder:', error)
    const status  = error.status || 500
    const message = error.message || 'Something went wrong'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Verify Payment
// ─────────────────────────────────────────────

export const verifyPayment = (req, res) => {
  try {
    const { paymentId } = verifyRazorpaySignature(req.body)
    res.json({ success: true, paymentId })
  } catch (error) {
    console.log('Payment verification failed:', error.message)
    res.status(error.status || 400).json({
      success:  false,
      message:  error.message || 'Payment verification failed',
      redirect: '/checkout/payment/failed'
    })
  }
}

// ─────────────────────────────────────────────
// Place Order
// ─────────────────────────────────────────────

export const placeOrder = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const { addressId, paymentMethod, paymentId } = req.body

    const { orderId, clearCoupon } = await placeUserOrder(
      user.userId, 
      user.id,      
      {
        addressId,
        paymentMethod,
        paymentId,
        sessionCoupon: req.session.coupon ?? null
      }
    )

    if (clearCoupon) req.session.coupon = null

    return res.json({
      success: true,
      message: 'Order placed successfully',
      orderId
    })
  } catch (error) {
    console.error('Error from placeOrder:', error)
    const status  = error.status || 500
    const message = error.message || 'Something went wrong'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Order Success Page
// ─────────────────────────────────────────────

export const orderSuccess = (req, res) => {
  res.render('User/order/orderSuccessPage.ejs')
}

// ─────────────────────────────────────────────
// Fetch Order Details (API)
// ─────────────────────────────────────────────

export const fetchOrderDetails = async (req, res) => {
  try {
    const data = await fetchOrderSummary(req.query.orderId)

    return res.status(200).json({
      success: true,
      message: 'Order fetched successfully',
      ...data
    })
  } catch (error) {
    console.error('Error from fetchOrderDetails:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Payment Failed Page
// ─────────────────────────────────────────────

export const paymentFailedPage = (req, res) => {
  const { addressId, message } = req.query
  res.render('User/order/paymentFailedPage.ejs', { addressId, message })
}