import express from 'express'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { User } from '../../models/userModel.js'
import { verifyOtp } from '../../services/authService/emailVerify.js'
import { sendOtp } from '../../utils/sendOtpMail.js'
import { Wallet } from '../../models/walletModel.js'
import { Offers } from '../../models/offerModel.js'
import Product from '../../models/productModel.js'
import generateUserId from '../../utils/generateUserId.js'
import generateReferralCode from '../../utils/referral.js'
import { generateTxnId } from '../../utils/generateTxnId.js'

const SALT_ROUND = 10

function getDiscountAmount (offer, price) {
  if (offer.type === 'flat') {
    return offer.value
  }
  return (price * offer.value) / 100
}

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

//Login Section
const loginLoad = (req, res) => {
  const errorMessage = req.session?.errorMessage
  delete req.session.errorMessage
  res.render('User/login', {
    message: errorMessage || null,
    blocked: req.query.blocked || false
  })
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email, role: 'Customer' })
    if (!user || !user.password) {
      throw new Error('USER_NOT_EXISTS')
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      throw new Error('PASSWORD_NOT_MATCH')
    }
    if (user.isBlocked) {
      return res
        .status(400)
        .json({ success: false, message: 'You have been blocked' })
    }
    if (!user.isVerified) {
      await sendOtp({
        model: User,
        email,
        expiryTime: 1,
        name: user?.fullName
      })
      return res.status(403).json({
        success: false,
        message: 'Verify your Email address',
        redirect: '/otp-verify',
        email
      })
    }
    req.session.user = {
      email: user.email,
      name: user.fullName,
      userId: user.userId,
      id: user._id
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
  const code = req.query.code

  if (code) {
    req.session.referralCode = code // ✅ store
  }

  res.render('User/signup.ejs', { error: null, code: code || null })
}
const signUp = async (req, res) => {
  try {
    const { name, email, password } = req.body

    // ✅ Get referral code (from query OR form)
    const code = req.query.code || req.body.codee

    let referredUser = null

    // ✅ Validate referral code
    if (code) {
      referredUser = await User.findOne({ referralCode: code })

      if (!referredUser) {
        return res.render('User/signup', {
          error: 'Invalid referral code',
          code: null
        })
      }
    }

    // ✅ Check existing user
    const user = await User.findOne({ email })

    if (user && user.isVerified) {
      return res.render('User/signup', {
        error: 'User already exists',
        code: code || null
      })
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUND)

    // ✅ Create new user
    const userId = generateUserId()
    const referralCode = generateReferralCode()

    const newUser = new User({
      userId,
      fullName: name,
      email,
      password: hashedPassword,
      profileImage: process.env.DEFAULT_IMAGE,
      isVerified: false,
      role: 'Customer',
      referralCode
    })

    await newUser.save()

    // ✅ Create wallet for new user
    let newWallet = new Wallet({
      userId: newUser._id,
      balance: 0,
      transaction: []
    })

    // 🎁 If referral exists → give rewards
    if (referredUser) {
      // New user reward
      newWallet.balance = 50
      newWallet.transaction.push({
        txnId: generateTxnId(),
        type: 'credit',
        description: 'Referral reward',
        amount: 50,
        date: new Date()
      })

      // Referrer wallet
      let wallet = await Wallet.findOne({ userId: referredUser._id })

      if (!wallet) {
        wallet = new Wallet({
          userId: referredUser._id,
          balance: 0,
          transaction: []
        })
      }

      wallet.balance += 100
      wallet.transaction.push({
        txnId: generateTxnId(),
        type: 'credit',
        description: `Referral reward by ${name}`,
        amount: 100,
        date: new Date()
      })

      referredUser.totalReference += 1

      await wallet.save()
      await referredUser.save()
    }

    // ✅ Save new user wallet
    await newWallet.save()

    // ✅ Send OTP
    sendOtp({
      model: User,
      email,
      expiryTime: 1,
      name
    })

    // ✅ Go to OTP page
    res.render('User/otpPage', {
      email,
      purpose: 'EMAIL_VERIFICATION'
    })
  } catch (er) {
    console.log(`Error from Signup: ${er}`)
    res.render('User/signup', {
      error: 'Something went wrong',
      code: null
    })
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
  try {
    let products = await Product.find({
      status: 'active',
      'variants.stock': { $gte: 0 }
    })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean()

    const now = new Date()
    const offers = await Offers.find({
      isActive: true,
      start: { $lte: now },
      end: { $gte: now }
    }).lean()

    products.forEach(product => {
      if (!product.variants || product.variants.length === 0) return

      const variant = product.variants[0]

      let bestOffer = null
      let maxDiscount = 0

      for (let offer of offers) {
        if (!offer.isActive) continue
        if (
          (offer.scope === 'product' &&
            offer.product?.toString() === product._id.toString()) ||
          (offer.scope === 'category' &&
            offer.category?.toString() ===
              (product.categoryId?._id || product.categoryId)?.toString())
        ) {
          const discount = getDiscountAmount(offer, variant.price)

          if (discount > maxDiscount) {
            maxDiscount = discount
            bestOffer = offer
          }
        }
      }

      let discountAmount = 0
      if (bestOffer) {
        discountAmount = getDiscountAmount(bestOffer, variant.price)
        discountAmount = Math.min(discountAmount, variant.price)
      }

      const finalPrice = variant.price - discountAmount
      variant.originalPrice = variant.price
      variant.offerPrice = Math.max(1, Math.round(finalPrice))
      product.offer = bestOffer
    })

    res.render('User/home', { products })
  } catch (error) {
    console.log('Error from Home page :', error)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
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
