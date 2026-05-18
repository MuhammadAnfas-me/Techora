document.addEventListener('DOMContentLoaded', () => {
  const filterForm = document.getElementById('filterForm')
  const clearFiltersBtn = document.getElementById('clearFiltersBtn')
  const clearSearchBtn = document.getElementById('clearSearchBtn')
  const searchInput = document.getElementById('searchInput')
  const sortSelect = document.getElementById('sort-select')
  const minRange = document.getElementById('minRange')
  const maxRange = document.getElementById('maxRange')
  const minRangeMobile = document.getElementById('minRangeMobile')
  const maxRangeMobile = document.getElementById('maxRangeMobile')
  const minPriceLabel = document.getElementById('minPriceLabel')
  const maxPriceLabel = document.getElementById('maxPriceLabel')
  const minPriceLabelMobile = document.getElementById('minPriceLabelMobile')
  const maxPriceLabelMobile = document.getElementById('maxPriceLabelMobile')
  const productCount = document.getElementById('productCount')

  function updatePriceLabels () {
    if (!minRange || !maxRange) return

    let min = Number(minRange.value)
    let max = Number(maxRange.value)

    if (min > max) {
      ;[min, max] = [max, min]
      minRange.value = min
      maxRange.value = max
    }

    if (minPriceLabel) minPriceLabel.textContent = `₹${min}`
    if (maxPriceLabel) maxPriceLabel.textContent = `₹${max}`
    
    if (minPriceLabelMobile) minPriceLabelMobile.textContent = `₹${min}`
    if (maxPriceLabelMobile) maxPriceLabelMobile.textContent = `₹${max}`
    
    if (minRangeMobile) minRangeMobile.value = min
    if (maxRangeMobile) maxRangeMobile.value = max
  }

  function getCheckedValues (name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(
      input => input.value
    )
  }

  function buildParams (page = 1) {
    return {
      category: getCheckedValues('category'),
      brand: getCheckedValues('brand'),
      compatibility: getCheckedValues('compatibility'),
      minPrice: (minRange && Number(minRange.value) > 0) ? minRange.value : '',
      maxPrice: (maxRange && Number(maxRange.value) < 50000) ? maxRange.value : '',
      search: searchInput ? searchInput.value.trim() : '',
      sort: sortSelect ? sortSelect.value : '',
      page
    }
  }

  async function loadFilteredProducts (page = 1,scroll = true) {
    try {
      showLoader()
      const params = buildParams(page)
      const productsSection = document.getElementById('productsSection')
      const productsContainer = document.getElementById('productsContainer')

      if (productsContainer) {
        productsContainer.innerHTML = `<p class="no-products-message">Loading products...</p>`
      }

      const res = await axios.get('/products', {
        params,
        paramsSerializer: function (params) {
          const searchParams = new URLSearchParams()

          Object.keys(params).forEach(key => {
            const value = params[key]

            if (Array.isArray(value)) {
              value.forEach(v => searchParams.append(key, v))
            } else if (value !== '' && value !== null && value !== undefined) {
              searchParams.append(key, value)
            }
          })

          return searchParams.toString()
        },
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })

      if (!res.data.success) return

      renderProducts(res.data.products , res.data.wishListIds)
      renderPagination(res.data.totalPages, res.data.currentPage)
      updateProductsCount(res.data.totalProducts)
      productCount.textContent = res.data.products.length
      const queryString = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => queryString.append(key, v))
        } else if (value !== '' && value !== null && value !== undefined) {
          queryString.append(key, value)
        }
      })

      history.pushState({}, '', `/products?${queryString.toString()}`)
      if (productsContainer) {
        productsContainer.classList.remove('is-loading')
      }

      if (productsSection && scroll) {
        productsSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }
      toggleClearBtn()
      setTimeout(()=>{
        hideLoader()
      },300)
    } catch (error) {
      console.error('loadFilteredProducts error:', error)
    }
  }

  function updateProductsCount (totalProducts) {
    const countElement = document.getElementById('productCount')
    if (countElement) {
      countElement.textContent = totalProducts ?? 0
    }
  }

  function generateStars(rating = 0) {
  const fullStars = Math.floor(rating);
  const emptyStars = 5 - fullStars;

  let starsHTML = '';

  for (let i = 0; i < fullStars; i++) {
    starsHTML += `
      <div class="h-3 w-3 text-yellow-400">
        <svg fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      </div>
    `;
  }

  for (let i = 0; i < emptyStars; i++) {
    starsHTML += `
      <div class="h-3 w-3 text-gray-300">
        <svg fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      </div>
    `;
  }

  return starsHTML;
}

  function renderProducts (products,wishListIds) {
    const container = document.getElementById('productsContainer')
    if (!container) return

    if (!products || !products.length) {
      container.innerHTML = `<p class="no-products-message">No products found</p>`
      return
    }

    const loggedIn = document.body.dataset.loggedIn === 'true'

    container.innerHTML = products
      .map(product => {
        const firstVariant = product.variants?.[0] || {}
           const variant = product.variants?.[0] || {}
        const firstImage =
          firstVariant.image?.[0] || '/images/fallback-product.png'
        const offerPrice = firstVariant.offerPrice ?? firstVariant.price ?? 0;
        const originalPrice = firstVariant.originalPrice ?? firstVariant.price ?? 0;
        const variantId = firstVariant.varientId || ''
        const isOutOfStock = variant.stock === undefined || variant.stock === null || variant.stock < 1;

        const createdAt = new Date(product.createdAt)
        const now = new Date()
        const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24)
        const isNew = diffDays <= 7

        const currentVariantId = product.variants?.[0]?.varientId || "";
        const isWishlisted = wishListIds?.some(item =>
          item.productId === product._id.toString() &&
          item.variantId === currentVariantId
        );


        return `
          <article class="product-card" onclick="openProductPage('${product.name}')">
            <div class="card-image-wrapper">
              <img src="${firstImage}" alt="${product.name}" class="card-img">
              ${isNew ? `<span class="badge-new">New</span>` : ''}
              
              <button type="button" class="fav-btn ${isWishlisted ? "active" : ""}">
                <div class="h-4 w-4">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.175 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"></path>
                  </svg>
                </div>
              </button>
            </div>

            <div style="flex: 1; display: flex; flex-direction: column;" class="product-content">
              <span class="card-brand">${(
                product.brand || ''
              ).toUpperCase()}</span>
              <h3 class="card-title">${product.name || ''}</h3>

              <div class="rating-wrapper">
                ${generateStars(product.avgRating)}
                <span class="review-count">(${product.reviewCount || 0})</span>
              </div>

              <div class="card-footer">
                ${offerPrice < originalPrice ? 
                  `<div>
                  <span class="price">₹${offerPrice}</span>
                   <span class="original-price" style="text-decoration: line-through; color: #888; font-size: 0.9em; margin-left: 0.5rem;">₹${originalPrice}</span>
                   </div>` : 
                  `<span class="price">₹${offerPrice}</span>`
                }
                <button
                  type="button"
                  class="add-btn ${isOutOfStock ? 'out-stock-btn' : ''}"
                  onclick="${
                    !isOutOfStock ?
                     `addToCart(event, '${product._id}', '${variantId}', ${loggedIn})`
                      : ''
                  }"
                  ${isOutOfStock ? 'disabled' : ''}
                >
                  ${
                    isOutOfStock ?
                     `<span class="add-text">Out of Stock</span>`
                      : `<div class="h-4 w-4">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                        </svg>
                      </div>
                      <span class="add-text">Add</span>`
                  }
                </button>
              </div>
            </div>
          </article>
        `
      })
      .join('')
  }

  function renderPagination (totalPages, currentPage) {
    const paginationContainer = document.getElementById('paginationContainer')
    if (!paginationContainer) return

    if (totalPages <= 1) {
      paginationContainer.innerHTML = ''
      return
    }

    let html = `<nav class="pagination">`

    if (Number(currentPage) > 1) {
      html += `
      <button
        type="button"
        class="page-link page-link-nav"
        data-page="${Number(currentPage) - 1}"
      >
        <div class="h-4 w-4">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
          </svg>
        </div>
        Previous
      </button>
    `
    }

    for (let i = 1; i <= totalPages; i++) {
      html += `
      <button
        type="button"
        class="page-link ${Number(currentPage) === Number(i) ? 'active' : ''}"
        data-page="${i}"
      >
        ${i}
      </button>
    `
    }

    if (Number(currentPage) < Number(totalPages)) {
      html += `
      <button
        type="button"
        class="page-link page-link-nav"
        data-page="${Number(currentPage) + 1}"
      >
        Next
        <div class="h-4 w-4">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
          </svg>
        </div>
      </button>
    `
    }

    html += `</nav>`

    paginationContainer.innerHTML = html
  }

  function toggleClearBtn () {
    if (!searchInput || !clearSearchBtn) return
    clearSearchBtn.style.display = searchInput.value.trim() ? 'block' : 'none'
  }

  filterForm?.addEventListener('submit', e => {
    e.preventDefault()
    loadFilteredProducts(1,false)
  })

  sortSelect?.addEventListener('change', () => {
    loadFilteredProducts(1,false)
  })

  searchInput?.addEventListener('input', toggleClearBtn)

  clearSearchBtn?.addEventListener('click', () => {
    if (!searchInput) return
    searchInput.value = ''
    toggleClearBtn()
    loadFilteredProducts(1,false)
  })

  clearFiltersBtn?.addEventListener('click', () => {
    document
      .querySelectorAll(
        'input[name="category"]:checked, input[name="brand"]:checked, input[name="compatibility"]:checked'
      )
      .forEach(input => {
        input.checked = false
      })

    if (minRange) minRange.value = 0
    if (maxRange) maxRange.value = 50000
    if (searchInput) searchInput.value = ''
    if (sortSelect) sortSelect.value = ''

    updatePriceLabels()
    toggleClearBtn()
    loadFilteredProducts(1,false)
  })

  document
    .querySelectorAll(
      'input[name="category"], input[name="brand"], input[name="compatibility"]'
    )
    .forEach(input => {
      input.addEventListener('change', () => {
        // no auto filter
      })
    })

  minRange?.addEventListener('input', () => {
    updatePriceLabels()
  })

  maxRange?.addEventListener('input', () => {
    updatePriceLabels()
  })

  minRangeMobile?.addEventListener('input', (e) => {
    if (minRange) minRange.value = e.target.value
    updatePriceLabels()
  })

  maxRangeMobile?.addEventListener('input', (e) => {
    if (maxRange) maxRange.value = e.target.value
    updatePriceLabels()
  })

  updatePriceLabels()
  toggleClearBtn()

  const paginationContainer = document.getElementById('paginationContainer')

  paginationContainer?.addEventListener('click', e => {
    const btn = e.target.closest('[data-page]')
    if (!btn) return

    const page = Number(btn.dataset.page)
    if (!page) return

    loadFilteredProducts(page)
  })

  // For mobile sort
  window.applySort = function (value) {
    if (sortSelect) {
      sortSelect.value = value
    }

    // Update active class and checkmarks in the mobile sort drawer
    document.querySelectorAll('.sort-option').forEach(btn => {
      // Check if this button matches the selected sort value
      const isMatch = (btn.dataset.sort === value);
      
      if (isMatch) {
        btn.classList.add('active');
        // Add checkmark if it doesn't have one
        if (!btn.querySelector('.checkmark-icon')) {
          btn.innerHTML += `<div class="h-5 w-5 checkmark-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg></div>`;
        }
      } else {
        btn.classList.remove('active');
        // Remove checkmark if it exists
        const checkmark = btn.querySelector('.checkmark-icon');
        if (checkmark) checkmark.remove();
      }
    });

    loadFilteredProducts(1)
    toggleDrawer('mobile-sort-drawer', false)
  }

  window.addToCart = async function(e, productId, variantId, isLogged) {
  e.stopPropagation()

  if (!isLogged) {
    highlightLoginButton()
    return
  }

  try {
    const res = await axios.post('/cart/add', {
      productId,
      variantId,
      quantity: 1
    })

    const cartCountEl = document.getElementById('cartCount')
    const wishCount = document.getElementById("wishCount")
    if (cartCountEl) {
      if (res.data.cartCount !== undefined) {
        cartCountEl.textContent = res.data.cartCount
      }
      if (res.data.wishCount !== undefined) {
        wishCount.textContent = res.data.wishCount
      }

      cartCountEl.classList.add('cart-bounce')
      setTimeout(() => {
        cartCountEl.classList.remove('cart-bounce')
      }, 300)
    }
    //  loadFilteredProducts(1,false)
    showToast(res.data.message || 'Added to cart')
  } catch (error) {
    showToast(error.response?.data?.message || 'Failed to add to cart', 'error')
  }
}
})

