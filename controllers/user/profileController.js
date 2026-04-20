import { User } from '../../models/userModel.js'
import Address from '../../models/addressModel.js'
import bcrypt from 'bcrypt'
import formatDateForInput from '../../services/dateFormat.js'
import sendOtpMail from '../../utils/sendOtpMail.js'
import { generateOtp } from '../../services/authService/emailVerify.js'
import cloudinary from '../../config/cloudinary.js'

const SALT_ROUND = 10
const profileLoad = async (req, res) => {
  if (req.user) {
    const address = await Address.findOne({
      userId: req.user.userId,
      default: true
    })
    return res.render('User/userProfile/profile.ejs', {
      user: req.user,
      address
    })
  }
  const email = req.session.user.email
  const user = await User.findOne({ email })
  let address = await Address.findOne({ userId: user.userId, default: true })
  if(!address){
    address = await Address.findOne({ userId: user.userId })
  }
  res.render('User/userProfile/profile.ejs', { user, address })
}

const editProfileLoad = async (req, res) => {
  if (req.user) {
    return res.render('User/userProfile/editPage.ejs', {
      user: req.user,
      dobValue: formatDateForInput(req.user.dob)
    })
  }
  const email = req.session.user.email
  const user = await User.findOne({ email })

  res.render('User/userProfile/editPage.ejs', {
    user,
    dobValue: formatDateForInput(user.dob)
  })
}

const editProfile = async (req, res) => {
  try {
    const email = req.session?.user?.email || req.user.email

    const { fullName, number, dob, gender, country } = req.body

    let updateFields = {}
    if (fullName) updateFields.fullName = fullName
    if (number) updateFields.number = number
    if (dob) updateFields.dob = dob
    if (gender) updateFields.gender = gender
    if (country) updateFields.country = country
    if (fullName) updateFields.fullName = fullName

    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Nothing to update' })
    }

    await User.findOneAndUpdate(
      { email },
      { $set: updateFields },
      { new: true, runValidators: true }
    )

    res.json({
      success: true,
      message: 'Profile updated successfully'
    })
  } catch (er) {
    console.error('error from profile patch:', er)
    res.status(500).json({ message: 'Server error' })
  }
}

const passwordeditLoad = (req, res) => {
  const user = req.session.user || req.user
  res.render('User/userProfile/changePass', {
    email: user.email,
    name: user.fullName
  })
}

const editPassword = async (req, res) => {
  try {
    const email = req.session?.user?.email || req.user?.email

    const { currentPassword, confirmPassword } = req.body

    const user = await User.findOne({ email })
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password'
      })
    }
    const hashedPassword = await bcrypt.hash(confirmPassword, SALT_ROUND)
    user.password = hashedPassword
    await user.save()
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (er) {
    console.error('Error from editPassword : ', er)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong'
    })
  }
}

const addressLoad = async (req, res) => {
  const user = req.session?.user || req.user
  const addresses = await Address.find({ userId: user.userId })
  res.render('User/userProfile/addressPage.ejs', {
    addresses,
    email: user.email,
    name: user.fullName
  })
}
const addAddress = async (req, res) => {
  try {
    const userId = req.session?.user?.userId || req.user.userId
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      type,
      default: isDefault
    } = req.body

    if (
      !fullName ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !zipCode ||
      !country ||
      !type
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Please fill all required fields' })
    }

    const count = await Address.countDocuments({ userId })
    const makeDefault = count === 0 ? true : Boolean(isDefault)

    if (makeDefault) {
      await Address.updateMany({ userId }, { $set: { default: false } })
    }

    const newAddress = await Address.create({
      userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2?.trim() || '',
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      country: country.trim(),
      type,
      default: makeDefault
    })
    return res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: newAddress
    })
  } catch (error) {
    console.error('Add address error:', error)
    if (error.name == 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message })
    }
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

const addressEditLoad = async (req, res) => {
  const id = req.params.id
  const address = await Address.findOne({ _id: id })

  return res.status(201).json({
    success: true,
    address
  })
}

