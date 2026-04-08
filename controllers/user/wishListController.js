import { Wishlist } from "../../models/wishListModel.js"
import { User } from "../../models/userModel.js"
import { Cart } from "../../models/cartModel.js"
import { createReadStream } from "fs"

const wishListLoad = async (req,res)=>{
    const sessionUser = req.session.user
    try{
    if(!sessionUser){
        res.redirect("/")
    }
    const page = parseInt(req.query.page) || 1
    const limit = 8
    const skip = (page - 1) * limit

    const wishlist = await Wishlist.findOne({userId : sessionUser.id}).populate("items.productId")
    let allWishlistItems = []
    if(wishlist && Array.isArray(wishlist.items)){
        allWishlistItems = wishlist.items.map(item=>{
            const product = item.productId
            if(!product) return null

            const variant = product.variants.find(
                v => v.varientId === item.variantId
            )
            return {
                productId : product._id,
                variantId : item.variantId,
                categoryId : product.categoryId,
                name : product.name,
                status : product.status,
                image : variant.image?.[0] || "",
                stock : variant.stock,
                color : variant.color,
                price : variant.price
            }
        }).filter(Boolean)
    }
    

    const totalItems = allWishlistItems.length
    const totalPages = Math.ceil(totalItems / limit)
    const wishlistItems = allWishlistItems.slice(skip, skip + limit)
    const startItem = totalItems === 0 ? 0 : skip + 1
    const endItem = Math.min(skip + wishlistItems.length, totalItems)

    const cart = await Cart.findOne({userId : sessionUser.id})

    res.render("User/wishList.ejs",{
        wishlistItems,
        cart,
        totalPages,
        totalItems,
        currentPage : page,
        startItem,
        endItem
    })
    }catch(er){
        console.log("error from wishlistLoad",er)
    }
}
 
const toggleItem = async (req,res)=>{
    try {
        const sessionUser = req.session.user
        if(!sessionUser){
            return res.status(401).json({
                success : false,
                message : "Please Login first"
            })
        }
        const {productId, variantId} = req.body

        if(!productId){
            return res.status(400).json({
                success : false,
                message : "Product id is required"
            })
        }
        let wishlist = await Wishlist.findOne({userId : sessionUser.id})
        
        if(!wishlist){
            wishlist = new Wishlist({
                userId : sessionUser.id,
                items : []
            })
        }

        const existingIndex = wishlist.items.findIndex(item => {
            return item.productId.toString() === productId && item.variantId === (variantId || "")
        })

        if(existingIndex !== -1){
            wishlist.items.splice(existingIndex,1)
            await wishlist.save()
            return res.status(200).json({
                success : true,
                message : "item removed from wishlist"
            })
        }

        wishlist.items.push({
            productId,
            variantId : variantId || ""
        })

        await wishlist.save()

        return res.status(200).json({
            success : true,
            message : "Added to wishlist"
        })
    } catch (error) {
        console.error("addTowishlist error:",error)
        return res.status(500).json({
            success : false,
            message : "Server error"
        })
    }

}

const removeProduct = async (req,res)=>{
    try {
        const user = req.session.user
        if(!user){
            return res.status(401).json({
                success : false,
                message : "Please Login first"
            })   
        }
        const {productId, variantId} = req.body
        
        const wishlist = await Wishlist.findOne({userId : user.id})
        
        if(!wishlist || !Array.isArray(wishlist.items) ){
            return res.status(400).json({
                success : false,
                message : "Wishlist is empty"
            })
        }

        const itemIndex = wishlist.items.findIndex(item=>
            item.productId.toString() === productId && item.variantId === variantId
        )

        wishlist.items.splice(itemIndex,1)
        await wishlist.save()
        return res.status(200).json({
            success : true,
            message : "Product removed successfully"
        })
    } catch (error) {
        console.error("Error from removeProduct :",error)
        return res.status(500).json({
            success : false,
            message : "Server error"
        })
    }
}

export {
    wishListLoad,
    toggleItem,
    removeProduct
}