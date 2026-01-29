import mongoose from  "mongoose"

const dbUrl = process.env.DBURL
const connectDB = async ()=>{
    try{
        const db = await mongoose.connect("mongodb://localhost:27017/Techora",{})
        console.log(`MongoDb connected to ${db.connection.host}`)
    }catch(er){
        console.log("Error from DB connection :",er)
        process.exit(1)
    }
}

export default connectDB