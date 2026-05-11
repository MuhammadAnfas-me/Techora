import {
  getUserAddresses,
  buildCheckoutCartData,
  validateCartItems
} from '../../services/user/checkoutService.js' 

// ─────────────────────────────────────────────
// Checkout Load
// ─────────────────────────────────────────────

export const checkOutLoad = async (req, res) => {
  const user = req.session.user

  try {
    if (!user) {
      return res.redirect('/login')
    }

    const [address, { cartItems, grandTotal, hasInvalidItems }] =
      await Promise.all([
        getUserAddresses(user.userId),
        buildCheckoutCartData(user.id)
      ])

    if (cartItems.length === 0) {
      return res.redirect('/cart')
    }

    const coupon = req.session.coupon?.code ?? null

    res.render('User/checkOut.ejs', {
      address,
      cartItems,
      hasInvalidItems,
      grandTotal,
      coupon
    })
  } catch (error) {
    console.log('Error from checkOutLoad', error)
    return res.status(500).send('Failed to load')
  }
}

// ─────────────────────────────────────────────
// Validate Cart
// ─────────────────────────────────────────────

export const validateCart = async (req, res) => {
  try {
    const user = req.session.user

    const { errors } = await validateCartItems(user.id)

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors })
    }

    return res.status(200).json({ success: true, redirect: '/checkout' })
  } catch (error) {
    const status = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}