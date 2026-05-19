import bcrypt from "bcrypt"
import { Wallet } from "../../models/walletModel.js"

export const generateOtp = ()=>{
    return Math.floor(100000 + Math.random()*900000).toString()
}


export const verifyOtp = async ({model , email , enteredOtp})=>{
    const user = await model.findOne({email});

    if(!user || !user.otp){
        throw new Error("OTP_NOT_FOUND")
    }

    if(user.otpExpiresAt < new Date()){
        if (!user.isVerified) {
            await Wallet.deleteOne({ userId: user._id })
            await model.deleteOne({ _id: user._id })
        }
        throw new Error("OTP_EXPIRED")
    }

    
    const isValid = await bcrypt.compare(enteredOtp , user.otp)
    
    if(!isValid) { 
        throw new Error("OTP_INVALID")
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined

    await user.save();
    return true
}