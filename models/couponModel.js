import mongoose, { mongo } from "mongoose";


const couponSchema = new mongoose.Schema({
    couponCode : {
        type : String,
        unique : true,
        required : true
    },
    discountType : {
        type : String,
        enum : ["Percentage","Flat"],
        required : true
    },
    discountValue : {
        type : Number,
        required : true
    },
    minOrderValue : {
        type : Number,
        required : true
    },
    usageLimit : {
        type : Number,
        default : null
    },
    limit : {
        type : String,
        required : true
    },
    startDate : {
        type : Date,
        required : true
    },
    expiryDate : {
        type : Date,
        required : true
    },
    isActive : {
        type : Boolean,
        required : true
    },
    internalNotes : {
        type : String
    },
    usedCount : {
        type : Number,
        default : 0
    },
    isDeleted : {
        type : Boolean,
        default : false
    },
    usedBy : [
        {
            userId : mongoose.Schema.Types.ObjectId,
            count : {
                type : Number,
                default : 0
            }
        }
    ]
},{timestamps : true})

export const Coupon = mongoose.model("Coupon",couponSchema)