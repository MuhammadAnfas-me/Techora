import {
  getProfileData,
  getEditProfileData,
  updateUserProfile,
  changeUserPassword,
  getUserAddresses,
  createAddress,
  getAddressById,
  updateAddress,
  deleteUserAddress,
  replaceProfileImage,
  resetProfileImage,
  initiateEmailChange,
  verifyEmailChange,
  sendContactMessage
} from '../../services/user/profileService.js'  

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────

const profileLoad = async (req, res) => {
  const { user, address } = await getProfileData(
    req.user ?? null,
    req.session.user?.email
  )
  res.render('User/userProfile/profile.ejs', { user, address })
}

const editProfileLoad = async (req, res) => {
  const { user, dobValue } = await getEditProfileData(
    req.user ?? null,
    req.session.user?.email
  )
  res.render('User/userProfile/editPage.ejs', { user, dobValue })
}

const editProfile = async (req, res) => {
  try {
    const email = req.session?.user?.email || req.user.email

    await updateUserProfile(email, req.body)

    res.json({ success: true, message: 'Profile updated successfully' })
  } catch (er) {
    console.error('error from profile patch:', er)
    const status = er.status || 500
    res.status(status).json({ success: false, message: er.message || 'Server error' })
  }
}

// ─────────────────────────────────────────────
// Password
// ─────────────────────────────────────────────

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

    await changeUserPassword(email, currentPassword, confirmPassword)

    return res.status(200).json({ success: true, message: 'Password changed successfully' })
  } catch (er) {
    console.error('Error from editPassword:', er)
    const status = er.status || 500
    return res.status(status).json({ success: false, message: er.message || 'Something went wrong' })
  }
}

// ─────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────

const addressLoad = async (req, res) => {
  const user = req.session?.user || req.user
  const addresses = await getUserAddresses(user.userId)
  res.render('User/userProfile/addressPage.ejs', {
    addresses,
    email: user.email,
    name: user.fullName
  })
}

const addAddress = async (req, res) => {
  try {
    const userId = req.session?.user?.userId || req.user.userId

    const newAddress = await createAddress(userId, req.body)

    return res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: newAddress
    })
  } catch (error) {
    console.error('Add address error:', error)
    if (error.name === 'ValidationError' || error.status === 400) {
      return res.status(400).json({ success: false, message: error.message })
    }
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

const addressEditLoad = async (req, res) => {
  const address = await getAddressById(req.params.id)
  return res.status(201).json({ success: true, address })
}

const editAddress = async (req, res) => {
  try {
    const userId    = req.session?.user?.userId || req.user.userId
    const addressId = req.params.id

    await updateAddress(userId, addressId, req.body)

    return res.json({ success: true, message: 'Address updated successfully' })
  } catch (error) {
    console.error('update address error:', error)
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message })
    }
    const status = error.status || 500
    return res.status(status).json({ success: false, message: error.message || 'Server error' })
  }
}

const deleteAddress = async (req, res) => {
  try {
    await deleteUserAddress(req.params.id)
    return res.json({ success: true, message: 'Address deleted successfully' })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

// ─────────────────────────────────────────────
// Profile Image
// ─────────────────────────────────────────────

const updateProfileImage = async (req, res) => {
  try {
    const userId = req.session?.user?.userId || req.user.userId

    if (!req.file) {
      return res.status(401).json({ success: false, message: 'No file uploaded' })
    }

    const imageUrl = await replaceProfileImage(userId, req.file.path)

    if (req.session.user) {
      req.session.user.profileImage = imageUrl
    }

    res.json({ success: true, message: 'Profile image updated' })
  } catch (error) {
    console.error('error from updateProfileImage:', error)
    const status = error.status || 500
    res.status(status).json({ success: false, message: error.message || 'Image upload failed' })
  }
}

const removeProfileImage = async (req, res) => {
  try {
    const userId = req.session?.user?.userId || req.user.userId

    await resetProfileImage(userId)

    return res.status(201).json({ success: true, message: 'Image removed successfully' })
  } catch (error) {
    console.error('Error from removeProfileImage:', error)
    return res.status(500).json({ success: false, message: 'Failed to remove profile image' })
  }
}

// ─────────────────────────────────────────────
// Email Change
// ─────────────────────────────────────────────

const emailChange = async (req, res) => {
  try {
    const sessionData = await initiateEmailChange(
      req.body.email,
      req.session.user?.name
    )

    req.session.emailChange = sessionData

    return res.json({ success: true, message: 'OTP sent to new email' })
  } catch (error) {
    console.error('Error from emailChange:', error)
    const status = error.status || 500
    return res.status(status).json({ success: false, message: error.message || 'Server error' })
  }
}

const emailVerify = async (req, res) => {
  try {
    const userId = req.session.user?.userId
    const { newEmail, otp } = req.body

    const updatedEmail = await verifyEmailChange(
      userId,
      newEmail,
      otp,
      req.session.emailChange
    )

    req.session.user.email = updatedEmail
    req.session.emailChange = null

    return res.json({ success: true, message: 'Email updated successfully' })
  } catch (error) {
    console.error('error from emailVerify:', error)
    const status = error.status || 500
    return res.status(status).json({ success: false, message: error.message || 'Server error' })
  }
}

// ─────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────

const contactLoad = (req, res) => {
  res.render('User/contactPage.ejs')
}

const contactMail = async (req, res) => {
  console.log(req.body)
  try {
    const { name, email, phone, subject, message } = req.body.data

    await sendContactMessage({ name, email, phone, subject, message })

    res.status(200).json({ success: true, message: 'Email sended successfully' })
  } catch (err) {
    console.error(err)
    const status = err.status || 500
    res.status(status).json({ success: false, message: err.message || 'Something went wrong' })
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
  emailVerify,
  contactLoad,
  contactMail
}