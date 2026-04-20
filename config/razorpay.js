import  Razorpay from "razorpay"

export const razorpayInstance = new Razorpay({
    key_id : process.env.RAZOR_KEY,
    key_secret : process.env.RAZOR_SECRET
})

