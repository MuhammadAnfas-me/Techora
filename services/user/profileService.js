import { User } from '../../models/userModel.js'
import Address from '../../models/addressModel.js'
import bcrypt from 'bcrypt'
import formatDateForInput from '../../services/dateFormat.js'
import sendOtpMail from '../../utils/sendOtpMail.js'
import { generateOtp } from '../../services/authService/emailVerify.js'
import cloudinary from '../../config/cloudinary.js'
import { sendContactMail } from '../../utils/contactMail.js'

const SALT_ROUND = 10

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────


export async function getProfileData (reqUser, sessionEmail) {
  if (reqUser) {
    const address = await Address.findOne({
      userId: reqUser.userId,
      default: true
    })
    return { user: reqUser, address }
  }

  const user = await User.findOne({ email: sessionEmail })
  let address = await Address.findOne({ userId: user.userId, default: true })
  if (!address) {
    address = await Address.findOne({ userId: user.userId })
  }

  return { user, address }
}


export async function getEditProfileData (reqUser, sessionEmail) {
  if (reqUser) {
    return { user: reqUser, dobValue: formatDateForInput(reqUser.dob) }
  }

  const user = await User.findOne({ email: sessionEmail })
  return { user, dobValue: formatDateForInput(user.dob) }
}

export async function updateUserProfile (email, fields) {
  const { fullName, number, dob, gender, country } = fields

  const updateFields = {}
  if (fullName) updateFields.fullName = fullName
  if (number)   updateFields.number = number
  if (dob)      updateFields.dob = dob
  if (gender)   updateFields.gender = gender
  if (country)  updateFields.country = country

  if (Object.keys(updateFields).length === 0) {
    throw Object.assign(new Error('Nothing to update'), { status: 400 })
  }

  await User.findOneAndUpdate(
    { email },
    { $set: updateFields },
    { new: true, runValidators: true }
  )
}

// ─────────────────────────────────────────────
// Password
// ─────────────────────────────────────────────


export async function changeUserPassword (email, currentPassword, newPassword) {
  const user = await User.findOne({ email })

  const isMatch = await bcrypt.compare(currentPassword, user.password)
  if (!isMatch) {
    throw Object.assign(new Error('Incorrect password'), { status: 400 })
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUND)
  await user.save()
}

// ─────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────


export async function getUserAddresses (userId) {
  return Address.find({ userId })
}


export async function createAddress (userId, fields) {
  const {
    fullName, phone, addressLine1, addressLine2,
    city, state, zipCode, country, type,
    default: isDefault
  } = fields

  if (!fullName || !phone || !addressLine1 || !city || !state || !zipCode || !country || !type) {
    throw Object.assign(new Error('Please fill all required fields'), { status: 400 })
  }

  const count = await Address.countDocuments({ userId })
  const makeDefault = count === 0 ? true : Boolean(isDefault)

  if (makeDefault) {
    await Address.updateMany({ userId }, { $set: { default: false } })
  }

  return Address.create({
    userId,
    fullName:     fullName.trim(),
    phone:        phone.trim(),
    addressLine1: addressLine1.trim(),
    addressLine2: addressLine2?.trim() || '',
    city:         city.trim(),
    state:        state.trim(),
    zipCode:      zipCode.trim(),
    country:      country.trim(),
    type,
    default:      makeDefault
  })
}


export async function getAddressById (id) {
  return Address.findOne({ _id: id })
}


