// const addresses = <%- JSON.stringify(address) %>;
async function removeCoupon () {
  try {
    const res = await axios.post('/remove-coupon')

    if (res.data.success) {
      document.getElementById('discount').innerText = '-₹0.00'
      document.getElementById('total').innerText = '₹' + res.data.finalTotal

      document.getElementById('coupon-section').style.display = 'block'

      document.getElementById('applied-coupon').style.display = 'none'
    }
  } catch (err) {
    console.log(err)
  }
}
let selectedAddressId = null
const formatINR = function (amount) {
  return '₹' + Number(amount).toLocaleString('en-IN')
}
document
  .querySelector('.proceed')
  .addEventListener('click', async function (e) {
    let originalText = this.textContent
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'
    this.disabled = true
    try {
      await axios.post('/checkout')
    } catch (error) {
      const data = error.response?.data;
      
      if (data?.errors) {
        showToast('Your cart has some issues. Redirecting to cart...', 'error')
        setTimeout(() => {
          window.location.href = '/cart'
        }, 1500)
      } else {
        showToast(data?.message || 'Cart validation failed. Please check your cart.', 'error')
        this.textContent = originalText
        this.disabled = false
      }
      return
    }

    if (!selectedAddressId) {
      showToast('Add your delivery address', 'error')
      this.textContent = originalText
      this.disabled = false
    } else {
      setTimeout(() => {
        window.location.href = `/checkout/payment?addressId=${selectedAddressId}`
      }, 1000)
    }
  })

let selectedAddressIndex = 0

function openAddressModal () {
  document.getElementById('addressModal').classList.remove('hidden')
}

function selectAddress (id) {
  if (!id) {
    showToast('Add your delivery address')
    return
  }
  selectedAddressId = id
}

function selectCard (card) {
  document.querySelectorAll('.address-card').forEach(c => {
    c.classList.remove('active')
  })

  card.classList.add('active')

  const radio = card.querySelector('input[type="radio"]')
  radio.checked = true
  selectedAddressId = radio.value
}

document.querySelectorAll('.address-card input').forEach(input => {
  input.addEventListener('click', e => {
    e.stopPropagation() 
  })
})

function confirmAddress () {
  const selectedAddress = addresses.find(addr => addr._id === selectedAddressId)

  document.getElementById('selectedAddress').innerHTML = `
  <div class="address-text" >
    <p class="address-type">${selectedAddress.type}</p>
    <p class="address-name">${selectedAddress.fullName}</p>
    <p class="address-phone">+91 ${selectedAddress.phone} </p>
    <p class="address-line"> ${selectedAddress.addressLine1}  </p>
    <p class="address-line">${selectedAddress.city} , ${selectedAddress.state}  -  ${selectedAddress.zipCode}</p>
  </div>
  `

  document.getElementById('addressModal').classList.add('hidden')
}

window.onload = () => {
  const firstCard = document.querySelector('.address-card')
  if (firstCard) selectCard(firstCard)
}

const modalOverlay = document.getElementById('addAddressModalOverlay')
const closeBtn = document.getElementById('closeAddAddressModalBtn')
const cancelBtn = document.getElementById('cancelAddAddressBtn')

function openDrawer () {
  modalOverlay.classList.add('open')
}

function closeDrawer () {
  modalOverlay.classList.remove('open')
}

closeBtn.addEventListener('click', closeDrawer)
cancelBtn.addEventListener('click', closeDrawer)

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) {
    closeDrawer()
  }
})

const addressForm = document.getElementById('addAddressForm')

// Inputs
const inputs = {
  name: document.getElementById('addName'),
  phone: document.getElementById('addPhone'),
  address1: document.getElementById('addAddress1'),
  address2: document.getElementById('addAddress2'),
  city: document.getElementById('addCity'),
  state: document.getElementById('addState'),
  zip: document.getElementById('addZipCode'),
  country: document.getElementById('addCountry'),
  default: document.getElementById('addDefaultAddress')
}

const phoneError = document.querySelector('.addPhoneError')
const zipError = document.querySelector('.addZipCodeError')

