import {
  buildWishlistPageData,
  toggleWishlistItem,
  removeWishlistItem
} from '../../services/user/wishlistService.js'  

// ─────────────────────────────────────────────
// Wishlist Page Load
// ─────────────────────────────────────────────

const wishListLoad = async (req, res) => {
  const sessionUser = req.session.user

  try {
    if (!sessionUser) {
      return res.redirect('/')
    }

    const page = parseInt(req.query.page) || 1

    const data = await buildWishlistPageData(sessionUser.id, page)

    res.render('User/wishList.ejs', data)
  } catch (er) {
    console.log('error from wishlistLoad', er)
  }
}

// ─────────────────────────────────────────────
// Toggle Item (add / remove)
// ─────────────────────────────────────────────

const toggleItem = async (req, res) => {
  try {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ success: false, message: 'Please Login first' })
    }

    const { productId, variantId } = req.body

    const { added , wishCount } = await toggleWishlistItem(sessionUser.id, { productId, variantId })

    return res.status(200).json({
      success: true,
      message: added ? 'Added to wishlist' : 'item removed from wishlist',
      added,
      wishCount
    })
  } catch (error) {
    console.error('addToWishlist error:', error)
    const status = error.status || 500
    return res.status(status).json({ success: false, message: error.message || 'Server error' })
  }
}

// ─────────────────────────────────────────────
// Remove Product
// ─────────────────────────────────────────────

const removeProduct = async (req, res) => {
  try {
    const user = req.session.user

    if (!user) {
      return res.status(401).json({ success: false, message: 'Please Login first' })
    }

    const { productId, variantId } = req.body

    const { wishCount } = await removeWishlistItem(user.id, { productId, variantId })

    return res.status(200).json({ success: true, message: 'Product removed successfully', wishCount })
  } catch (error) {
    console.error('Error from removeProduct:', error)
    const status = error.status || 500
    return res.status(status).json({ success: false, message: error.message || 'Server error' })
  }
}

export { wishListLoad, toggleItem, removeProduct }