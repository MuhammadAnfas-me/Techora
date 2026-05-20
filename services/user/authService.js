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
import { Categories } from '../../models/categoryModel.js'

const SALT_ROUND = 10

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function getDiscountAmount (offer, price) {
  if (offer.type === 'flat') {
    return offer.value
  }
  return (price * offer.value) / 100
}

export const getErrorMessage = msg => {
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

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────


export async function validateLogin (email, password) {
  const user = await User.findOne({ email, role: 'Customer' })

  if (!user || !user.password) {
    throw new Error('USER_NOT_EXISTS')
  }

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    throw new Error('PASSWORD_NOT_MATCH')
  }

  return user
}

// ─────────────────────────────────────────────
// Sign Up
// ─────────────────────────────────────────────


export async function resolveReferral (code) {
  if (!code) return null

  const referredUser = await User.findOne({ referralCode: code })
  if (!referredUser) {
    throw new Error('INVALID_REFERRAL')
  }

  return referredUser
}


export async function assertEmailNotTaken (email) {
  const user = await User.findOne({ email })
  if (user && user.isVerified) {
    throw new Error('USER_EXISTS')
  }
}


export async function createUserWithWallet (
  { name, email, password },
  referredUser = null
) {
  // Delete any existing unverified user with the same email to prevent unique index conflicts and orphaned wallets
  const existingUnverifiedUser = await User.findOne({ email, isVerified: false })
  if (existingUnverifiedUser) {
    await Wallet.deleteOne({ userId: existingUnverifiedUser._id })
    await User.deleteOne({ _id: existingUnverifiedUser._id })
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUND)
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
    referralCode,
    signupExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
  })

  await newUser.save()

  // Build wallet for the new user
  const newWallet = new Wallet({
    userId: newUser._id,
    balance: 0,
    transaction: []
  })

  if (referredUser) {
    newWallet.balance = 50
    newWallet.transaction.push({
      txnId: generateTxnId(),
      type: 'credit',
      description: 'Referral reward',
      amount: 50,
      date: new Date()
    })

    // Referrer bonus
    let referrerWallet = await Wallet.findOne({ userId: referredUser._id })

    if (!referrerWallet) {
      referrerWallet = new Wallet({
        userId: referredUser._id,
        balance: 0,
        transaction: []
      })
    }

    referrerWallet.balance += 100
    referrerWallet.transaction.push({
      txnId: generateTxnId(),
      type: 'credit',
      description: `Referral reward by ${name}`,
      amount: 100,
      date: new Date()
    })

    referredUser.totalReference += 1

    await referrerWallet.save()
    await referredUser.save()
  }

  await newWallet.save()

  return newUser
}

// ─────────────────────────────────────────────
// OTP
// ─────────────────────────────────────────────


export async function dispatchOtp (email, purpose = 'EMAIL_VERIFICATION') {
  const user = await User.findOne({ email })

  if (!user) throw new Error('USER_NOT_EXISTS')

  if (purpose === 'EMAIL_VERIFICATION' && user.isVerified) {
    throw new Error('ALREADY_VERIFIED')
  }

  await sendOtp({
    model: User,
    email,
    expiryTime: 1,
    name: user.fullName
  })
}


export async function processOtpVerification (email, otp, purpose) {
  await verifyOtp({ model: User, email, enteredOtp: otp })

  if (purpose === 'EMAIL_VERIFICATION') {
    await User.updateOne({ email }, { $set: { isVerified: true }, $unset: { otpExpiresAt: 1, otp: 1, signupExpiresAt: 1 } })
    return { verified: true }
  }

  // RESET_PASSWORD path
  const rawToken = crypto.randomBytes(32).toString('hex')
  const user = await User.findOne({ email })
  user.resetToken = rawToken
  user.resetTokenExpiry = Date.now() + 10 * 60 * 1000
  await user.save()

  return { resetToken: rawToken }
}

// ─────────────────────────────────────────────
// Forgot / Reset Password
// ─────────────────────────────────────────────

export async function getUserByEmail (email) {
  const user = await User.findOne({ email })
  if (!user) throw new Error('USER_NOT_EXISTS')
  return user
}


export async function performPasswordReset (resetToken, newPassword) {
  const user = await User.findOne({
    resetToken,
    resetTokenExpiry: { $gt: Date.now() }
  })

  if (!user) throw new Error('TOKEN_EXPIRED')

  user.password = await bcrypt.hash(newPassword, SALT_ROUND)
  user.resetToken = undefined
  user.resetTokenExpiry = undefined

  await user.save()
}

// ─────────────────────────────────────────────
// Home / Products
// ─────────────────────────────────────────────


export async function getHomeProducts () {
  // 1. Get active categories
  const activeCategories = await Categories.find({ isActive: true }).select('_id');
  const activeCategoryIds = activeCategories.map(cat => cat._id);

  // 2. Fetch products belonging to these categories
  const products = await Product.find({
    status: 'active',
    categoryId: { $in: activeCategoryIds },
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

    for (const offer of offers) {
      if (!offer.isActive) continue

      const isProductOffer =
        offer.scope === 'product' &&
        offer.product?.toString() === product._id.toString()

      const isCategoryOffer =
        offer.scope === 'category' &&
        offer.category?.toString() ===
          (product.categoryId?._id || product.categoryId)?.toString()

      if (isProductOffer || isCategoryOffer) {
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

    variant.originalPrice = variant.price
    variant.offerPrice = Math.max(1, Math.round(variant.price - discountAmount))
    product.offer = bestOffer
  })

  return products
}