import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  type: {
    type: String,
    enum: ["flat", "percentage"],
    default: "percentage"
  },

  value: {
    type: Number,
    required: true
  },
  
  maxDiscount: {
    type: Number,
    default: null
  },

  scope: {
    type: String,
    enum: [ "product", "category"],
    default: ""
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Categories",
    default: null
  },

  start: {
    type: Date,
    required: true
  },

  end: {
    type: Date,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  isDeleted: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

export const Offers = mongoose.model("Offers",offerSchema)