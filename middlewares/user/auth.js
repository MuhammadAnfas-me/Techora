import { User } from '../../models/userModel.js'
import { Cart } from '../../models/cartModel.js'
import { Wishlist } from '../../models/wishListModel.js'

const checkAuth = (req, res, next) => {
  if (req.session?.user || req?.user) {
    next()
  } else {
    res.redirect('/login')
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
  try {
    if (req.session?.user?.userId) {
      const userId = req.session.user.userId;

      const user = await User.findOne({ userId });

      if (!user) {
        req.session.user = null;
        res.locals.user = null;
        return res.redirect('/login');
      }

      if (user.isBlocked) {
        req.session.user = null;
        res.locals.user = null;
        return res.redirect('/login?blocked=true');
      }

      return next();
    }

    return next();
  } catch (err) {
    console.error(err);
    return next(err);
  }
};

const setUser = async (req, res, next) => {
  try {
    if (req.session?.user?.userId) {
      const user = await User.findOne({
        userId: req.session.user.userId
      }).select('-password')

      res.locals.user = user
      const cart = await Cart.findOne({ userId: req.session.user?.id })
      const wishlist = await Wishlist.findOne({ userId: req.session.user?.id })
      if (cart) {
        res.locals.cartCount = cart.items.length 
        res.locals.wishCount = wishlist.items.length 
      } else {
        res.locals.cartCount = 0
        res.locals.wishCount = 0
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
