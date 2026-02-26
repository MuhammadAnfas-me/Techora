import mongoose, { Schema } from "mongoose"

const categorySchema = new mongoose.Schema({
    name : {
        type : String,
        require : true
    },
    type : {
        type : String,
        require : true
    },
    status : {
        type : String,
        require : true
    },
    description : {
        type : String,
        require : true
    },
    isActive : {
        type : Boolean,
        default : true
    }
},{timestamps :true})

export const Categories = mongoose.model("Categories",categorySchema)