// =========================
//  Error Helpers
// =========================
function showError (input, message) {
  let error = input.parentElement.querySelector('small')

  if (!error) {
    error = document.createElement('small')
    error.classList.add('error-text')
    input.parentElement.appendChild(error)
  }

  error.textContent = message
  input.classList.add('error')
}

function clearError (input) {
  const error = input.parentElement.querySelector('small')
  if (error) error.textContent = ''

  input.classList.remove('error')
}

// =========================
//  Live Error Clearing
// =========================
document
  .querySelectorAll('#addAddressForm input, #addAddressForm select')
  .forEach(input => {
    input.addEventListener('input', () => clearError(input))
    input.addEventListener('change', () => clearError(input))
  })

// =========================
//  Form Submit
// =========================
addressForm.addEventListener('submit', async e => {
  e.preventDefault()

  let isValid = true

  // Get values
  const nameValue = inputs.name.value.trim()
  const phoneValue = inputs.phone.value.trim()
  const address1Value = inputs.address1.value.trim()
  const cityValue = inputs.city.value.trim()
  const stateValue = inputs.state.value.trim()
  const zipValue = inputs.zip.value.trim()
  const countryValue = inputs.country.value

  // ===== Name =====
  if (!nameValue) {
    showError(inputs.name, 'Full name is required')
    isValid = false
  }

  // ===== Phone =====
  if (!phoneValue) {
    phoneError.textContent = 'Phone number is required'
    inputs.phone.classList.add('error')
    isValid = false
  } else if (!/^[0-9]{10}$/.test(phoneValue)) {
    phoneError.textContent = 'Phone number must be 10 digits'
    inputs.phone.classList.add('error')
    isValid = false
  } else {
    phoneError.textContent = ''
  }

  // ===== Address =====
  if (!address1Value) {
    showError(inputs.address1, 'Address is required')
    isValid = false
  }

  // ===== City =====
  if (!cityValue) {
    showError(inputs.city, 'City is required')
    isValid = false
  }

  // ===== State =====
  if (!stateValue) {
    showError(inputs.state, 'State is required')
    isValid = false
  }

  // ===== ZIP =====
  if (!zipValue) {
    zipError.textContent = 'ZIP code is required'
    inputs.zip.classList.add('error')
    isValid = false
  } else if (!/^[0-9]{4,6}$/.test(zipValue)) {
    zipError.textContent = 'Invalid ZIP code'
    inputs.zip.classList.add('error')
    isValid = false
  } else {
    zipError.textContent = ''
  }

  // ===== Country =====
  if (!countryValue) {
    showError(inputs.country, 'Please select a country')
    isValid = false
  }

  // =========================
  // 🚀 API CALL
  // =========================
  if (isValid) {
    const id = document.getElementById('addAddressId').value

    const addressData = {
      fullName: nameValue,
      phone: phoneValue,
      addressLine1: address1Value,
      addressLine2: inputs.address2.value.trim(),
      city: cityValue,
      state: stateValue,
      zipCode: zipValue,
      country: countryValue,
      type: document.querySelector('input[name="addLabel"]:checked').value,
      default: inputs.default.checked
    }

    try {
      let res

      if (id) {
        res = await axios.patch(`/profile/address/${id}`, addressData)
      } else {
        res = await axios.post('/profile/address', addressData)
      }

      showToast(res.data?.message || 'Success')

      // Close modal
      document.getElementById('addAddressModalOverlay').classList.remove('open')

      // Reset form
      addressForm.reset()

      // Reload page
      location.reload()
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error')
    }
  }
})

