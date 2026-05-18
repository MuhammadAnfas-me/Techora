import { Cart } from '../../models/cartModel.js'
import Product from '../../models/productModel.js'
import { User } from '../../models/userModel.js'
import { Wishlist } from '../../models/wishListModel.js'
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
// Cart Load
// ─────────────────────────────────────────────


export async function buildCartData (userId) {
  const cart = await Cart.findOne({ userId }).populate('items.productId')
  const activeOffers = await fetchActiveOffers()

  let cartItems = []

  if (cart && Array.isArray(cart.items)) {
    cartItems = cart.items
      .map(item => {
        const product = item.productId
        if (!product) return null

        const variant = product.variants.find(
          v => v.varientId === item.variantId
        )

        // Variant was deleted — return a minimal shell so the UI can warn the user
        if (!variant) {
          return {
            productId: product._id,
            variantId: item.variantId,
            categoryId: product.categoryId,
            quantity: item.quantity,
            total: item.total,
            name: product.name,
            brand: product.brand,
            status: product.status,
            image: product.variants[0]?.image?.[0] || '',
            stock: 0,
            variantDeleted: true
          }
        }

        const offerPrice = getOfferPrice(product, variant.price, activeOffers)

        return {
          productId: product._id,
          variantId: item.variantId,
          quantity: item.quantity,
          name: product.name,
          brand: product.brand,
          status: product.status,
          categoryId: item.categoryId,
          image: variant.image?.[0] || '',
          price: offerPrice,
          originalPrice: variant.price,
          stock: variant.stock,
          color: variant.color || '',
          total: offerPrice * item.quantity,
          variantDeleted: false,
          subtotal: offerPrice * item.quantity
        }
      })
      .filter(Boolean)
  }

  if (cart) {
    let cartChanged = false

    cart.items.forEach(dbItem => {
      const matchingComputed = cartItems.find(
        ci =>
          ci.productId.toString() === dbItem.productId._id.toString() &&
          ci.variantId === dbItem.variantId
      )

      if (matchingComputed && Number(dbItem.total) !== matchingComputed.total) {
        dbItem.total = matchingComputed.total
        cartChanged = true
      }
    })

    if (cartChanged) await cart.save()
  }

  const grandTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

  return { cartItems, grandTotal }
}

// ─────────────────────────────────────────────
// Add To Cart
// ─────────────────────────────────────────────


export async function addItemToCart (userId, { productId, variantId, quantity }) {
  const qty = Number(quantity) || 1

  if (qty < 1) {
    throw Object.assign(new Error('Invalid quantity'), { status: 400 })
  }

  // Validate product & variant
  const product = await Product.findById(productId)
  if (!product) {
    throw Object.assign(new Error('Product not found'), { status: 404 })
  }

  if(product.status === "inactive"){
    throw Object.assign(new Error('This product is currently unavailable for purchase'), { status: 404 })
  }
  const variant = product.variants.find(v => v.varientId === variantId)
  if (!variant) {
    throw Object.assign(new Error('Variant not found'), { status: 404 })
  }

  if (variant.stock < qty) {
    throw Object.assign(new Error('Not enough stock available'), { status: 400 })
  }else if(qty > 5) {
    throw Object.assign(new Error('You can only purchase up to 5 items of this product'), { status: 400 })
  }

  // Remove from wishlist if present
  const wishlist = await Wishlist.findOne({ userId })
  if (wishlist && Array.isArray(wishlist.items)) {
    const wishIndex = wishlist.items.findIndex(
      item =>
        item.productId.toString() === productId &&
        item.variantId === (variantId || '')
    )

    if (wishIndex !== -1) {
      wishlist.items.splice(wishIndex, 1)
      await wishlist.save()
    }
  }

  // Resolve offer price
  const activeOffers = await fetchActiveOffers()
  const offerPrice = getOfferPrice(product, variant.price, activeOffers)
  const total = offerPrice * qty

  let cart = await Cart.findOne({ userId })
  if (!cart) {
    cart = new Cart({ userId, items: [] })
  }

  const existingItem = cart.items.find(
    item =>
      item.productId.toString() === productId && item.variantId === variantId
  )

  if (existingItem) {
    const newQty = existingItem.quantity + qty
    if(newQty > 5) {
      throw Object.assign(new Error('You can only purchase up to 5 items of this product'), { status: 400 })
    }else if (newQty > variant.stock) {
      throw Object.assign(new Error('Quantity exceeds available stock'), { status: 400 })
    }
    existingItem.total = total.toFixed()
    existingItem.quantity = newQty
  } else {
    cart.items.push({ productId, variantId, quantity: qty, total })
  }

  await cart.save()
  return { cartCount: cart.items.length ,wishCount : wishlist ? wishlist.items.length : 0}
}

