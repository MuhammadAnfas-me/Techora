import { generateTxnId } from '../../utils/generateTxnId.js'
import Address from '../../models/addressModel.js'
import { Cart } from '../../models/cartModel.js'
import { Order } from '../../models/orderModel.js'
import { Wallet } from '../../models/walletModel.js'
import Product from '../../models/productModel.js'
import { razorpayInstance } from '../../config/razorpay.js'
import crypto from 'crypto'
import { Coupon } from '../../models/couponModel.js'

export const paymentPageLoad = async (req, res) => {
  try {
    const user = req.session.user
    const addressId = req.query.addressId
    if (!user) {
      return res.redirect('/')
    }
    const cart = await Cart.findOne({ userId: user.id }).populate(
      'items.productId'
    )

    let cartItems = []
    let hasInvalidItems = false // ⭐ important

    if (cart && Array.isArray(cart.items)) {
      cartItems = cart.items.map(item => {
        const product = item.productId

        if (!product) {
          hasInvalidItems = true
          return {
            name: 'Product not found',
            isValid: false,
            message: 'Product removed'
          }
        }

        const variant = product.variants.find(
          v => v.varientId === item.variantId
        )

        if (!variant) {
          hasInvalidItems = true
          return {
            productId: product._id,
            name: product.name,
            isValid: false,
            message: 'Variant not available'
          }
        }

        let isValid = true
        let message = ''

        if (product.status !== 'active') {
          isValid = false
          message = 'Product unavailable'
        } else if (variant.stock === 0) {
          isValid = false
          message = 'Out of stock'
        } else if (item.quantity > variant.stock) {
          isValid = false
          message = `Only ${variant.stock} left`
        }

        if (!isValid) hasInvalidItems = true

        return {
          productId: product._id,
          variantId: item.variantId,
          quantity: item.quantity,
          name: product.name,
          brand: product.brand,
          image: variant.image?.[0] || '',
          price: variant.price,
          stock: variant.stock,
          subtotal: item.total,
          //  validation fields
          isValid,
          message
        }
      })
    }
    let grandTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

    let discount = 0
    let finalAmount = 0

    if (req.session.coupon) {
      const code = req.session.coupon.code
      const coupon = await Coupon.findOne({ couponCode: code })
      const now = new Date()

      if (!coupon) {
        return res.json({
          success: false,
          message: 'Invalid coupon'
        })
      }

      if (!coupon.isActive) {
        return res.json({
          success: false,
          message: 'Coupon inactive'
        })
      }

      if (coupon.expiryDate < now) {
        return res.json({
          success: false,
          message: 'Coupon expired'
        })
      }

      if (coupon.startDate && coupon.startDate > now) {
        return res.json({
          success: false,
          message: 'Coupon not started yet'
        })
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.json({
          success: false,
          message: 'Coupon usage limit reached'
        })
      }

      if (coupon.discountType === 'Flat') {
        discount = coupon.discountValue
      }

      if (coupon.discountType === 'Percentage') {
        discount = (grandTotal * coupon.discountValue) / 100
      }

      discount = Math.min(discount, grandTotal)
      finalAmount = Math.round(grandTotal - discount)
    }

    res.render('User/paymentPage.ejs', {
      cartItems,
      grandTotal,
      finalAmount,
      discount: discount ? Math.round(discount) : 0,
      coupon: req.session.coupon ? req.session.coupon : null
    })
  } catch (error) {
    console.log('Error from PaymentPageLoad :', error)
  }
}

export const createOrder = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      res.redirect('/login')
    }

    const cart = await Cart.findOne({ userId: user.id }).populate(
      'items.productId'
    )

    let subtotal = 0

    for (let item of cart.items) {
      const variant = item.productId.variants.find(
        v => v.varientId.toString() === item.variantId.toString()
      )

      subtotal += variant.price * item.quantity
    }

    // 🔥 APPLY COUPON FROM SESSION
    let discount = 0

    if (req.session.coupon) {
      const coupon = await Coupon.findById(req.session.coupon.couponId)

      if (coupon) {
        if (coupon.discountType === 'Flat') {
          discount = coupon.discountValue
        } else {
          discount = (subtotal * coupon.discountValue) / 100
        }

        if (coupon.maxDiscount) {
          discount = Math.min(discount, coupon.maxDiscount)
        }

        discount = Math.min(discount, subtotal)
      }
    }

    const finalTotal = subtotal - discount

    const order = await razorpayInstance.orders.create({
      amount: Math.round(finalTotal * 100), // 🔥 only backend decides
      currency: 'INR',
      receipt: 'order_' + Date.now()
    })

    res.json({
      success: true,
      key: process.env.RAZOR_KEY,
      order
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false })
  }
}

export const verifyPayment = (req, res) => {
  console.log('Call reached in verifyPsyment ')
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body

  const body = razorpay_order_id + '|' + razorpay_payment_id

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZOR_SECRET)
    .update(body.toString())
    .digest('hex')

  if (expectedSignature === razorpay_signature) {
    // Payment is verified
    res.json({
      success: true,
      paymentId: razorpay_payment_id
    })
  } else {
    res.status(400).json({
      success: false,
      redirect: '/checkout/payment/failed'
    })
  }
}

export const orderSuccess = (req, res) => {
  res.render('User/order/orderSuccessPage.ejs')
}

