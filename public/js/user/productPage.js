document.addEventListener('DOMContentLoaded', () => {
  const filterForm = document.getElementById('filterForm')
  const clearFiltersBtn = document.getElementById('clearFiltersBtn')
  const clearSearchBtn = document.getElementById('clearSearchBtn')
  const searchInput = document.getElementById('searchInput')
  const sortSelect = document.getElementById('sort-select')
  const minRange = document.getElementById('minRange')
  const maxRange = document.getElementById('maxRange')
  const minPriceLabel = document.getElementById('minPriceLabel')
  const maxPriceLabel = document.getElementById('maxPriceLabel')
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
      minPrice: minRange ? minRange.value : 0,
      maxPrice: maxRange ? maxRange.value : 50000,
      search: searchInput ? searchInput.value.trim() : '',
      sort: sortSelect ? sortSelect.value : '',
      page
    }
  }

  async function loadFilteredProducts (page = 1) {
    try {
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

      if (productsSection) {
        productsSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }
      toggleClearBtn()
    } catch (error) {
      console.error('loadFilteredProducts error:', error)
    }
  }

  function updateProductsCount (totalProducts) {
    const productsCount = document.getElementById('productsCount')
    if (productsCount) {
      productsCount.textContent = totalProducts ?? 0
    }
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
        const firstImage =
          firstVariant.image?.[0] || '/images/fallback-product.png'
        const price = firstVariant.price ?? 0
        const variantId = firstVariant.varientId || ''

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
          <article class="product-card" onclick="openProductPage('${
            product.name
          }')">
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
                <div class="stars">
                  <div class="h-3 w-3"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div>
                  <div class="h-3 w-3"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div>
                  <div class="h-3 w-3"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div>
                  <div class="h-3 w-3"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div>
                  <div class="h-3 w-3 star-empty"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div>
                </div>
                <span class="review-count">(124)</span>
              </div>

              <div class="card-footer">
                <span class="price">$${price}</span>
                <button
                  type="button"
                  class="add-btn"
                  onclick="addToCart(event, '${
                    product._id
                  }', '${variantId}', ${loggedIn})"
                >
                  <div class="h-4 w-4">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                    </svg>
                  </div>
                  <span class="add-text">Add</span>
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

    if (currentPage > 1) {
      html += `
      <button
        type="button"
        class="page-link page-link-nav"
        data-page="${currentPage - 1}"
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

    if (currentPage < totalPages) {
      html += `
      <button
        type="button"
        class="page-link page-link-nav"
        data-page="${currentPage + 1}"
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
    loadFilteredProducts(1)
  })

  sortSelect?.addEventListener('change', () => {
    loadFilteredProducts(1)
  })

  searchInput?.addEventListener('input', toggleClearBtn)

  clearSearchBtn?.addEventListener('click', () => {
    if (!searchInput) return
    searchInput.value = ''
    toggleClearBtn()
    loadFilteredProducts(1)
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
    loadFilteredProducts(1)
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
    if (cartCountEl) {
      if (res.data.cartCount !== undefined) {
        cartCountEl.textContent = res.data.cartCount
      }

      cartCountEl.classList.add('cart-bounce')
      setTimeout(() => {
        cartCountEl.classList.remove('cart-bounce')
      }, 300)
    }
    loadFilteredProducts(1)
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
    if (favBtn) {
      favBtn.classList.add('cart-bounce')
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
    showToast(error?.response?.message || "Something went wrong")
  }
}

function openProductPage (productId) {
  window.location.href = `/products/${productId}`
}
