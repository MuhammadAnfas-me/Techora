import bcrypt from "bcrypt"

export const generateOtp = ()=>{
    return Math.floor(100000 + Math.random()*900000).toString()
}


export const verifyOtp = async ({model , email , enteredOtp})=>{
    const user = await model.findOne({email});

    if(!user || !user.otp){
        throw new Error("OTP_NOT_FOUND")
    }

    if(user.otpExpiresAt < new Date()){
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