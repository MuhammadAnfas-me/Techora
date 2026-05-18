import mongoose from 'mongoose'
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_STATUS,
  RETURN_STATUS
} from '../constants/orderConstants.js'

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        name: String,
        brand: String,
        variantId: String,
        color: String,
        quantity: Number,
        price: Number,
        total: Number,
        image: String,
        status: {
          type: String,
          enum: Object.values(ORDER_STATUS),
          default: ORDER_STATUS.PLACED
        },
        cancellation: {
          reason: String,
          comment: String,
          cancelledAt: Date
        },
        returnRequest: {
          status: {
            type: String,
            enum: Object.values(RETURN_STATUS),
            default: RETURN_STATUS.NONE
          },
          reason: String,
          comment: String,
          requestedAt: Date
        },
        refunds: {
          type: String,
          enum: Object.values(REFUND_STATUS),
          default: REFUND_STATUS.NONE
        },
        discount: Number,
        finalTotal: Number
      }
    ],
    address: {
      name: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      zipCode: String
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      required: true
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING
    },
    coupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
      },
      code: String,
      discountType: String,
      discountValue: Number,
      discount: Number
    },
    razorpayPaymentId: {
      type: String,
      default: ''
    },
    orderStatus: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PLACED
    },
    subtotal: {
      type: Number,
      required: true
    },
    totalAmount: {
      type: Number,
      required: true
    },
    orderId: {
      type: String,
      unique: true,
      required: true
    },
    returnRequest: {
      status: {
        type: String,
        enum: [RETURN_STATUS.APPROVED, RETURN_STATUS.REJECTED, RETURN_STATUS.PENDING]
      },
      reason: String,
      comment: String,
      requestedAt: Date
    },
    timeline: {
      confirmedAt: { type: Date },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
      cancelledAt: { type: Date },
      returnedAt: { type: Date }
    }
  },
  { timestamps: true }
)

export const Order = mongoose.model('Order', orderSchema)
