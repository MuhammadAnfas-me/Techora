// ===================================
// DRAWER/MODAL FUNCTIONALITY
// ===================================

const modalOverlay = document.getElementById('modalOverlay')
const modalContent = document.getElementById('modalContent')
const addAddressBtn = document.getElementById('addAddressBtn')
const closeModalBtn = document.getElementById('closeModalBtn')
const cancelBtn = document.getElementById('cancelBtn')
const addressForm = document.getElementById('addressForm')

// Open Drawer
function openModal () {
  modalOverlay.classList.add('active')
  document.body.style.overflow = 'hidden'
}

// Close Drawer
function closeModal () {
  modalOverlay.classList.remove('active')
  document.body.style.overflow = 'auto'
}

// Event Listeners
addAddressBtn.addEventListener('click', openModal)
closeModalBtn.addEventListener('click', closeModal)
cancelBtn.addEventListener('click', closeModal)

// Close when clicking outside
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) {
    closeModal()
  }
})

// Close on ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
    closeModal()
  }
})

// ===================================
// FORM VALIDATION
// ===================================

const formInputs = document.querySelectorAll('.form-input')
const phoneInput = document.getElementById('phone')
const zipInput = document.getElementById('zipCode')

const phoneError = document.querySelector('.phoneError')
const zipError = document.querySelector('.zipcodeError')

addressForm.addEventListener('submit', async e => {
  e.preventDefault()

  let isValid = true

  const phoneValue = phoneInput.value.trim()
  if (!phoneValue) {
    phoneError.textContent = 'Phone number is required'
    phoneInput.classList.add('error')
    isValid = false
  } else if (!/^[0-9]{10}$/.test(phoneValue)) {
    phoneError.textContent = 'Phone number must be 10 digits'
    phoneInput.classList.add('error')
    isValid = false
  } else {
    phoneError.textContent = ''
    phoneInput.classList.remove('error')
  }

  const zipValue = zipInput.value.trim()

  if (!zipValue) {
    zipError.textContent = 'ZIP code is required'
    zipInput.classList.add('error')
    isValid = false
  } else if (!/^[0-9]{4,6}$/.test(zipValue)) {
    zipError.textContent = 'Invalid ZIP code'
    zipInput.classList.add('error')
    isValid = false
  } else {
    zipError.textContent = ''
    zipInput.classList.remove('error')
  }

  if (isValid) {
    const id = document.getElementById('addressId').value
    // Collect values
    const addressData = {
      fullName: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      addressLine1: document.getElementById('address1').value.trim(),
      addressLine2: document.getElementById('address2').value.trim(),
      city: document.getElementById('city').value.trim(),
      state: document.getElementById('state').value.trim(),
      zipCode: document.getElementById('zipCode').value.trim(),
      country: document.getElementById('country').value,
      type: document.querySelector('input[name="label"]:checked').value,
      default: document.getElementById('defaultAddress').checked
    }

    try {
      showLoader()
      if (id) {
        const res = await axios.patch(`/profile/address/${id}`, addressData)
        showToast(res.data?.message || 'Address edited successfully')
      } else {
        const res = await axios.post('/profile/address', addressData)
        showToast(res.data?.message || 'Address added successfully')
      }
      closeModal()
      location.reload()
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error')
    }
    hideLoader()
  }
})

async function editAddress (id) {
  try {
    const res = await axios.get(`/profile/address/${id}`)
    const data = res.data.address
    document.getElementById('name').value = data.fullName
    document.getElementById('phone').value = data.phone
    document.getElementById('address1').value = data.addressLine1
    document.getElementById('address2').value = data.addressLine2 || ''
    document.getElementById('city').value = data.city
    document.getElementById('state').value = data.state
    document.getElementById('zipCode').value = data.zipCode
    document.getElementById('country').value = data.country
    document.querySelector(
      `input[name="label"][value="${data.type}"]`
    ).checked = true
    document.getElementById('defaultAddress').checked = Boolean(data.default)

    document.getElementById('addressId').value = id
    openModal()
  } catch (er) {
    showToast('Failed to load address', 'error')
  }
}

async function deleteAddress (id) {
  try {
    showConfirm('Are you sure, delete this?', async () => {
      const res = await axios.delete(`/profile/address/${id}`)
      location.reload()
      showToast(res.data.message || 'Deleted successfully')
    })
  } catch (error) {
    console.error(error)
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
