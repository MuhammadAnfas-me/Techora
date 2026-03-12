import mongoose, { Schema } from "mongoose"

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  variantId: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  total :{
    type : Number,
    required : true
  }
}, { _id: false });

const cartSchema = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        require : true
    },
    items : {
        type : [cartItemSchema],
        default : []
    }
},{timestamps :true})

export const Cart = mongoose.model("Cart",cartSchema)