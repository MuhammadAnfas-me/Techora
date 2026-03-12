import express from 'express'
import bcrypt from 'bcrypt'
import { User } from '../../models/userModel.js'
import { verifyOtp } from '../../services/authService/emailVerify.js'
import { sendOtp } from '../../utils/sendOtpMail.js'
import generateUserId from '../../utils/generateUserId.js'
import crypto from 'crypto'
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
const landing = (req, res) => {
  res.render('User/landingPage')
}

//Login Section
const loginLoad = (req, res) => {
  res.render('User/login', { message: null ,blocked : req.query.blocked || false})
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email,role : "Customer"})
    if (!user || !user.password) {
      throw new Error('USER_NOT_EXISTS')
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      throw new Error('PASSWORD_NOT_MATCH')
    }
    if(user.isBlocked){
      return res.status(400).json({success : false , message : "You have been blocked"})
    }
    if (!user.isVerified) {
     await sendOtp({
        model: User,
        email,
        expiryTime: 1,
        name : user?.fullName       
      })
      return res.status(403).json({
        success: false,
        message: 'Verify your Email address',
        redirect: '/otp-verify',
        email
      })
    }
    req.session.user = {email : user.email , name : user.fullName , userId : user.userId , id : user._id}
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
      if (user.isVerified) {
        return res.render('User/signup', { error: 'User already exists' })
      }
    }
    if (!user) {
      const userId = generateUserId()
      const newUser = new User({
        userId,
        fullName: name,
        email,
        password: hashedPassword,
        profileImage : {
          url : process.env.DEFAULT_IMAGE,
          publicId : ""
        },
        isVerified: false,
        role : "Customer"
      })
      await newUser.save()
    }

    sendOtp({
      model: User,
      email,
      expiryTime: 1,
      name
    })
    res.render('User/otpPage', { email, purpose: 'EMAIL_VERIFICATION' })
  } catch (er) {
    console.log(`Error from Signup, ${er}`)
    res.render('User/signup', { error: 'Something Wrong' })
  }
}

//---------------------Otp Page------------------------------

const otpLoad = (req, res) => {
  res.render('User/otpPage', { email: null, purpose: null })
}

const otpVerify = async (req, res) => {
  try {
    const { otp, email, purpose } = req.body
    if (!otp || !email || !purpose) {
      res.status(400).json({
        success: false,
        message: 'Missing external fields'
      })
    }
    await verifyOtp({ model: User, email, enteredOtp: otp })
    if (purpose == 'EMAIL_VERIFICATION') {
      await User.updateOne({ email }, { $set: { isVerified: true } })
    } else {
      const rawToken = await crypto.randomBytes(32).toString('hex')
      const user = await User.findOne({ email })
      user.resetToken = rawToken
      user.resetTokenExpiry = Date.now() + 10 * 60 * 1000
      await user.save()

      return res.json({
        success: true,
        resetToken: rawToken,
        redirect: '/reset-password'
      })
    }
    res.status(200).json({
      success: true,
      message:
        purpose == 'EMAIL_VERIFICATION'
          ? 'Account created successfully'
          : 'OTP verified'
    })
  } catch (er) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(er.message)
    })
  }
}

const resendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      })
    }
    if (purpose == 'EMAIL_VERIFICATION') {
      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        })
      }
    } else {
    }
    sendOtp({
      model: User,
      email,
      expiryTime: 1,
      name: user?.fullName
    })
    res.status(200).json({
      success: true,
      message: 'OTP resent successfully'
    })
  } catch (error) {
    console.log('Resend OTP error:', error)
    return res.status(500).json({
      success: false,
      message: 'server error'
    })
  }
}

// ------------------------------- Forgot Password--------------------------------//

const forgotLoad = (req, res) => {
  res.render('User/forgotPassword', { error: null })
}

const forgotPassword = async (req, res) => {
  const { email } = req.body
  const user = await User.findOne({ email })

  if (!user) {
    res.render('User/forgotPassword', { error: 'Invalid Email' })
  }
  sendOtp({
    model: User,
    email,
    expiryTime: 1,
    name: user?.fullName
  })
  res.render('User/otpPage', { email: email, purpose: 'RESET_PASSWORD' })
}

const homeLoad = async (req, res) => {
  res.render('User/home')
}

const logout = (req, res) => {
  req.session.user = null
  req.user = null
  req.session.destroy(() => {
    res.clearCookie('connecet.sid')
    res.redirect('/login')
  })
}

const passwordReset = (req, res) => {
  res.render('User/resetPassword')
}

const resetPassword = async (req, res) => {
  try {
    const { password, resetToken } = req.body

    if (!password || !resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      })
    }

    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    })

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: 'Your time expired' })

    user.password = await bcrypt.hash(password, SALT_ROUND)
    user.resetToken = undefined
    user.resetTokenExpiry = undefined

    await user.save()
    return res.json({ success: true, message: 'Password updated succesfully' })
  } catch (er) {
    console.error('Reset password error :', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

const resetConfirmation = (req, res) => {
  res.render('User/resetSuccess')
}

export {
  landing,
  homeLoad,
  loginLoad,
  login,
  signupLoad,
  signUp,
  otpLoad,
  otpVerify,
  resendOtp,
  forgotLoad,
  forgotPassword,
  passwordReset,
  resetPassword,
  resetConfirmation,
  logout
}
