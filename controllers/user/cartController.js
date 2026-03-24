import { Cart } from '../../models/cartModel.js'
import Product from '../../models/productModel.js'
import { User } from '../../models/userModel.js'
import { Wishlist } from '../../models/wishListModel.js'
const cartLoad = async (req, res) => {
  try {
    const user = req.session.user

    const cart = await Cart.findOne({ userId: user.id }).populate(
      'items.productId'
    )
    let cartItems = []

    if (cart && Array.isArray(cart.items)) {
      cartItems = cart.items
        .map(item => {
          const product = item.productId

          if (!product) return null

          const variant = product.variants.find(
            v => v.varientId === item.variantId
          )

          if (!variant) return {
            productId: product._id,
            variantId: item.variantId,
            categoryId : product.categoryId,
            quantity: item.quantity,
            total: item.total,
            name: product.name,
            brand: product.brand,
            status : product.status,
            image: product.variants[0].image[0] || "",
            stock : 0,
            variantDeleted: true,
            stock: 0
          };

          return {
            productId: product._id,
            variantId: item.variantId,
            quantity: item.quantity,
            name: product.name,
            brand: product.brand,
            status: product.status,
            categoryId : item.categoryId,
            image: variant.image?.[0] || '',
            price: variant.price,
            stock: variant.stock,
            color: variant.color || '',
            total: item.total,
            variantDeleted: false,
            subtotal: variant.price * item.quantity
          }
        })
        .filter(Boolean)
    }

    const grandTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0)
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

const addToCart = async (req, res) => {
  try {
    const sessionUser = req.session.user
    const { productId, variantId, quantity } = req.body

    if (!sessionUser) {
      return res.status(401).json({ message: 'Please login first' })
    }

    const qty = Number(quantity) || 1

    if (qty < 1) {
      return res.status(400).json({ message: 'Invalid quantity' })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const variant = product.variants.find(v => v.varientId === variantId)
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' })
    }

    if (variant.stock < qty) {
      return res.status(400).json({ message: 'Not enough stock available' })
    }

    const wishlist = await Wishlist.findOne({userId : sessionUser.id})

   if (wishlist && Array.isArray(wishlist.items)) {
      const wishIndex = wishlist.items.findIndex(item =>
        item.productId.toString() === productId &&
        item.variantId === (variantId || "")
      )

      if (wishIndex !== -1) {
        wishlist.items.splice(wishIndex, 1)
        await wishlist.save()
      }
    }

    let total = variant.price * qty

    let cart = await Cart.findOne({ userId: sessionUser.id })

    if (!cart) {
      cart = new Cart({
        userId: sessionUser.id,
        items: []
      })
    }

    const existingItem = cart.items.find(
      item =>
        item.productId.toString() === productId && item.variantId === variantId
    )

    if (existingItem) {
      const newQty = existingItem.quantity + qty

      if (newQty > variant.stock) {
        return res
          .status(400)
          .json({ message: 'Quantity exceeds available stock' })
      }
      existingItem.total = total.toFixed()
      existingItem.quantity = newQty
    } else {
      cart.items.push({
        productId,
        variantId,
        quantity: qty,
        total
      })
    }

    await cart.save()
    const cartCount = cart.items.length

    return res.status(200).json({
      success: true,
      message: 'Added to cart successfully',
      cartCount
    })
  } catch (error) {
    console.log('Add to cart error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}

const deleteCartItem = async (req, res) => {
  try {
    const sessionUser = req.session.user
    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: 'Please login first'
      })
    }
    const user = await User.findOne({ userId: sessionUser.userId })
    if (!user)
      return res.status(400).json({
        success: false,
        message: 'User not found'
      })

    const { productId, variantId } = req.body

    if (!productId || !variantId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and Variant ID are required'
      })
    }

    const cart = await Cart.findOne({ userId: sessionUser.id })

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart is empty'
      })
    }

    const itemIndex = cart.items.findIndex(
      item =>
        item.productId.toString() === productId && item.variantId === variantId
    )

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      })
    }

    cart.items.splice(itemIndex, 1)

    await cart.save()
    const cartCount = cart.items.length
    const cartTotal = cart.items.reduce((sum,i)=> sum + i.total ,0) 

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      cartCount ,
      cartTotal
    })
  } catch (error) {
    console.log('Delete cart item error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

const updateCartQuantity = async (req, res) => {
  try {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: 'Please login first'
      })
    }

    const { productId, variantId, action } = req.body

    if (!productId || !variantId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Missing required data'
      })
    }

    const cart = await Cart.findOne({ userId: sessionUser.id }).populate(
      'items.productId'
    )

    if (!cart || !Array.isArray(cart.items)) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      })
    }

    const cartItem = cart.items.find(
      item =>
        item.productId._id.toString() === productId &&
        item.variantId === variantId
    )

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      })
    }

    const product = cartItem.productId
    const variant = product.variants.find(v => v.varientId === variantId)

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      })
    }

    if (action === 'increase') {
      if (cartItem.quantity >= variant.stock) {
        return res.status(400).json({
          success: false,
          message: 'Stock limit reached'
        })
      }

      cartItem.quantity += 1
      cartItem.total += variant.price
    } else if (action === 'decrease') {
      if (cartItem.quantity <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be less than 1'
        })
      }

      cartItem.quantity -= 1
      cartItem.total -= variant.price
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      })
    }

    await cart.save()
    const cartTotal = cart.items.reduce((sum,i)=> sum + i.total ,0) 

    return res.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      quantity : cartItem.quantity,
      itemTotal : cartItem.total,
      cartTotal,
      itemsCount : cart.items.length
    })
  } catch (error) {
    console.log('Update cart quantity error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export { cartLoad, addToCart, deleteCartItem, updateCartQuantity }