export async function updateAddress (userId, addressId, fields) {
  const {
    fullName, phone, addressLine1, addressLine2,
    city, state, zipCode, country, type,
    default: isDefault
  } = fields

  const updateFields = {}
  if (fullName     !== undefined) updateFields.fullName     = fullName.trim()
  if (phone        !== undefined) updateFields.phone        = phone.trim()
  if (zipCode      !== undefined) updateFields.zipCode      = zipCode.trim()
  if (state        !== undefined) updateFields.state        = state.trim()
  if (city         !== undefined) updateFields.city         = city.trim()
  if (addressLine1 !== undefined) updateFields.addressLine1 = addressLine1.trim()
  if (addressLine2 !== undefined) updateFields.addressLine2 = addressLine2.trim()
  if (country      !== undefined) updateFields.country      = country
  if (type         !== undefined) updateFields.type         = type
  if (isDefault    !== undefined) updateFields.default      = Boolean(isDefault)

  if (Object.keys(updateFields).length === 0) {
    throw Object.assign(new Error('Nothing to update'), { status: 400 })
  }

  if (updateFields.default === true) {
    await Address.updateMany(
      { userId, _id: { $ne: addressId } },
      { $set: { default: false } }
    )
  }

  const updated = await Address.findOneAndUpdate(
    { userId, _id: addressId },
    { $set: updateFields },
    { new: true, runValidators: true }
  )

  if (!updated) {
    throw Object.assign(new Error('Address not found'), { status: 404 })
  }

  return updated
}


export async function deleteUserAddress (addressId) {
  await Address.deleteOne({ _id: addressId })
}

// ─────────────────────────────────────────────
// Profile Image
// ─────────────────────────────────────────────


export async function replaceProfileImage (userId, imageUrl) {
  if (!userId) {
    throw Object.assign(new Error('Unauthorized'), { status: 400 })
  }

  const user = await User.findOne({ userId })

  if (user?.profileImage) {
    await cloudinary.uploader.destroy(user.profileImage)
  }

  user.profileImage = imageUrl
  await user.save()

  return imageUrl
}


export async function resetProfileImage (userId) {
  const user = await User.findOne({ userId })

  if (user.profileImage?.publicId) {
    await cloudinary.uploader.destroy(user.profileImage.publicId)
  }

  user.profileImage = process.env.DEFAULT_IMAGE
  await user.save()
}

// ─────────────────────────────────────────────
// Email Change
// ─────────────────────────────────────────────

export async function initiateEmailChange (newEmail, userName) {
  const exists = await User.findOne({ email: newEmail })
  if (exists) {
    throw Object.assign(new Error('Email already used'), { status: 409 })
  }

  const otp = generateOtp()
  await sendOtpMail(newEmail, otp, userName)

  return {
    email: newEmail,
    otp,
    otpExpiresAt: Date.now() + 60 * 1000
  }
}


export async function verifyEmailChange (userId, newEmail, otp, sessionData) {
  const user = await User.findOne({ userId })
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 400 })
  }

  if (!sessionData) {
    throw Object.assign(new Error('OTP not requested'), { status: 400 })
  }

  if (sessionData.otpExpiresAt < Date.now()) {
    throw Object.assign(new Error('OTP expired'), { status: 400 })
  }

  if (sessionData.otp != otp) {
    throw Object.assign(new Error('Invalid OTP'), { status: 400 })
  }

  user.email = newEmail
  await user.save()

  return newEmail
}

// ─────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────


export async function sendContactMessage ({ name, email, phone, subject, message }) {
  const cleanName = name?.trim()

  if (!cleanName || cleanName.length < 3) {
    throw Object.assign(new Error('Name must be at least 3 characters'), { status: 400 })
  }

  const nameRegex = /^[A-Za-z\s]+$/
  if (!nameRegex.test(cleanName)) {
    throw Object.assign(new Error('Name should contain only letters'), { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    throw Object.assign(new Error('Invalid email address'), { status: 400 })
  }

  const phoneRegex = /^[0-9+\-\s()]{7,15}$/
  if (phone && !phoneRegex.test(phone)) {
    throw Object.assign(new Error('Invalid phone number'), { status: 400 })
  }

  if (!subject) {
    throw Object.assign(new Error('Please select a subject'), { status: 400 })
  }

  if (!message || message.trim().length < 10) {
    throw Object.assign(new Error('Message must be at least 10 characters'), { status: 400 })
  }

  await sendContactMail({ name, email, phone, subject, message })
}