import { sendOtp } from '../../utils/sendOtpMail.js'
import { User } from '../../models/userModel.js'
import { getWishlistIds } from '../../services/user/productService.js'
import {
  getErrorMessage,
  validateLogin,
  resolveReferral,
  assertEmailNotTaken,
  createUserWithWallet,
  dispatchOtp,
  processOtpVerification,
  getUserByEmail,
  performPasswordReset,
  getHomeProducts
} from '../../services/user/authService.js'     // ← adjust path to match your project

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────

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

    const user = await validateLogin(email, password)

    if (user.isBlocked) {
      return res
        .status(400)
        .json({ success: false, message: 'You have been blocked by admin' })
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

    res.status(200).json({ success: true, message: 'Logined Succesfully' })
  } catch (er) {
    res.status(400).json({ success: false, message: getErrorMessage(er.message) })
  }
}

// ─────────────────────────────────────────────
// Sign Up
// ─────────────────────────────────────────────

const signupLoad = (req, res) => {
  const code = req.query.code
  if (code) req.session.referralCode = code
  res.render('User/signup.ejs', { error: null, code: code || null })
}

const signUp = async (req, res) => {
  const code = req.query.code || req.body.codee

  try {
    const { name, email, password } = req.body
    const referredUser = await resolveReferral(code)

    await assertEmailNotTaken(email)
    await createUserWithWallet({ name, email, password }, referredUser)

    sendOtp({ model: User, email, expiryTime: 1, name })

    res.render('User/otpPage', { email, purpose: 'EMAIL_VERIFICATION' })
  } catch (er) {
    if (er.message === 'INVALID_REFERRAL') {
      return res.render('User/signup', { error: 'Invalid referral code', code: null })
    }
    if (er.message === 'USER_EXISTS') {
      return res.render('User/signup', { error: 'User already exists', code: code || null })
    }

    console.log(`Error from Signup: ${er}`)
    res.render('User/signup', { error: 'Something went wrong', code: null })
  }
}

// ─────────────────────────────────────────────
// OTP
// ─────────────────────────────────────────────

const otpLoad = (req, res) => {
  res.render('User/otpPage', { email: null, purpose: null })
}

const otpVerify = async (req, res) => {
  try {
    const { otp, email, purpose } = req.body

    if (!otp || !email || !purpose) {
      return res.status(400).json({ success: false, message: 'Missing external fields' })
    }

    const result = await processOtpVerification(email, otp, purpose)

    if (result.resetToken) {
      return res.json({
        success: true,
        resetToken: result.resetToken,
        redirect: '/reset-password'
      })
    }

    res.status(200).json({
      success: true,
      message:
        purpose === 'EMAIL_VERIFICATION'
          ? 'Account created successfully'
          : 'OTP verified'
    })
  } catch (er) {
    res.status(400).json({ success: false, message: getErrorMessage(er.message) })
  }
}

const resendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' })
    }

    await dispatchOtp(email, purpose)

    res.status(200).json({ success: true, message: 'OTP resent successfully' })
  } catch (er) {
    if (er.message === 'USER_NOT_EXISTS') {
      return res.status(400).json({ success: false, message: 'User not found' })
    }
    if (er.message === 'ALREADY_VERIFIED') {
      return res.status(400).json({ success: false, message: 'Email is already verified' })
    }

    console.log('Resend OTP error:', er)
    res.status(500).json({ success: false, message: 'server error' })
  }
}

// ─────────────────────────────────────────────
// Forgot / Reset Password
// ─────────────────────────────────────────────

const forgotLoad = (req, res) => {
  res.render('User/forgotPassword', { error: null })
}

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await getUserByEmail(email)          

    sendOtp({ model: User, email, expiryTime: 1, name: user?.fullName })
    res.render('User/otpPage', { email, purpose: 'RESET_PASSWORD' })
  } catch (er) {
    res.render('User/forgotPassword', { error: 'Invalid Email' })
  }
}

const passwordReset = (req, res) => {
  res.render('User/resetPassword')
}

const resetPassword = async (req, res) => {
  try {
    const { password, resetToken } = req.body

    if (!password || !resetToken) {
      return res.status(400).json({ success: false, message: 'Invalid request' })
    }

    await performPasswordReset(resetToken, password)

    res.json({ success: true, message: 'Password updated succesfully' })
  } catch (er) {
    if (er.message === 'TOKEN_EXPIRED') {
      return res.status(400).json({ success: false, message: 'Your time expired' })
    }

    console.error('Reset password error:', er)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

const resetConfirmation = (req, res) => {
  res.render('User/resetSuccess')
}

// ─────────────────────────────────────────────
// Home
// ─────────────────────────────────────────────

const homeLoad = async (req, res) => {
  try {
    const products = await getHomeProducts()
    const userId = req.session?.user?.id || null
    const wishListIds = await getWishlistIds(userId)
    res.render('User/home', { products, wishListIds })
  } catch (error) {
    console.log('Error from Home page :', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────

const logout = (req, res) => {
  req.session.user = null
  req.user = null
  res.redirect('/login')
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