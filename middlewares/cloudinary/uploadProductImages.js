import multer from "multer"
import { CloudinaryStorage } from "multer-storage-cloudinary"
import cloudinary from "../../config/cloudinary.js"

const storage = new CloudinaryStorage({
    cloudinary,
    params : {
        folder : "techora/Product-Images",
        allowed_formats : ["jpg","jpeg","png","webp"],
        transformation : [{width :900, height : 900, crop : "fit" }]
    }
})

const uploadProductImage =  multer({ storage })
export default uploadProductImage