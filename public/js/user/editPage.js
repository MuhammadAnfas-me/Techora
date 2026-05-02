document.addEventListener('DOMContentLoaded', () => {
  // --- Image Upload Logic ---
  const changePhotoBtn = document.getElementById('changePhotoBtn')
  const fileInput = document.getElementById('fileInput')
  const userAvatar = document.getElementById('userAvatar')
  const removePhotoBtn = document.getElementById('removePhotoBtn')

  // Default avatar fallback
  const defaultAvatarUrl = 'https://i.pravatar.cc/150?img=11'
  const placeholderUrl = 'https://via.placeholder.com/150?text=User'

  // Trigger file input when clicking "Change Photo"
  changePhotoBtn.addEventListener('click', () => {
    fileInput.click()
  })

  // Handle file selection
  fileInput.addEventListener('change', async (e) => {
    const file = fileInput.files[0]

    if (!file) return
    const localUrl = URL.createObjectURL(file)
    userAvatar.src = localUrl
    const formData = new FormData()
    formData.append('profileImage', file)

    try {
      const res = await axios.patch('/profile/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
    } catch (error) {
      showToast(error.response?.data?.message || 'Image upload failed', 'error')
      console.error('Error from change profile :', error)
    }
  })

  // Handle Remove Photo
  removePhotoBtn.addEventListener('click', async () => {
    try {
      showConfirm('Are you sure for remove you profile photo', async () => {
        const res = await axios.delete(`/profile/image`)
        showToast(res.data.message || 'Profile updated successfully')
      })
    } catch (error) {
      console.error('error from removeProfile : ', error)
      showToast(error.response.data?.message || 'Failed to remove profile')
    }
  })

  if (window.flatpickr) {
    flatpickr('#dob', {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'F j, Y',
      maxDate: 'today',
      disableMobile: true,
      allowInput: true,
      animate: true,

      // ✅ Premium month navigation (no dropdown)
      monthSelectorType: 'dropdown',

      prevArrow: `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M15 18l-6-6 6-6"
                            stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        `,
      nextArrow: `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M9 6l6 6-6 6"
                            stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        `
    })
  }

  // --- Form Submission ---
  const profileForm = document.getElementById('profileForm')
  if (!profileForm) return
  profileForm.addEventListener('submit', async e => {
    e.preventDefault()

    const fullName = document.getElementById('fullName').value.trim()
    const number = document.getElementById('phone').value.trim()
    const dob = document.getElementById('dob').value
    const gender = document.getElementById('gender').value
    const country = document.getElementById('country').value

    const fullNameError = document.getElementById('fullNameError')
    const phoneError = document.getElementById('phoneError')
    // Simulating a save action
    const btn = profileForm.querySelector('.btn-primary')
    const originalText = btn.innerHTML

    fullNameError.textContent = ''
    phoneError.textContent = ''

    let isValid = true
    if (fullName === ' ') {
      ;(fullNameError.textContent = '• Please enter your name'),
        (isValid = false)
    }

    if(!/^[A-Za-z ]+$/.test(fullName)){
      fullNameError.textContent = '• Name should contain only letters (no numbers or symbols)'
      isValid = false      
    }

    if (fullName.length <= 3) {
      fullNameError.textContent = '• Name must be more than 3 letters'
      isValid = false
    }

    
    if (number.length > 0) {
      if (!/^\d{10}$/.test(number)) {
      phoneError.textContent = '• Phone number must be exactly 10 digits'
      isValid = false
    }
    }

    if (isValid) {
      try {
        btn.innerHTML = 'Saving...'
        btn.disabled = true
        const res = await axios.patch(`/profile/edit`, {
          fullName,
          number,
          dob,
          gender,
          country
        })
        showToast(res.data.message || 'Updated successfully')
        setTimeout(() => {
          btn.innerHTML = originalText
          btn.disabled = false
        }, 800)
        setTimeout(() => {
          window.location.href = '/profile'
        }, 1000)
      } catch (er) {
        showToast(er.response?.data?.message || 'Something went wrong', 'error')
      }
    }
  })
})

const openEmailModalBtn = document.getElementById('openEmailModalBtn')
const emailModal = document.getElementById('emailModal')
const closeEmailModalBtn = document.getElementById('closeEmailModalBtn')

const sendEmailOtpBtn = document.getElementById('sendEmailOtpBtn')
const verifyEmailOtpBtn = document.getElementById('verifyEmailOtpBtn')
const resendEmailOtpBtn = document.getElementById('resendEmailOtpBtn')

const otpSection = document.getElementById('otpSection')
const newEmailEl = document.getElementById('newEmail')
const otpEl = document.getElementById('emailOtp')
const emailHint = document.getElementById('emailHint')

function openEmailModal () {
  emailModal.style.display = 'flex'
  otpSection.style.display = 'none'
  newEmailEl.value = ''
  otpEl.value = ''
  emailHint.textContent = ''
}
function closeEmailModal () {
  emailModal.style.display = 'none'
}

openEmailModalBtn?.addEventListener('click', openEmailModal)
closeEmailModalBtn?.addEventListener('click', closeEmailModal)

emailModal?.addEventListener('click', e => {
  if (e.target === emailModal) closeEmailModal()
})

sendEmailOtpBtn?.addEventListener('click', sendOtp)
verifyEmailOtpBtn?.addEventListener('click', emailVerify)
resendEmailOtpBtn?.addEventListener('click', sendOtp)

async function sendOtp () {
  const newEmail = newEmailEl.value.trim()
  if (!newEmail) {
    showToast('Enter new email', 'error')
    return
  }
  sendEmailOtpBtn.disabled = true
  sendEmailOtpBtn.textContent = 'Sending...'
  try {
    const res = await axios.post('/profile/edit/email', { email: newEmail })
    showToast(res.data.message || 'OTP sented')
    otpSection.style.display = 'block'
    emailHint.textContent = `OTP sent to: ${newEmail}`
  } catch (error) {
    showToast(error.response?.data?.message || 'Failed to sent OTP', 'error')
  } finally {
    sendEmailOtpBtn.disabled = false
    sendEmailOtpBtn.textContent = 'Sent OTP'
  }
}

async function emailVerify () {
  const newEmail = newEmailEl.value.trim()
  const otp = otpEl.value.trim()
  if (!otp) {
    showToast('Enter OTP', 'error')
    return
  }

  verifyEmailOtpBtn.disabled = true
  verifyEmailOtpBtn.textContent = 'Verifying...'
  try {
    const res = await axios.post('/profile/edit/email-verify', {
      newEmail,
      otp
    })
    showToast(res.data?.message)
    closeEmailModal()
    setTimeout(() => {
      window.location.reload()
    }, 800)
  } catch (error) {
    showToast(error.response?.data?.message || 'Failed to verify', 'error')
  } finally {
    verifyEmailOtpBtn.disabled = false
    verifyEmailOtpBtn.textContent = 'Verify & Update Email'
  }
}

const overlay = document.getElementById('confirmOverlay')
const confirmOk = document.getElementById('confirmOk')
const confirmCancel = document.getElementById('confirmCancel')

let confirmCallback = null

function showConfirm (message, callback) {
  document.getElementById('confirmMessage').innerText = message
  overlay.classList.add('active')
  confirmCallback = callback
}

confirmCancel.onclick = () => {
  overlay.classList.remove('active')
}

confirmOk.onclick = () => {
  overlay.classList.remove('active')
  if (confirmCallback) confirmCallback()
}
