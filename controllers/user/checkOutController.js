import Address from '../../models/addressModel.js'
import {Cart} from '../../models/cartModel.js'
import { Wishlist } from '../../models/wishListModel.js'
import { resetPassword } from './authController.js'


export const checkOutLoad = async (req, res) => {
  const user = req.session.user

  try {
    if (!user) {
      return res.redirect('/login')
    }

    const address = await Address.find({ userId: user.userId })

    const cart = await Cart.findOne({ userId: user.id }).populate(
      'items.productId'
    )

    let cartItems = []
    let hasInvalidItems = false   // ⭐ important

    if (cart && Array.isArray(cart.items)) {
      cartItems = cart.items.map(item => {
        const product = item.productId

        if (!product) {
          hasInvalidItems = true
          return {
            name: "Product not found",
            isValid: false,
            message: "Product removed"
          }
        }

        const variant = product.variants.find(
          v => v.varientId === item.variantId
        )

        if (!variant) {
          hasInvalidItems = true
          return {
            productId: product._id,
            name: product.name,
            isValid: false,
            message: "Variant not available"
          }
        }

        let isValid = true
        let message = ""

        if (product.status !== "active") {
          isValid = false
          message = "Product unavailable"
        } else if (variant.stock === 0) {
          isValid = false
          message = "Out of stock"
        } else if (item.quantity > variant.stock) {
          isValid = false
          message = `Only ${variant.stock} left`
        }

        if (!isValid) hasInvalidItems = true

        return {
          productId: product._id,
          variantId: item.variantId,
          quantity: item.quantity,
          name: product.name,
          brand: product.brand,
          image: variant.image?.[0] || '',
          price: variant.price,
          stock: variant.stock,
        //   total: item.total,
          color : variant.color,
          subtotal: variant.price * item.quantity,
          //  validation fields
          isValid,
          message
        }
      })
    }
    const grandTotal = cartItems.reduce((sum,item)=> sum + item.subtotal,0)

    if (cartItems.length === 0) {
      return res.redirect('/cart')
    }
    
    res.render("User/checkOut.ejs", {
      address,
      cartItems,
      hasInvalidItems , 
      grandTotal 
    })

  } catch (error) {
    console.log("Error from checkOutLoad", error)
    return res.status(500).send("Failed to load")
  }
}


export const validateCart = async (req,res)=>{
    try {
        const user = req.session.user
        const cart = await Cart.findOne({userId : user.id}).populate('items.productId')

        if(!cart || cart.items.length === 0){
            return res.status(400).json({
                success : false,
                message : "Cart is empty"
            })
        }

        for(let item of cart.items){
            const product = item.productId

            if(!product){
                return res.status(400).json({
                    success : false ,
                    message : "Products not found"
                })
            }

            const variant =  product.variants.find(
                v=> v.varientId === item.variantId
            )

            if(!variant){
                return res.status(400).json({
                    success : false,
                    message : `${product.name} variant not available`
                })
            }

            if(product.status == "inactive"){
                return res.status(400).json({
                    success : false, 
                    message : `${product.name} is unavailable`
                })
            }

            if(variant.stock === 0){
                return res.status(400).json({
                    success : false ,
                    message : `${product.name} is out of stock`
                })
            }

            if(item.quantity > variant.stock){
                return res.status(400).json({
                    success : false,
                    message : `Only ${variant.stock} ${product.name} is available`
                })
            }

            const total = variant.price * item.quantity

            if(item.total < total){
                item.total = total
            }
        }
        await cart.save()
        return res.status(201).json({
            success : true,
            message : "Cart validated successfully",
            redirect : "/checkout"
        })
    } catch (error) {
        console.log("Error from validateCart :",error)
        return res.status(500).json({
            success : false,
            message : "Server error"
        })
    }

}