import { Coupon } from '../../models/couponModel.js'
import { validate } from '../../utils/fieldValidation.js'
import { Order } from '../../models/orderModel.js'

export const couponListLoad = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) {
      return res.redirect('/admin/login')
    }

    let { page = 1, search = '', type = '', status = '' } = req.query

    page = parseInt(page) || 1
    const limit = 8
    const skip = (page - 1) * limit

    // 🔍 Build query
    let query = { isDeleted: { $ne: true } }

    // search by coupon code
    if (search) {
      query.couponCode = { $regex: search, $options: 'i' }
    }

    // filter by type
    if (type && type !== 'All') {
      query.discountType = type
    }

    // filter by status
    if (status && status !== 'All Status') {
      if (status === 'Active') {
        query.isActive = true
        query.expiryDate = { $gte: new Date() }
      } else if (status === 'Expired') {
        query.expiryDate = { $lt: new Date() }
      } else if (status === 'Disabled') {
        query.isActive = false
      }
    }
    const totalCoupons = await Coupon.countDocuments()

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const totalPages = Math.ceil(totalCoupons / limit)

    const formattedCoupons = coupons.map(c => {
      let usedBar = 0
      let barClass = 'bar-green'

      // calculate usage %
      if (c.usageLimit !== null) {
        usedBar = Math.min(Math.round((c.usedCount / c.usageLimit) * 100), 100)

        // decide color
        if (usedBar >= 90) barClass = 'bar-orange'
        if (usedBar === 100) barClass = 'bar-gray'
      }

      // status logic
      let status = 'Active'
      const now = new Date()

      if (!c.isActive) status = 'Disabled'
      else if (new Date(c.expiryDate) < now) status = 'Expired'

      return {
        code: c.couponCode,
        type: c.discountType,
        value: c.discountValue,
        minOrder: c.minOrderValue,
        usageLimit: c.usageLimit === null ? 'Unlimited' : c.usageLimit,
        used: c.usedCount,
        usedBar,
        barClass,
        expiry: c.expiryDate,
        status,
        toggleOn: c.isActive
      }
    })
    res.render('Admin/coupon/couponListPage.ejs', {
      coupons: formattedCoupons,
      currentPage: page,
      totalPages,
      totalCoupons,
      limit,
      search,
      type,
      status
    })
  } catch (error) {
    console.log('Error from couponListLoad :', error)
  }
}

export const addCouponPage = (req, res) => {
  res.render('Admin/coupon/addCouponPage.ejs')
}