// ─────────────────────────────────────────────
// Delete Cart Item
// ─────────────────────────────────────────────


export async function removeCartItem (sessionUser, { productId, variantId }) {
  if (!productId || !variantId) {
    throw Object.assign(
      new Error('Product ID and Variant ID are required'),
      { status: 400 }
    )
  }

  // Verify user exists in DB
  const user = await User.findOne({ userId: sessionUser.userId })
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 400 })
  }

  const cart = await Cart.findOne({ userId: sessionUser.id })

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { status: 404 })
  }

  const itemIndex = cart.items.findIndex(
    item =>
      item.productId.toString() === productId && item.variantId === variantId
  )

  if (itemIndex === -1) {
    throw Object.assign(new Error('Cart item not found'), { status: 404 })
  }

  cart.items.splice(itemIndex, 1)
  await cart.save()

  const cartCount = cart.items.length
  const cartTotal = cart.items.reduce((sum, i) => sum + i.total, 0)

  return { cartCount, cartTotal }
}

// ─────────────────────────────────────────────
// Update Cart Quantity
// ─────────────────────────────────────────────

export async function updateItemQuantity (userId, { productId, variantId, action }) {
  if (!productId || !variantId || !action) {
    throw Object.assign(new Error('Missing required data'), { status: 400 })
  }

  const cart = await Cart.findOne({ userId }).populate('items.productId')

  if (!cart || !Array.isArray(cart.items)) {
    throw Object.assign(new Error('Cart not found'), { status: 404 })
  }

  const cartItem = cart.items.find(
    item =>
      item.productId._id.toString() === productId &&
      item.variantId === variantId
  )

  if (!cartItem) {
    throw Object.assign(new Error('Cart item not found'), { status: 404 })
  }

  const product = cartItem.productId
  const variant = product.variants.find(v => v.varientId === variantId)
  const allowedQuantity = Math.min(variant.stock,5)

  if (!variant) {
    throw Object.assign(new Error('Variant not found'), { status: 404 })
  }

  const activeOffers = await fetchActiveOffers()
  const offerPrice = getOfferPrice(product, variant.price, activeOffers)

  if (action === 'increase') {
    if(cartItem.quantity >= variant.stock){
      throw Object.assign(new Error(`Stock limit reached`), { status: 400 })
    }
    if (cartItem.quantity >= allowedQuantity) {
      throw Object.assign(new Error(`You can only purchase up to ${allowedQuantity} items of this product`), { status: 400 })
    }
    cartItem.quantity += 1
    cartItem.total = Number(cartItem.total) + offerPrice
  } else if (action === 'decrease') {
    if (cartItem.quantity <= 1) {
      throw Object.assign(new Error('Quantity cannot be less than 1'), { status: 400 })
    }
    cartItem.quantity -= 1
    cartItem.total = Number(cartItem.total) - offerPrice
  } else {
    throw Object.assign(new Error('Invalid action'), { status: 400 })
  }

  await cart.save()

  const cartTotal = cart.items.reduce((sum, i) => sum + i.total, 0)

  return {
    quantity: cartItem.quantity,
    itemTotal: cartItem.total,
    cartTotal,
    itemsCount: cart.items.length
  }
}