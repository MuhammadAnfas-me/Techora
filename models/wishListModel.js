import mongoose, { Types } from "mongoose";

const wishlistSchema = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    items : {
        type : [{
            productId : {
                type : mongoose.Schema.Types.ObjectId,
                ref : "Product",
                required : true
            },
            variantId : {
                type : String,
                required : true
            }
    }]
    }
},{timestamps : true})

export const Wishlist = mongoose.model("Wishlist" , wishlistSchema)