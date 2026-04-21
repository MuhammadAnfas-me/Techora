import { generateTxnId } from '../../utils/generateTxnId.js'
import Address from '../../models/addressModel.js'
import { Cart } from '../../models/cartModel.js'
import { Order } from '../../models/orderModel.js'
import { Wallet } from '../../models/walletModel.js'
import Product from '../../models/productModel.js'
import { razorpayInstance } from '../../config/razorpay.js'
import crypto from 'crypto'

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
    grandTotal = Math.round(grandTotal + (grandTotal * 18) / 100)
    res.render('User/paymentPage.ejs', {
      cartItems,
      grandTotal
    })
  } catch (error) {
    console.log('Error from PaymentPageLoad :', error)
  }
}

export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body
    console.log('Call reached in create order')
    console.log(amount)

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: 'order_rcptid_' + Date.now()
    }

    const order = await razorpayInstance.orders.create(options)

    res.json({
      success: true,
      key: process.env.RAZOR_KEY,
      order
    })
  } catch (error) {
    console.log('error from createOrder :', error)
    res.status(500).json({
      success: false
    })
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
    if (!user) {
      return res.redirect('/')
    }
    const addressId = req.body.addressId
    const paymentMethod = req.body.paymentMethod
    const paymentId = req.body.paymentId
    const addressDoc = await Address.findOne({
      userId: user.userId,
      _id: addressId
    })

    if (!addressDoc) {
      return res.json({
        success: false,
        message: 'Address not found'
      })
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
    let totalAmount = 0
    for (let item of cart.items) {
      const product = item.productId

      if (!product) {
        return res.status(400).json({
          success: false,
          message: 'Products not found'
        })
      }

      const variant = product.variants.find(v => v.varientId === item.variantId)

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `${product.name} variant not available`
        })
      }

      if (product.status == 'inactive') {
        return res.status(400).json({
          success: false,
          message: `${product.name} is unavailable`
        })
      }

      if (variant.stock === 0) {
        return res.status(400).json({
          success: false,
          message: `${product.name} is out of stock`
        })
      }

      if (item.quantity > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variant.stock} ${product.name} is available`
        })
      }

      totalAmount += item.total

      orderItems.push({
        productId: product._id,
        name: product.name,
        brand: product.brand,
        variantId: item.variantId,
        color: variant.color,
        quantity: item.quantity,
        price: variant.price,
        total: item.total,
        image: variant.image?.[0] || ''
      })
    }

    const orderId = 'ORD' + Date.now()
    const newOrder = new Order({
      userId: user.id,
      orderId,
      addressId,
      items: orderItems,
      totalAmount,
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

    for (let item of cart.items) {
      const product = item.productId

      await Product.updateOne(
        {
          _id: product.id,
          'variants.varientId': item.variantId
        },
        {
          $inc: {
            'variants.$.stock': -item.quantity
          }
        }
      )
    }
    
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
        amount : totalAmount,
        description: 'Order payment'
      })
      wallet.balance = wallet.balance - totalAmount

      await wallet.save()
      newOrder.paymentMethod = 'WALLET'
      newOrder.paymentStatus = 'Paid'
      newOrder.razorpayPaymentId = wallet.txnId
    } else {
      newOrder.paymentMethod = 'RAZORPAY'
      newOrder.paymentStatus = 'Paid'
      newOrder.razorpayPaymentId = paymentId
    }
    await newOrder.save()
    await Cart.findOneAndDelete({ userId: user.id })
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
  res.render('User/order/paymentFailedPage.ejs', {
    addressId
  })
}