function toggleDrawer (drawerId, isOpen) {
  const drawer = document.getElementById(drawerId)
  if (!drawer) return

  if (isOpen) {
    drawer.classList.add('is-open')
  } else {
    drawer.classList.remove('is-open')
  }
}

function highlightLoginButton () {
  const loginBtn = document.getElementById('loginBtn')
  if (!loginBtn) return

  loginBtn.focus()
  loginBtn.classList.remove('shake-highlight')
  void loginBtn.offsetWidth
  loginBtn.classList.add('shake-highlight')
}

// async function addToCart (e, productId, variantId, isLogged) {
//   e.stopPropagation()

//   if (!isLogged) {
//     highlightLoginButton()
//     return
//   }

//   try {
//     const res = await axios.post('/cart/add', {
//       productId,
//       variantId,
//       quantity: 1
//     })

//     const cartCountEl = document.getElementById('cartCount')
//     if (cartCountEl) {
//       if (res.data.cartCount !== undefined) {
//         cartCountEl.textContent = res.data.cartCount
//       }

//       cartCountEl.classList.add('cart-bounce')
//       setTimeout(() => {
//         cartCountEl.classList.remove('cart-bounce')
//       }, 300)
//     }
//     loadFilteredProducts(1)
//     showToast(res.data.message || 'Added to cart')
//   } catch (error) {
//     showToast(error.response?.data?.message || 'Failed to add to cart', 'error')
//   }
// }

async function addToWishlist(e, productId, variantId, isLogged,btn) {
  e.stopPropagation()
  e.preventDefault()
  try {
    if (!isLogged) {
      highlightLoginButton()
      return
    }
    
    const res = await axios.post("/wishlist/add",{
      productId,
      variantId
    })

    const favBtn = document.getElementById('favBtn')
    const wishCount = document.getElementById("wishCount")
    if (favBtn && wishCount) {
      favBtn.classList.add('cart-bounce')
      wishCount.textContent = res.data.wishCount
      setTimeout(() => {
        favBtn.classList.remove('cart-bounce')
      }, 300)
    }

    if (res.data.success) {
      btn.classList.toggle("active", res.data.inWishlist);
    } else {
      showToast(res.data.message || "Failed to update wishlist");
    }
  } catch (error) {
    console.error(error)
    showToast(error?.response?.data?.message || "Something went wrong","error")
  }
}

function openProductPage (productId) {
  window.location.href = `/products/${productId}`
}

window.scrollTo({ top: 0, behavior: "smooth" })