export const placeOrder = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) return res.redirect('/')

    const { addressId, paymentMethod, paymentId } = req.body

    const addressDoc = await Address.findOne({
      userId: user.userId,
      _id: addressId
    })

    if (!addressDoc) {
      return res.json({ success: false, message: 'Address not found' })
    }

    const cart = await Cart.findOne({ userId: user.id }).populate(
      'items.productId'
    )

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      })
    }

    let orderItems = []
    let subtotal = 0

    for (let item of cart.items) {
      const product = item.productId

      if (!product) {
        return res.status(400).json({
          success: false,
          message: 'Product not found'
        })
      }

      const variant = product.variants.find(
        v => v.varientId.toString() === item.variantId.toString()
      )

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `${product.name} variant not available`
        })
      }

      if (product.status === 'inactive') {
        return res.status(400).json({
          success: false,
          message: `${product.name} is unavailable`
        })
      }

      if (variant.stock === 0 || item.quantity > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `${product.name} stock issue`
        })
      }

      const itemTotal = variant.price * item.quantity
      subtotal += itemTotal

      orderItems.push({
        productId: product._id,
        name: product.name,
        brand: product.brand,
        variantId: item.variantId,
        color: variant.color,
        quantity: item.quantity,
        price: variant.price,
        total: itemTotal,
        image: variant.image?.[0] || ''
      })
    }

    // ======================
    // 🔥 COUPON LOGIC
    // ======================

    let discount = 0
    let couponData = null

    if (req.session.coupon) {
      const coupon = await Coupon.findById(req.session.coupon.couponId)

      if (coupon) {
        const now = new Date()

        if (
          coupon.isActive &&
          coupon.expiryDate >= now &&
          (!coupon.startDate || coupon.startDate <= now) &&
          subtotal >= coupon.minOrderValue &&
          (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)
        ) {
          if (coupon.discountType === 'Flat') {
            discount = coupon.discountValue
          }

          if (coupon.discountType === 'Percentage') {
            discount = (subtotal * coupon.discountValue) / 100
          }

          if (coupon.maxDiscount) {
            discount = Math.min(discount, coupon.maxDiscount)
          }

          discount = Math.min(discount, subtotal)
          discount = Math.round(discount)

          couponData = {
            couponId: coupon._id,
            code: coupon.couponCode,
            discountType : coupon.discountType,
            discountValue : coupon.discountValue,
            discount
          }

          const existingUser = coupon.usedBy.find(
            u => u.userId.toString() === user.id.toString()
          )

          if (existingUser) {
            await Coupon.updateOne(
              {
                _id: coupon._id,
                'usedBy.userId': user.id
              },
              {
                $inc: {
                  usedCount: 1,
                  'usedBy.$.count': 1
                }
              }
            )
          } else {
            await Coupon.updateOne(
              {
                _id: coupon._id
              },
              {
                $push: {
                  usedBy: { userId: user.id, count: 1 }
                },
                $inc: { usedCount: 1 }
              }
            )
          }

          // // ✅ correct usage update
          // await Coupon.updateOne(
          //   { _id: coupon._id, 'usedBy.userId': user.id },
          //   { $inc: { usedCount: 1, 'usedBy.$.count': 1 } }
          // )
        }
      }
    }

    const totalAmount = subtotal - discount

    // ======================
    // ORDER CREATE
    // ======================

    const orderId = 'ORD' + Date.now()

    const newOrder = new Order({
      userId: user.id,
      orderId,
      addressId,
      items: orderItems,
      subtotal,
      // discount,
      totalAmount,
      coupon: couponData, // 🔥 correct
      address: {
        name: addressDoc.fullName,
        phone: addressDoc.phone,
        addressLine1: addressDoc.addressLine1,
        addressLine2: addressDoc.addressLine2,
        city: addressDoc.city,
        state: addressDoc.state,
        zipCode: addressDoc.zipCode
      },
      orderStatus: 'Placed'
    })

    // ======================
    // STOCK UPDATE
    // ======================

    for (let item of cart.items) {
      await Product.updateOne(
        {
          _id: item.productId._id,
          'variants.varientId': item.variantId
        },
        {
          $inc: { 'variants.$.stock': -item.quantity }
        }
      )
    }

    // ======================
    // PAYMENT
    // ======================

    if (paymentMethod === 'COD') {
      newOrder.paymentMethod = 'COD'
      newOrder.paymentStatus = 'Pending'
    } else if (paymentMethod === 'WALLET') {
      const wallet = await Wallet.findOne({ userId: user.id })

      if (wallet.balance < totalAmount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance'
        })
      }

      wallet.transaction.push({
        txnId: generateTxnId(),
        type: 'debit',
        amount: totalAmount,
        description: 'Order payment'
      })

      wallet.balance -= totalAmount
      await wallet.save()

      newOrder.paymentMethod = 'WALLET'
      newOrder.paymentStatus = 'Paid'
    } else {
      newOrder.paymentMethod = 'RAZORPAY'
      newOrder.paymentStatus = 'Paid'
      newOrder.razorpayPaymentId = paymentId
    }

    await newOrder.save()

    await Cart.findOneAndDelete({ userId: user.id })

    req.session.coupon = null

    return res.json({
      success: true,
      message: 'Order placed successfully',
      orderId: newOrder.orderId
    })
  } catch (er) {
    console.error('Error from place order :', er)
    return res.json({
      success: false,
      message: 'Something went wrong'
    })
  }
}

export const fetchOrderDetails = async (req, res) => {
  try {
    const orderId = req.query.orderId
    const order = await Order.findOne({ orderId })
    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'Order not found'
      })
    }
    return res.status(200).json({
      success: true,
      message: 'Order fetched successfully',
      orderId: order.orderId,
      orderDate: order.createdAt,
      address1: order.address.addressLine1,
      address2: order.address.addressLine2
    })
  } catch (er) {
    console.error('Error from fetchOrderDetails :', er)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const paymentFailedPage = (req, res) => {
  const addressId = req.query.addressId
  const message = req.query.message

  console.log(message)
  res.render('User/order/paymentFailedPage.ejs', {
    addressId,
    message
  })
}