async function editAddress (id) {
  try {
    // 1. Fetch the data from your existing API
    const res = await axios.get(`/profile/address/${id}`)
    const data = res.data.address

    // 2. Populate the NEW Drawer fields (using 'add' prefix IDs)
    document.getElementById('addName').value = data.fullName
    document.getElementById('addPhone').value = data.phone
    document.getElementById('addAddress1').value = data.addressLine1
    document.getElementById('addAddress2').value = data.addressLine2 || ''
    document.getElementById('addCity').value = data.city
    document.getElementById('addState').value = data.state
    document.getElementById('addZipCode').value = data.zipCode
    document.getElementById('addCountry').value = data.country

    // 3. Handle the Radio Buttons (Home/Work/Other)
    const labelRadio = document.querySelector(
      `input[name="addLabel"][value="${data.type}"]`
    )
    if (labelRadio) labelRadio.checked = true

    // 4. Handle the Checkbox
    document.getElementById('addDefaultAddress').checked = Boolean(data.default)

    // 5. Set the hidden ID field so the submit function knows to PATCH
    document.getElementById('addAddressId').value = id

    // 6. Update Drawer Title for better UX
    document.querySelector('.add-address-modal-title').textContent =
      'Edit Address'

    // 7. Close the "Select Address" modal if it's open
    const selectionModal = document.getElementById('addressModal')
    if (selectionModal) selectionModal.classList.add('hidden')

    // 8. Open the Drawer
    document.getElementById('addAddressModalOverlay').classList.add('open')
  } catch (er) {
    console.error(er)
    showToast('Failed to load address', 'error')
  }
}
async function openCouponModal () {
  document.getElementById('couponModal').style.display = 'block'

  try {
    const res = await axios.get('/available-coupons')
    const data = res.data

    const container = document.getElementById('coupon-list')
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner"></div>
      </div>
    `

    if (!data.coupons || data.coupons.length === 0) {
      container.innerHTML = `
    <div class="text-center py-4 text-muted">
      <p>No coupons available right now</p>
    </div>
  `
    } else {
      container.innerHTML = ''
      data.coupons.forEach(coupon => {
        container.innerHTML += `
       <div class="coupon-item">
         <div class="coupon-left">
           <h4>${coupon.couponCode}</h4>
           <p>
             ${
               coupon.discountType === 'Flat'
                 ? `₹${coupon.discountValue} OFF`
                 : `${coupon.discountValue}% OFF`
             }
           </p>
           <span class="min-order">Min ₹${coupon.minOrderValue}</span>
         </div>
     
         <button class="select-btn" onclick="selectCoupon('${
           coupon.couponCode
         }')">
           Apply
         </button>
       </div>
     `
      })
    }
  } catch (err) {
    console.log(err)
    showToast(err.response.data?.message, 'error')
  }
}

function selectCoupon (code) {
  document.getElementById('coupon-code').value = code
  closeCouponModal()
}

function closeCouponModal () {
  document.getElementById('couponModal').style.display = 'none'
}

async function applyCoupon () {
  const input = document.getElementById('coupon-code')
  const couponBox = document.querySelector('.coupon-box')

  const code = input.value.trim()

  if (!code) {
    showToast('Select a coupon first', 'error')
    return
  }

  try {
    const res = await axios.post('/apply-coupon', { code })

    const data = res.data

    if (!data.success) {
      showToast(data.message, 'error')
      return
    }

    // ✅ Update UI values
    const discount = data.data?.discount || 0
    const finalTotal = data.data?.finalTotal || 0

    document.getElementById('discount').innerText = formatINR(discount)
    document.getElementById('finalTotal').innerText = formatINR(finalTotal)

    showToast(data.message || 'Coupon applied successfully', 'success')

    document.querySelector('.coupon-input-group').style.display = 'none'
    document.querySelector('.coupon-header').style.display = 'none'

    // add applied UI
    couponBox.innerHTML += `
     <div class="applied-coupon-box">
       <span>✅ <strong>${data.data.code}</strong> applied</span>
       <button onclick="removeCoupon()">Remove</button>
     </div>
   `
  } catch (err) {
    console.error(err)
    showToast(err.response.data?.message || 'Something went wrong', 'error')
  }
}

async function removeCoupon () {
  try {
    const res = await axios.post('/remove-coupon')

    if (res.data.success) {
            // ✅ Update UI values
            document.getElementById("discount").innerText = "-₹0.00";
            document.getElementById("finalTotal").innerText =
            formatINR(res.data.finalTotal)

          //   // ✅ Show coupon input again
          //   document.getElementById("coupon-section").style.display = "block";

         document.querySelector(".coupon-input-group").style.display = "flex";
         document.querySelector(".coupon-header").style.display = "block";

            // ✅ Hide applied coupon box
            document.querySelector(".applied-coupon-box").style.display = "none";
      location.reload()
    }
  } catch (err) {
    console.log(err)
  }
}
