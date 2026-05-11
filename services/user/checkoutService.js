import Address from '../../models/addressModel.js'
import { Cart } from '../../models/cartModel.js'
import { Offers } from '../../models/offerModel.js'
import { getOfferPrice } from '../../utils/offer.js'

// ─────────────────────────────────────────────
// Shared helper
// ─────────────────────────────────────────────


async function fetchActiveOffers () {
  const now = new Date()
  return Offers.find({
    isActive: true,
    start: { $lte: now },
    end: { $gte: now }
  }).lean()
}

// ─────────────────────────────────────────────
// Checkout Load
// ─────────────────────────────────────────────


export async function getUserAddresses (userId) {
  return Address.find({ userId })
}


export async function buildCheckoutCartData (userId) {
  const cart = await Cart.findOne({ userId }).populate('items.productId')

  const activeOffers = await fetchActiveOffers()

  let cartItems = []
  let hasInvalidItems = false

  if (cart && Array.isArray(cart.items)) {
    cartItems = cart.items.map(item => {
      const product = item.productId

      // Product no longer exists
      if (!product) {
        hasInvalidItems = true
        return {
          name: 'Product not found',
          isValid: false,
          message: 'Product removed'
        }
      }

      const variant = product.variants.find(v => v.varientId === item.variantId)

      // Variant was deleted
      if (!variant) {
        hasInvalidItems = true
        return {
          productId: product._id,
          name: product.name,
          isValid: false,
          message: 'Variant not available'
        }
      }

      // Stock / status validation
      let isValid = true
      let message = ''

      if (product.status !== 'active') {
        isValid = false
        message = 'Product unavailable'
      } else if (variant.stock === 0) {
        isValid = false
        message = 'Out of stock'
      } else if (item.quantity > variant.stock) {
        isValid = false
        message = `Only ${variant.stock} left`
      }

      if (!isValid) hasInvalidItems = true

      const offerPrice = getOfferPrice(product, variant.price, activeOffers)

      return {
        productId: product._id,
        variantId: item.variantId,
        quantity: item.quantity,
        name: product.name,
        brand: product.brand,
        image: variant.image?.[0] || '',
        price: offerPrice,
        stock: variant.stock,
        color: variant.color,
        subtotal: offerPrice * item.quantity,
        isValid,
        message
      }
    })
  }

  const grandTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

  return { cartItems, grandTotal, hasInvalidItems }
}

// ─────────────────────────────────────────────
// Validate Cart
// ─────────────────────────────────────────────


export async function validateCartItems (userId) {
  const cart = await Cart.findOne({ userId }).populate('items.productId')

  if (!cart || cart.items.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { status: 400 })
  }

  const errors = {}
  const activeOffers = await fetchActiveOffers()

  for (const item of cart.items) {
    const product = item.productId
    const itemKey = `${product._id}_${item.variantId}`

    if (!errors[itemKey]) errors[itemKey] = []

    if (!product) {
      errors[itemKey].push('Product not found')
      continue
    }

    const variant = product.variants.find(v => v.varientId === item.variantId)

    if (!variant) {
      errors[itemKey].push(`${product.name} variant not available`)
    }

    if (product.status === 'inactive') {
      errors[itemKey].push(`${product.name} is unavailable`)
    }

    if (item.quantity > 5) {
      errors[itemKey].push(`Max 5 allowed for ${product.name}`)
    }

    if (variant) {
      if (variant.stock === 0) {
        errors[itemKey].push(`${product.name} is out of stock`)
      }


      if (item.quantity > variant.stock) {
        errors[itemKey].push(`${product.name} has limited stock`)
      }

      // Silently correct stale total
      const offerPrice = getOfferPrice(product, variant.price, activeOffers)
      const correctTotal = offerPrice * item.quantity

      if (item.total < correctTotal) {
        item.total = correctTotal
      }
    }

    // Drop the key when no errors found for this item
    if (errors[itemKey].length === 0) {
      delete errors[itemKey]
    }
  }

  await cart.save()

  return { errors }
}