const editAddress = async (req, res) => {
  try {
    const userId = req.session?.user?.userId || req.user.userId
    const addressId = req.params.id

    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country,
      type,
      default: isDefault
    } = req.body

    const updateFields = {}
    if (fullName !== undefined) updateFields.fullName = fullName.trim()
    if (phone !== undefined) updateFields.phone = phone.trim()
    if (zipCode !== undefined) updateFields.zipCode = zipCode.trim()
    if (state !== undefined) updateFields.state = state.trim()
    if (city !== undefined) updateFields.city = city.trim()
    if (addressLine1 !== undefined)
      updateFields.addressLine1 = addressLine1.trim()
    if (addressLine2 !== undefined)
      updateFields.addressLine2 = addressLine2.trim()
    if (country !== undefined) updateFields.country = country
    if (type !== undefined) updateFields.type = type
    if (isDefault !== undefined) updateFields.default = Boolean(isDefault)

    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Nothing to update' })
    }

    if (updateFields.default == true) {
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
      return res
        .status(404)
        .json({ success: false, message: 'Address not found' })
    }
    return res.json({
      success: true,
      message: 'Address updated successfully'
    })
  } catch (error) {
    console.error('update address error :', error)
    if (error.name == 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message })
    }
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}
const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id
    await Address.deleteOne({ _id: addressId })
    return res.json({ success: true, message: 'Address deleted successfully' })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

const updateProfileImage = async (req, res) => {
  try {
    const userId = req.session?.user?.userId || req.user.userId
    if (!req.file)
      return res
        .status(401)
        .json({ success: false, message: 'No file uploaded' })

    const imageUrl = req.file?.path

    if (!userId)
      return res.status(400).json({ success: false, message: 'Unauthorized' })

    const user = await User.findOne({ userId })
    if (user?.profileImage) {
      await cloudinary.uploader.destroy(user.profileImage)
    }
    user.profileImage = imageUrl
    await user.save()

    if (req.session.user) {
      req.session.user.profileImage = user.profileImage
    }
    res.json({ success: true, message: 'Profile image updated' })
  } catch (error) {
    console.error('error from updateProfileImage : ', error)
    res.status(500).json({ success: false, message: 'Image upload failed' })
  }
}

const removeProfileImage = async (req, res) => {
  try {
    const userId = req.session?.user?.userId || req.user.userId

    const user = await User.findOne({ userId })

    if (user.profileImage?.publicId) {
      await cloudinary.uploader.destroy(user.profileImage.publicId)
    }
    user.profileImage = {
      url: process.env.DEFAULT_IMAGE,
      publicId: ''
    }
    await user.save()
    return res
      .status(201)
      .json({ success: true, message: 'Image removed successfully' })
  } catch (error) {
    console.error('Error from Remove profile image : ', error)
    return res
      .status(500)
      .json({ success: true, message: 'Failed to remove profile image' })
  }
}

const emailChange = async (req, res) => {
  try {
    const email = req.body.email
    const exists = await User.findOne({ email })

    if (exists)
      return res
        .status(409)
        .json({ success: false, message: 'Email already used' })

    const otp = generateOtp()
    await sendOtpMail(email, otp, req.session.user?.name)
    const otpExpiresAt = Date.now() + 60 * 1000
    req.session.emailChange = { email, otp, otpExpiresAt }
    return res.json({ success: true, message: 'OTP sent to new email' })
  } catch (error) {
    console.error('Error from emailChange :', error)
    res.json({ success: false, message: 'Server error' })
  }
}

const emailVerify = async (req, res) => {
  try {
    const userId = req.session.user?.userId
    const { newEmail, otp } = req.body

    const user = await User.findOne({ userId })

    if (!user) return res.json({ success: true, message: 'User not found' })
    const data = req.session.emailChange

    if (!data)
      return res
        .status(400)
        .json({ success: true, message: 'OTP not requested' })
    if (data.otpExpiresAt < Date.now())
      return res.status(400).json({ success: false, message: 'OTP expired' })
    if (data.otp != otp)
      return res.status(400).json({ success: false, message: 'Invalid OTP' })

    user.email = newEmail
    await user.save()

    req.session.user.email = newEmail
    req.session.emailChange = null

    return res.json({ success: true, message: 'Email updated successfully' })
  } catch (error) {
    console.error('error from emailVerify : ', error)
    res.json({ success: false, message: 'Servor error' })
  }
}

export {
  profileLoad,
  editProfileLoad,
  editProfile,
  passwordeditLoad,
  editPassword,
  addressLoad,
  addAddress,
  addressEditLoad,
  editAddress,
  deleteAddress,
  updateProfileImage,
  removeProfileImage,
  emailChange,
  emailVerify
}
