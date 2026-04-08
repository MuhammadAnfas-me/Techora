import mongoose from 'mongoose'

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
          enum: ['Placed', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
          default: 'Placed'
        },
        cancelRequest: {
          status: {
            type: String,
            enum: ['None', 'Approved', 'Pending', 'Rejected'],
            default: 'None'
          },
          reason: String,
          comment: String,
          requestedAt : Date
        },
        returnRequest: {
          status: {
            type: String,
            enum: ['None', 'Pending', 'Approved', 'Rejected'],
            default: 'None'
          },
          reason: String,
          comment: String,
          requestedAt: Date
        }
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
      enum: ['COD', 'ONLINE'],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending'
    },
    orderStatus: {
      type: String,
      enum: [
        'Placed',
        'Confirmed',
        'Shipped',
        'Delivered',
        'Cancelled',
        'Return Request',
        'Return Approved',
        'Return Rejected'
      ],
      default: 'Placed'
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
        enum: ['Approved', 'Rejected', 'Pending']
      },
      reason: String,
      comment: String,
      requestedAt: Date
    },
    timeline: {
      confirmedAt: Date,
      shippedAt: Date,
      deliveredAt: Date
    }
  },
  { timestamps: true }
)

export const Order = mongoose.model('Order', orderSchema)
