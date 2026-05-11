import {
  fetchCouponList,
  createCoupon,
  getCouponByCode,
  updateCoupon,
  toggleCouponStatus,
  softDeleteCoupon
} from '../../services/admin/couponService.js' 

// ─────────────────────────────────────────────
// Coupon List
// ─────────────────────────────────────────────

export const couponListLoad = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) return res.redirect('/admin/login')

    let { page = 1, search = '', type = '', status = '' } = req.query
    page = parseInt(page) || 1

    const data = await fetchCouponList({ page, search, type, status })

    res.render('Admin/coupon/couponListPage.ejs', data)
  } catch (error) {
    console.log('Error from couponListLoad:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Add Coupon — Page render
// ─────────────────────────────────────────────

export const addCouponPage = (req, res) => {
  res.render('Admin/coupon/addCouponPage.ejs')
}

// ─────────────────────────────────────────────
// Add Coupon — Action
// ─────────────────────────────────────────────

export const addCoupon = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) return res.redirect('/admin/login')

    const {
      couponCode, discountType, discountValue,
      minOrder, usageLimit, limitPerUser,
      startDate, expiryDate, isActive, internalNotes
    } = req.body

    await createCoupon({
      couponCode, discountType, discountValue,
      minOrder, usageLimit, limitPerUser,
      startDate, expiryDate, isActive, internalNotes
    })

    return res.status(200).json({ success: true, message: 'Coupon created successfully' })
  } catch (error) {
    console.log('Error from addCoupon:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Edit Coupon — Page render
// ─────────────────────────────────────────────

export const editPageLoad = async (req, res) => {
  try {
    const coupon = await getCouponByCode(req.params.code)
    res.render('Admin/coupon/editCouponPage.ejs', { coupon })
  } catch (error) {
    console.log('Error from editPageLoad:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Edit Coupon — Action
// ─────────────────────────────────────────────

export const editCoupon = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) return res.redirect('/admin/login')

    const {
      couponCode, discountType, discountValue,
      minOrder, usageLimit, limitPerUser,
      startDate, expiryDate, isActive, internalNotes
    } = req.body

    await updateCoupon(req.params.code, {
      couponCode, discountType, discountValue,
      minOrder, usageLimit, limitPerUser,
      startDate, expiryDate, isActive, internalNotes
    })

    return res.status(200).json({ success: true, message: 'Coupon updated successfully' })
  } catch (error) {
    console.log('Error from editCoupon:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Status Toggle
// ─────────────────────────────────────────────

export const statusToggle = async (req, res) => {
  try {
    const { code } = req.body

    const { message } = await toggleCouponStatus(code)

    return res.status(200).json({ success: true, message })
  } catch (error) {
    console.log('Toggle coupon error:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Delete Coupon (soft delete)
// ─────────────────────────────────────────────

export const deleteCoupon = async (req, res) => {
  try {
    await softDeleteCoupon(req.params.code)

    return res.status(200).json({ success: true, message: 'Coupon deleted successfully' })
  } catch (error) {
    console.error('Delete Coupon Error:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}