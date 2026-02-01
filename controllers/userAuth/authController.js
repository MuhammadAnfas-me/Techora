import express from 'express'
import bcrypt from 'bcrypt'
import { User } from '../../models/userModel.js'
import { verifyOtp } from '../../services/authService/emailVerify.js'
import { sendOtp } from '../../utils/sendOtpMail.js'
import session from 'express-session'
const SALT_ROUND = 10

const getErrorMessage = msg => {
  switch (msg) {
    case 'OTP_NOT_FOUND':
      return 'OTP not found. Please resend OTP.'

    case 'OTP_EXPIRED':
      return 'OTP expired. Please resend OTP.'

    case 'OTP_INVALID':
      return 'Invalid OTP. Try again.'

    case 'USER_NOT_EXISTS':
      return 'Invalid Credential'

    case 'PASSWORD_NOT_MATCH':
      return 'Password does not match'

    default:
      return 'Something went wrong'
  }
}

//landing page
const landing = (req,res)=>{
  res.render("User/landingPage")
}

//Login Section
const loginLoad = (req, res) => {
  res.render('User/login', { message: null })
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) {
      throw new Error('USER_NOT_EXISTS')
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      throw new Error('PASSWORD_NOT_MATCH')
    }
    if (!user.isVerified) {
       sendOtp({
        model: User,
        email,
        purpose: 'Email_Verification',
        expiryTime: 1
      })
      return res.status(403).json({
        success : false,
        message : "Verify your Email address",
        redirect : "/otp-verify",
        email
      })
    }
    res.status(200).json({
      success: true,
      message: 'Logined Succesfully'
    })
  } catch (er) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(er.message)
    })
  }
}

//-------------------------------Sign up----------------------------------------------
const signupLoad = (req, res) => {
  res.render('User/signup.ejs', { error: null })
}
const signUp = async (req, res) => {
  try {
    const { name, email, password } = req.body

    const user = await User.findOne({ email })
    const hashedPassword = await bcrypt.hash(password, SALT_ROUND)
    if (user) {
      if(user.isVerified){
        return res.render('User/signup', { error: 'User already exists' })
      }
    }
    if(!user){
      const newUser = new User({
        fullName: name,
        email,
        password: hashedPassword,
        isVerified: false
      })
      await newUser.save()
    }

    sendOtp({
      model: User,
      email,
      purpose: 'Email_Verification',
      expiryTime: 1
    })
    res.render('User/otpPage',{ email , purpose : "EMAIL_VERIFICATION"})
  } catch (er) {
    console.log(`Error from Signup, ${er}`)
    res.render('User/signup', { error: 'Something Wrong' })
  }
}

//---------------------Otp Page------------------------------

const otpLoad = (req, res) => {
  res.render('User/otpPage', { email: null , purpose : null})
}

const otpVerify = async (req, res) => {
  try {
    const {otp , email ,purpose} = req.body
    if(!otp || !email || !purpose){
      res.status(400).json({
        success : false,
        message : "Missing external fields"
      })
    }
    await verifyOtp({ model: User, email, enteredOtp: otp })
    if(purpose == "EMAIL_VERIFICATION"){
    await User.updateOne({ email }, { $set: { isVerified: true } })
  }
    res.status(200).json({
      success: true,
      message: purpose == "EMAIL_VERIFICATION" ? "Email verified" : "OTP verified"
    })
  } catch (er) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(er.message)
    })
  }
}

const resendOtp = async (req,res)=>{
  try {
    const {email,purpose} = req.body
    if(!email){
      return res.status(400).json({
        success : false,
        message : "Email is required"
      })
    }

    const user = await User.findOne({email})
    if(!user){
      return res.status(400).json({
        success : false,
        message : "User not found"
      })
    }
    if(purpose == "EMAIL_VERIFICATION"){
    if(user.isVerified){
      return res.status(400).json({
        success : false,
        message : "Email is already verified"
      })
    }
  }
    sendOtp({model : User , email , purpose , expiryTime : 1})
    res.status(200).json({
      success : true,
      message : "OTP resent successfully"
    })
  } catch (error) {
    console.log("Resend OTP error:",error)
    return res.status(500).json({
      success : false,
      message : "server error"
    })
  }
}

// ------------------------------- Forgot Password--------------------------------//

const forgotLoad = (req,res)=>{
  res.render("User/forgotPassword",{error : null})
}

const forgotPassword = async(req,res)=>{
  
  const { email }= req.body
  const user = await User.findOne({email})

  if(!user) {
    res.render("User/forgotPassword",{error : "Invalid Email"})
  }
  sendOtp({model : User , email , purpose : "Password_Reset" , expiryTime : 1})
  res.render("User/otpPage",{email : email , purpose : "RESET_PASSWORD"})
  
}

const homeLoad = (req,res)=>{
  res.render("User/home")
}

export { landing , homeLoad ,  loginLoad, login, signupLoad, signUp, otpLoad, otpVerify ,resendOtp , forgotLoad , forgotPassword}


