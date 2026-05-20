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
        sku : {type : String , required : true},
        color : {type : String , required : true},
        colorCode : {type : String , required : true},
        price : {type : Number , required : true,min : 0},
        stock : {type : Number , required : true , min : 0, default : 0},
        image : {type : [String] , default : []}
    },
    {_id : false});

    const productSchema = new mongoose.Schema({
        name :{
            type : String,
            require : true
        },
        categoryId :{
            type : mongoose.Schema.Types.ObjectId,
            ref : "Categories",
            required : true
        },
        brand : {
            type : String,
            required : true
        },
        status : {
            type : String,
            default : true
        },
        shortDescription : {
            type : String,
        },
        fullDescription : {
            type : String
        },
        specifications : {type : [specificationSchema] , default : []},
        variants : {
            type : [varientsSchema] ,
            default : []
        }
    },{timestamps : true}
    )

    const Product = mongoose.model("Product",productSchema)
    export default Product