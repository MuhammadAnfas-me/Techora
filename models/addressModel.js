import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        require : true
    },
    fullName : {
        type : String,
        require : true
    },
    phone : {
        type : String,
        require : true
    },
    zipCode :{
        type : String,
        require : true
    },
    state : {
        type : String,
        require : true
    },
    city : {
        type : String,
        require : true
    },
    country:{
        type : String,
        require :true
    },
    addressLine1 : {
        type : String,
        require : true
    },
    addressLine2 : {
        type : String
    },
    type : {
        type : String,
        enum : ["Home" , "Work" , "Other"],
        require : true
    },
    default :{
        type : Boolean,
        require : true
    }
},
{
    timestamps :true
})

addressSchema.index(
    {userId : 1, default : 1},
    {unique : true , partialFilterExpression : {default : true}}
)
const Address = mongoose.model("Address",addressSchema)
export default Address