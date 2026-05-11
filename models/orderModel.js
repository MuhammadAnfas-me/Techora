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
            enum: ['Placed', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled' , "Returned", "Return Requested","Return Rejected","Return Approved"],
            default: 'Placed'
          },
          cancellation: {
            reason: String,
            comment: String,
            cancelledAt : Date
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
          },
          refunds : {
            type : String,
            enum : ["not refunded","refunded"]
          },
          discount : Number,
          finalTotal : Number
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
        enum: ['COD', 'RAZORPAY',"WALLET"],
        required: true
      },
      paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed',"Refunded"],
        default: 'Pending'
      },
      coupon :{
        couponId : {
          type : mongoose.Schema.Types.ObjectId,
          ref : "Coupon"
        },
        code : String,
        discountType : String,
        discountValue : Number,
        discount : Number
      },
      razorpayPaymentId :{
        type : String,
        default : ""
      },
      orderStatus: {
        type: String,
        enum: [
          'Placed',
          'Confirmed',
          'Shipped',
          'Delivered',
          'Cancelled',
          'Returned' ,
          'Return Requested',
          'Return Approved',
          'Return Rejected'
        ],
        default: 'Placed'
      },
      subtotal : {
        type : Number,
        required : true
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
        confirmedAt: {type : Date},
        shippedAt: {type : Date},
        deliveredAt: {type : Date},
        cancelledAt : {type : Date},
        returnedAt : {type : Date}
      }
    },
    { timestamps: true }
  )

export const Order = mongoose.model('Order', orderSchema)
