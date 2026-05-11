import mongoose from 'mongoose'


const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId : {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  tittle : {
    type : String,
    required : true
  },
  description : {
    type : String,
    required : true
  },
  rating : {
    type : Number,
    default : 0,
  }
},{timestamps : true})


export const Review = mongoose.model('Review',reviewSchema)