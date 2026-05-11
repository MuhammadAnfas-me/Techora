import {
  fetchAvailableCoupons,
  applyUserCoupon,
  recalculateAfterCouponRemoval
} from '../../services/user/couponService.js'

// ─────────────────────────────────────────────
// Get Available Coupons
// ─────────────────────────────────────────────

export const getAvailableCoupons = async (req, res) => {
  try {
    const coupons = await fetchAvailableCoupons()

    res.status(200).json({ success: true, coupons })
  } catch (err) {
    console.log('Error from getAvailableCoupons:', err)
    res
      .status(404)
      .json({ success: false, message: 'Server error', coupons: [] })
  }
}

// ─────────────────────────────────────────────
// Apply Coupon
// ─────────────────────────────────────────────

export const applyCoupon = async (req, res) => {
  try {
    const user = req.session.user

    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { code } = req.body

    const result = await applyUserCoupon({
      code,
      userId: user.id,
      alreadyApplied: !!req.session.coupon
    })

    req.session.coupon = {
      couponId: result.couponId,
      code: result.code
    }

    return res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        code: result.code,
        discount: result.discount,
        finalTotal: result.finalTotal
      }
    })
  } catch (error) {
    console.log('Error in applyCoupon:', error)

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      })
    }

    return res
      .status(500)
      .json({ success: false, message: 'Something went wrong' })
  }
}

// ─────────────────────────────────────────────
// Remove Coupon
// ─────────────────────────────────────────────

export const removeCoupon = async (req, res) => {
  try {
    req.session.coupon = null

    const user = req.session.user

    const { subtotal, discount, finalTotal } =
      await recalculateAfterCouponRemoval(user.id)

    return res.json({ success: true, subtotal, discount, finalTotal })
  } catch (err) {
    console.log('Error in removeCoupon:', err)
    res.status(500).json({ success: false })
  }
}
