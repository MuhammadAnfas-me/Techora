import Address from "../../models/addressModel.js"
import { Cart } from "../../models/cartModel.js"
import {Order} from "../../models/orderModel.js"
import Product from "../../models/productModel.js"

export const paymentPageLoad = async (req,res)=>{
    try {
        const user = req.session.user
        const addressId = req.query.addressId
        if (!user) {
            return res.redirect('/')
        }
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
                  subtotal: variant.price * item.quantity,
                  //  validation fields
                  isValid,
                  message
                }
              })
            }
            const grandTotal = cartItems.reduce((sum,item)=> sum + item.subtotal,0)
            res.render("User/paymentPage.ejs",{
                cartItems,
                grandTotal
            })
    } catch (error) {
        
    }
}

export const orderSuccess = (req,res)=>{
    res.render("User/orderSuccessPage.ejs")
}

export const placeOrder = async (req,res)=>{
    try{
        const user = req.session.user
        if(!user){
            return res.redirect("/")
        }
        const addressId = req.body.addressId
        const paymentMethod = req.body.paymentMethod
        const addressDoc = await Address.findOne({userId : user.userId, _id : addressId })

        if(!addressDoc){
            return res.json({
                success : false,
                message : "Address not found"
            })
        }

        const cart = await Cart.findOne({userId : user.id}).populate('items.productId')

        if(!cart || cart.items.length === 0){
            return res.status(400).json({
                success : false,
                message : "Cart is empty"
            })
        }

        let orderItems = []
        let totalAmount = 0
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

            totalAmount+=item.total

            orderItems.push({
                productId : product._id,
                name : product.name,
                brand : product.brand,
                variantId : item.variantId,
                color : variant.color,
                quantity : item.quantity,
                price : variant.price,
                total : item.total,
                image : variant.image?.[0] || ""
            })

        }

        const orderId = "ORD" + Date.now()
        const newOrder = new Order({
            userId : user.id,
            orderId ,
            addressId,
            items : orderItems,
            totalAmount ,
            address : {
                name : addressDoc.fullName,
                phone : addressDoc.phone,
                addressLine1 : addressDoc.addressLine1,
                addressLine2 : addressDoc.addressLine2,
                city : addressDoc.city,
                state : addressDoc.state,
                zipCode : addressDoc.zipCode
            },
            paymentMethod : "COD",
            paymentStatus : "Pending",
            orderStatus : "Placed",
        })

        await newOrder.save()

        for(let item of cart.items){
            const product = item.productId

            await Product.updateOne({
                _id : product.id,
                "variants.varientId" : item.variantId
            },
            {
                $inc : {
                    "variants.$.stock" : -item.quantity
                }
            })
        }

        await Cart.findOneAndDelete({userId : user.id})

        if(paymentMethod === "COD"){
            return res.json({
                success : true,
                message : "Order placed successfully",
                orderId : newOrder.orderId
            })
        }
    }catch(er){
        console.error("Error from place order :",er)
        return res.json({
            success : false ,
            message : 'Something went wrong'
        })
    }
}

export const fetchOrderDetails = async (req,res)=>{
    try{
        const orderId = req.query.orderId
        const order = await Order.findOne({orderId})
        if(!order){
            return res.status(400).json({
                success : false,
                message : "Order not found"
            })
        }
        return res.status(200).json({
            success : true,
            message : "Order fetched successfully",
            orderId : order.orderId,
            orderDate : order.createdAt,
            address1 : order.address.addressLine1,
            address2 : order.address.addressLine2,
        })
    }catch(er){
        console.error("Error from fetchOrderDetails :",er)
        return res.status(500).json({
            success : false,
            message : "Server error"
        })
    }

}