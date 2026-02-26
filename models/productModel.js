import mongoose, { Schema } from "mongoose";

const specificationSchema = new mongoose.Schema({
    label : {type : String , trim : true, required : true},
    value : {type : String , trim : true, required : true}
},
{_id : false}
);

const varientsSchema = new mongoose.Schema({
    varientId : {
        type : String,
        default : ()=> new mongoose.Types.ObjectId().toString(),
    },
    attributes : {
        color : {type : String , trim : true, defaul,t :""},
        storage : {type : String , trim : "" , default : ""}
    }, 
    price : {type : String , required : true,min : 0},
    stock : {type : String , required : true , min : 0, default : 0},
    image : {type : [String] , default : []},
    status : {type : String , enum : ["Active" , "Inactive"], default : "Active"}
},
{_id : false});

const productSchema = new mongoose.Schema({
    name :{
        type : String,
        require : true
    },
    categoryId :{
        type : Schema.Types.ObjectId,
        ref : "Categories",
        required : true
    },
    brand : {
        type : String,
        require : true
    },
    status : {
        type : Boolean,
        default : true
    },
    shortDescription : {
        type : String,
    },
    fullDescription : {
        type : String,
    },
    productImage : {
        type : String
    },
    specification : {type : [specificationSchema] , default : []}
})

const Product = mongoose.model("Product",productSchema)
export default Product