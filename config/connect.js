import mongoose from 'mongoose'

const connectDB = async () => {
  try {
    const dburl = process.env.DBURL
    const db = await mongoose.connect(dburl, {})
    console.log(`MongoDb connected to ${db.connection.host}`)
    try {
      await mongoose.connection.collection('users').dropIndex('otpExpiresAt_1')
      console.log('Successfully dropped old otpExpiresAt TTL index')
    } catch (e) {
      // Index doesn't exist, which is fine
    }
  } catch (er) {
    console.log('Error from DB connection :', er)
    process.exit(1)
  }
}

export default connectDB
