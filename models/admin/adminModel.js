import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    name:{
        type:String,
        require : true
    },
    email : {
        type : String,
        unique : true,
        require : true
    },password : {
        type:String,
        require : true
    }
},{timestamps:true})

const Admin = new mongoose.model("Admin",adminSchema)
export default Admin