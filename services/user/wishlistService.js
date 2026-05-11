import { Wishlist } from '../../models/wishListModel.js'
import { Cart } from '../../models/cartModel.js'

// ─────────────────────────────────────────────
// Wishlist Load
// ─────────────────────────────────────────────


export async function buildWishlistPageData (userId, page = 1) {
  const limit = 8
  const skip  = (page - 1) * limit

  const wishlist = await Wishlist.findOne({ userId }).populate('items.productId')

  let allWishlistItems = []

  if (wishlist && Array.isArray(wishlist.items)) {
    allWishlistItems = wishlist.items
      .map(item => {
        const product = item.productId
        if (!product) return null

        const variant = product.variants.find(
          v => v.varientId === item.variantId
        )

        if (!variant) return null

        return {
          productId:  product._id,
          variantId:  item.variantId,
          categoryId: product.categoryId,
          name:       product.name,
          status:     product.status,
          image:      variant.image?.[0] || '',
          stock:      variant.stock,
          color:      variant.color,
          price:      variant.price
        }
      })
      .filter(Boolean)
  }

  const totalItems    = allWishlistItems.length
  const totalPages    = Math.ceil(totalItems / limit)
  const wishlistItems = allWishlistItems.slice(skip, skip + limit)
  const startItem     = totalItems === 0 ? 0 : skip + 1
  const endItem       = Math.min(skip + wishlistItems.length, totalItems)

  const cart = await Cart.findOne({ userId })

  return { wishlistItems, cart, totalPages, totalItems, currentPage: page, startItem, endItem }
}

// ─────────────────────────────────────────────
// Toggle Item
// ─────────────────────────────────────────────


export async function toggleWishlistItem (userId, { productId, variantId }) {
  if (!productId) {
    throw Object.assign(new Error('Product id is required'), { status: 400 })
  }

  let wishlist = await Wishlist.findOne({ userId })

  if (!wishlist) {
    wishlist = new Wishlist({ userId, items: [] })
  }

  const existingIndex = wishlist.items.findIndex(
    item =>
      item.productId.toString() === productId &&
      item.variantId === (variantId || '')
  )

  if (existingIndex !== -1) {
    wishlist.items.splice(existingIndex, 1)
    await wishlist.save()
    return { added: false , wishCount : wishlist.items?.length}
  }

  wishlist.items.push({ productId, variantId: variantId || '' })
  await wishlist.save()

  return { added: true ,wishCount : wishlist.items?.length}
}

// ─────────────────────────────────────────────
// Remove Product
// ─────────────────────────────────────────────


export async function removeWishlistItem (userId, { productId, variantId }) {
  const wishlist = await Wishlist.findOne({ userId })

  if (!wishlist || !Array.isArray(wishlist.items)) {
    throw Object.assign(new Error('Wishlist is empty'), { status: 400 })
  }

  const itemIndex = wishlist.items.findIndex(
    item =>
      item.productId.toString() === productId &&
      item.variantId === variantId
  )

  if (itemIndex === -1) {
    throw Object.assign(new Error('Item not found in wishlist'), { status: 404 })
  }

  wishlist.items.splice(itemIndex, 1)
  await wishlist.save()
  return { wishCount : wishlist.items?.length}
}