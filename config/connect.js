import mongoose from  "mongoose"



const connectDB = async ()=>{
    try{
        const dburl = process.env.DBURL
        const db = await mongoose.connect(dburl,{})
        console.log(`MongoDb connected to ${db.connection.host}`)
    }catch(er){
        console.log("Error from DB connection :",er)
        process.exit(1)
    }
}

export default connectDB