export const addCoupon = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) {
      return res.redirect('/admin/login')
    }
    let {
      couponCode,
      discountType,
      discountValue,
      minOrder,
      usageLimit,
      limitPerUser,
      startDate,
      expiryDate,
      isActive,
      internalNotes
    } = req.body
    couponCode = couponCode?.trim()

    // Field validations
    if (validate(couponCode, res, 'Coupon is required')) return
    if (validate(discountType, res, 'Please select discount type')) return
    if (validate(discountValue, res, 'Please enter discount value')) return
    if (validate(minOrder, res, 'Please enter Minimum order value')) return
    if (validate(limitPerUser, res, 'Limit is required')) return
    if (validate(startDate, res, 'Please select starting date')) return
    if (validate(expiryDate, res, 'Please select expiry date')) return

    if (usageLimit !== null && usageLimit <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Usage limit must be greater than 0'
      })
    }
    // Date validation
    if (new Date(startDate) >= new Date(expiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be after start date'
      })
    }

    // Checking name is already exist
    const coupon = await Coupon.findOne({
      couponCode: couponCode.toUpperCase()
    })
    if (coupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon already exists'
      })
    }

    if (discountType === 'Flat' && Number(discountValue) > Number(minOrderValue)) {
      return res.status(400).json({
        success: false,
        message: 'Discount cannot be greater than minimum order value'
      })
    }
    if (discountType === 'Percentage') {
      if (Number(discountValue) <= 0 || Number(discountValue) > 80) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount must be between 1 and 80'
        })
      }
    }

    usageLimit = usageLimit === null ? null : Number(usageLimit)
    const newCoupon = new Coupon({
      couponCode: couponCode.toUpperCase(),
      discountType,
      discountValue,
      minOrderValue: minOrder,
      usageLimit,
      limit: limitPerUser,
      startDate,
      expiryDate,
      isActive,
      internalNotes: internalNotes ? internalNotes : ''
    })

    await newCoupon.save()
    return res.status(200).json({
      success: true,
      message: 'Coupon created successfully'
    })
  } catch (error) {
    console.log('Error from addCoupon', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const editPageLoad = async (req, res) => {
  try {
    const { code } = req.params
    const coupon = await Coupon.findOne({ couponCode: code })
    res.render('Admin/coupon/editCouponPage.ejs', { coupon })
  } catch (error) {
    console.log('Error from editPageLoad :', error)
  }
}

export const editCoupon = async (req, res) => {
  try {
    const admin = req.session.admin
    if (!admin) {
      return res.redirect('/admin/login')
    }

    const { code } = req.params

    let {
      couponCode,
      discountType,
      discountValue,
      minOrder,
      usageLimit,
      limitPerUser,
      startDate,
      expiryDate,
      isActive,
      internalNotes
    } = req.body
    minOrder = Number(minOrder)
    discountValue = Number(discountValue)
    couponCode = couponCode?.trim()
    // 🔹 Field validations
    if (validate(couponCode, res, 'Coupon is required')) return
    if (validate(discountType, res, 'Please select discount type')) return
    if (validate(discountValue, res, 'Please enter discount value')) return
    if (validate(minOrder, res, 'Please enter Minimum order value')) return
    if (validate(limitPerUser, res, 'Limit is required')) return
    if (validate(startDate, res, 'Please select starting date')) return
    if (validate(expiryDate, res, 'Please select expiry date')) return

    // 🔹 Usage limit validation
    if (usageLimit !== null && usageLimit !== '' && Number(usageLimit) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Usage limit must be greater than 0'
      })
    }

    // 🔹 Date validation
    if (new Date(startDate) >= new Date(expiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be after start date'
      })
    }

    // 🔹 Check if coupon exists
    const existingCoupon = await Coupon.findOne({ couponCode: code })
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      })
    }

    // 🔹 Check duplicate coupon code (exclude current)
    const duplicate = await Coupon.findOne({
      couponCode,
      _id: { $ne: existingCoupon._id }
    })

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'Coupon already exists'
      })
    }

    if (discountType === 'Flat' && minOrder <= discountValue) {
      return res.status(400).json({
        success: false,
        message: 'Discount cannot be greater than minimum order value'
      })
    }

    if (discountType === 'Percentage') {
      if (discountValue <= 0 || discountValue > 80) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount must be between 1 and 100'
        })
      }
    }

    // 🔹 Handle unlimited
    usageLimit = usageLimit === null ? null : Number(usageLimit)

    // 🔹 Update
    await Coupon.findOneAndUpdate(existingCoupon._id, {
      couponCode: couponCode.toUpperCase(),
      discountType,
      discountValue,
      minOrderValue: minOrder,
      usageLimit,
      limit: limitPerUser,
      startDate,
      expiryDate,
      isActive,
      internalNotes: internalNotes || ''
    })

    return res.status(200).json({
      success: true,
      message: 'Coupon updated successfully'
    })
  } catch (error) {
    console.log('Error from editCoupon', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const statusToggle = async (req, res) => {
  try {
    const { code, isActive } = req.body
    const coupon = await Coupon.findOne({ couponCode: code })
    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon not found'
      })
    }

    coupon.isActive = !coupon.isActive

    await coupon.save()

    return res.status(200).json({
      success: true,
      message: `Coupon ${
        coupon.isActive ? 'activated' : 'deactivated'
      } successfully`
    })
  } catch (error) {
    console.log('Toggle coupon error :', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const deleteCoupon = async (req, res) => {
  try {
    const { code } = req.params

    // 1. Validate ID
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon name is required'
      })
    }

    // 2. Find coupon
    const coupon = await Coupon.findOne({ couponCode: code })

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      })
    }

    // 3. Prevent deleting already deleted
    if (coupon.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Coupon already deleted'
      })
    }

    // 4. Check if coupon is used in orders
    const isUsed = await Order.exists({ couponCode: coupon.couponCode })

    if (isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete coupon already used in orders'
      })
    }

    // 5. Soft delete
    coupon.isDeleted = true
    coupon.isActive = false

    await coupon.save()

    return res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    })
  } catch (error) {
    console.error('Delete Coupon Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}
