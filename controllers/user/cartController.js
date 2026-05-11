import {
  buildCartData,
  addItemToCart,
  removeCartItem,
  updateItemQuantity
} from '../../services/user/cartService.js'   

// ─────────────────────────────────────────────
// Cart Load
// ─────────────────────────────────────────────

const cartLoad = async (req, res) => {
  try {
    const user = req.session.user

    const { cartItems, grandTotal } = await buildCartData(user.id)

    res.render('User/cart/cart.ejs', {
      name: user.name,
      email: user.email,
      cartItems,
      grandTotal
    })
  } catch (error) {
    console.log('Cart load error:', error)
    res.status(500).send('Server Error')
  }
}

// ─────────────────────────────────────────────
// Add To Cart
// ─────────────────────────────────────────────

const addToCart = async (req, res) => {
  try {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ message: 'Please login first' })
    }

    const { productId, variantId, quantity } = req.body

    const { cartCount , wishCount } = await addItemToCart(sessionUser.id, {
      productId,
      variantId,
      quantity
    })

    return res.status(200).json({
      success: true,
      message: 'Added to cart successfully',
      cartCount,
      wishCount
    })
  } catch (error) {
    console.log('Add to cart error:', error)
    const status = error.status || 500
    return res.status(status).json({ message: error.message || 'Server error' })
  }
}

// ─────────────────────────────────────────────
// Delete Cart Item
// ─────────────────────────────────────────────

const deleteCartItem = async (req, res) => {
  try {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ success: false, message: 'Please login first' })
    }

    const { productId, variantId } = req.body

    const { cartCount, cartTotal } = await removeCartItem(sessionUser, {
      productId,
      variantId
    })

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      cartCount,
      cartTotal
    })
  } catch (error) {
    console.log('Delete cart item error:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error'
    })
  }
}

// ─────────────────────────────────────────────
// Update Cart Quantity
// ─────────────────────────────────────────────

const updateCartQuantity = async (req, res) => {
  try {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({ success: false, message: 'Please login first' })
    }

    const { productId, variantId, action } = req.body

    const { quantity, itemTotal, cartTotal, itemsCount } =
      await updateItemQuantity(sessionUser.id, { productId, variantId, action })

    return res.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      quantity,
      itemTotal,
      cartTotal,
      itemsCount
    })
  } catch (error) {
    console.log('Update cart quantity error:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error'
    })
  }
}

export { cartLoad, addToCart, deleteCartItem, updateCartQuantity }