import { User } from '../../models/userModel.js'
import { Cart } from '../../models/cartModel.js'

const checkAuth = (req, res, next) => {
  if (req.session?.user || req?.user) {
    next()
  } else {
    res.redirect('/')
  }
}

const isLogged = (req, res, next) => {
  if (req.session?.user || req?.user) {
    res.redirect('/')
  } else {
    next()
  }
}

const isBlocked = async (req, res, next) => {
  if (req.session?.user?.userId) {
    const userId = req.session?.user?.userId
    const user = await User.findOne({ userId })
    if (user.isBlocked) {
      res.redirect('/login?blocked=true')
      req.session.user = null
    } else {
      next()
    }
  } else {
    next()
  }
}

const setUser = async (req, res, next) => {
  try {
    if (req.session?.user?.userId) {
      const user = await User.findOne({
        userId: req.session.user.userId
      }).select('-password')

      res.locals.user = user
      const cart = await Cart.findOne({ userId: req.session.user?.id })
      if (cart) {
        res.locals.cartCount = cart.items.length 
      } else {
        res.locals.cartCount = 0
      }
    } else {
      res.locals.user = null
    }
    next()
  } catch (error) {
    console.error(error)
    res.redirect('/login')
  }
}
export { checkAuth, isLogged, setUser, isBlocked }
