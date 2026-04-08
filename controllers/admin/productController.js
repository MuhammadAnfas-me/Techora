import Product from '../../models/productModel.js'
import { Categories } from '../../models/categoryModel.js'
import mongoose from 'mongoose'
import { Wishlist } from '../../models/wishListModel.js'


const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const loadProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const brand = (req.query.brand || "").trim();
    const category = (req.query.category || "").trim();

    const filter = {};

    if (search) {
      filter.name = { $regex: escapeRegex(search), $options: "i" };
    }

    if (category) filter.categoryId = category;
    if (brand) filter.brand = brand;

    const categories = await Categories.find();
    let products = await Product.find(filter)
      .populate("categoryId", "name")
      .sort({ createdAt: -1 });

    // filter by TOTAL stock
    if (status) {
      products = products.filter((product) => {
        const totalStock = (product.variants || []).reduce((sum, variant) => {
          return sum + (Number(variant.stock) || 0);
        }, 0);

        if (status === "In Stock") return totalStock > 15;
        if (status === "Low Stock") return totalStock > 0 && totalStock < 15;
        if (status === "Out of Stock") return totalStock === 0;

        return true;
      });
    }

    const total = products.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    products = products.slice(skip, skip + limit);

    return res.render("Admin/products/productList", {
      currentPage: "products",
      products,
      categories,
      totalPages,
      total,
      page,
      selectedCategory : category,
      selectedBrand : brand,
      selectedStockStatus : status,
      search : search
    });
  } catch (error) {
    console.error("Error from loadProducts",error.message)
    return res.status(500).json({
      success : false,
      message : "Failed to load products"
    })
  }
}

const loadAddPage = async (req, res) => {
  const categories = await Categories.find({isActive : true})
  res.render('Admin/products/addPage', { currentPage: 'products', categories })
}

const addProduct = async (req, res) => {
  try {
    let {
      name,
      categoryId,
      brand,
      status,
      shortDescription,
      fullDescription,
      specifications,
      variants,
      imageMap
    } = req.body


    if (!name?.trim()) {
      return res.status(400).json({ message: 'Product name is required' })
    }

    if (!categoryId?.trim()) {
      return res.status(400).json({ message: 'Category is required' })
    }

    if (!brand?.trim()) {
      return res.status(400).json({ message: 'Brand is required' })
    }
    name = name?.trim()
    const existingName = await Product.findOne({
      name : { $regex: `^${name}$`, $options: 'i' }  
    })
    if(existingName){
      return res.status(400).json({
        success : false,
        message : "Product name already exist"
      })
    }
    let parsedSpecifications = []
    let parsedVariants = []
    let parsedImageMap = []

    try {
      parsedSpecifications = specifications ? JSON.parse(specifications) : []
    } catch {
      return res.status(400).json({ message: 'Invalid specifications data' })
    }

    try {
      parsedVariants = variants ? JSON.parse(variants) : []
    } catch {
      return res.status(400).json({ message: 'Invalid variants data' })
    }

    try {
      parsedImageMap = imageMap ? JSON.parse(imageMap) : []
    } catch {
      return res.status(400).json({ message: 'Invalid image map data' })
    }

    if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
      return res
        .status(400)
        .json({ message: 'At least one variant is required' })
    }

    for (let i = 0; i < parsedVariants.length; i++) {
      const v = parsedVariants[i]

      if (!v?.sku?.trim()) {
        return res
          .status(400)
          .json({ message: `Variant ${i + 1}: SKU is required` })
      }

      if (v.price === '' || Number(v.price) < 0) {
        return res
          .status(400)
          .json({ message: `Variant ${i + 1}: Enter valid price` })
      }

      if (v.stock === '' || Number(v.stock) < 0) {
        return res
          .status(400)
          .json({ message: `Variant ${i + 1}: Enter valid stock` })
      }
    }

    const uploadedFiles = req.files?.variantImages || []

    // create empty image arrays for each variant
    const variantImageBuckets = parsedVariants.map(() => [])

    // assign uploaded files to correct variant using imageMap
    uploadedFiles.forEach((file, index) => {
      const variantIndex = Number(parsedImageMap[index])

      if (
        Number.isNaN(variantIndex) ||
        variantIndex < 0 ||
        variantIndex >= parsedVariants.length
      ) {
        return
      }

      variantImageBuckets[variantIndex].push(file.path)
    })

    const finalVariants = parsedVariants.map((variant, index) => ({
      sku: variant.sku.trim(),
      price: Number(variant.price),
      color : variant.color,
      colorCode : variant.colorCode,
      stock: Number(variant.stock),
      status: variant.status || 'Active',
      image: variantImageBuckets[index]
    }))
    const product = new Product({
      name: name.trim(),
      categoryId,
      brand: brand.trim(),
      status: status || 'active',
      shortDescription: shortDescription?.trim() || '',
      fullDescription: fullDescription?.trim() || '',
      specifications: Array.isArray(parsedSpecifications)
        ? parsedSpecifications
        : [],
      variants: finalVariants
    })

    await product.save()

    return res.status(201).json({
      success: true,
      message: 'Product added successfully'
    })
  } catch (error) {
    console.error('addProduct error:', error)
    return res.status(500).json({
      message: 'Failed to add product'
    })
  }
}

const variantLoad = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const product = await Product.findById(req.params.id).populate("categoryId", "name");
    if (!product) return res.status(404).send("Product not found");

    const total = product.variants?.length || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    product.variants = (product.variants || []).slice(skip, skip + limit);

    res.render("Admin/products/variantsList.ejs", {
      currentPage: "products",
      product,
      totalPages,
      page,
      total
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const loadEdit = async (req, res) => {
  const id = req.params.id

  const [product , categories] = await Promise.all([
    Product.findById(id),
    Categories.find({isActive : true})
  ])
  res.render('Admin/products/editPage.ejs', {
    currentPage: 'products',
    product,
    categories
  })
}

const editProduct = async (req, res) => {
  try {
    const id = req.params.id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product Id'
      })
    }

    const product = await Product.findById(id)
    if (!product) {
      return res.status(400).json({
        success: false,
        message: 'Product not found'
      })
    }

    
    let {
      name,
      categoryId,
      brand,
      status,
      shortDescription,
      fullDescription,
      specifications,
      variants
    } = req.body
    
    name = name?.trim()
    const existingName = await Product.findOne({
      _id: { $ne: id },
      name : { $regex: `^${name}$`, $options: 'i' }  
    })
    if(existingName){
      return res.status(400).json({
        success : false,
        message : "Product name already exist"
      })
    }

    product.name = String(name || '').trim()
    product.categoryId = categoryId
    product.brand = String(brand || '').trim()
    product.status = String(status || '').trim()
    product.shortDescription = String(shortDescription || '').trim()
    product.fullDescription = String(fullDescription || '').trim()

    let parsedSpecifications = []
    if (specifications) {
      try {
        const specs = JSON.parse(specifications)
        if (Array.isArray(specs)) {
          parsedSpecifications = specs
            .map(item => ({
              label: String(item.label || '').trim(),
              value: String(item.value || ' ').trim()
            }))
            .filter(item => item.label && item.value)
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid specification format'
        })
      }
    }
    product.specifications = parsedSpecifications

    // VAIANTS PARSE)

    let parsedVariants = []
    if (variants) {
      try {
        const vars = JSON.parse(variants)
        if (Array.isArray(vars)) {
          parsedVariants = vars
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'invalid variants format'
        })
      }
    }
    // -----------------------------
    // COLLECT UPLOADED VARIANT IMAGES
    // req.files comes from uploadProductImage.any()
    // -----------------------------
    const files = Array.isArray(req.files) ? req.files : []

    const variantImageMap = {}

    files.forEach(file => {
      if (file.fieldname.startsWith('variantImages_')) {
        const index = Number(file.fieldname.split('_')[1])

        if (!Number.isNaN(index)) {
          if (!variantImageMap[index]) variantImageMap[index] = []

          variantImageMap[index].push(file.path)
          // if using CloudinaryStorage:
          // file.path = url
          // file.filename = publicId
        }
      }
    })

    // -----------------------------
    // REBUILD VARIANTS
    // -----------------------------
    const updatedVariants = parsedVariants.map((variant, index) => {
      const oldVariant = product.variants?.[index] || {}
      const newImages = variantImageMap[index] || []

      return {
       
        color : variant.color || "",
        colorCode : variant.colorCode || "#0000",
        price: Number(variant.price || 0),
        stock: Number(variant.stock || 0),
        varientId : oldVariant.varientId,
        sku: String(variant.sku),
        // keep old string images sent from frontend + add new uploaded ones
        image: [
          ...(Array.isArray(variant.image) ? variant.image : []).filter(
            img => typeof img === 'string' && img.trim()
          ),
          ...newImages
        ]
      }
    })

    product.variants = updatedVariants

    await product.save()

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    })
  } catch (error) {
    console.error('editProduct error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    })
  }
}

const blockProduct = async (req,res)=>{
  try {
  const productId = req.params.id
  const product = await Product.findOne({_id : productId})
  if(!product) return res.status(400).json({success : false , message : "Product not found"})

    if(product.status == "active"){
      product.status = "inactive"
    }else{
      product.status = "active"
    }

    await product.save()
  return res.status(200).json({
    success : true,
    message : `Product ${product.status === "active" ? "unblocked" : "blocked"} successfully`
  })
  } catch (error) {
    console.log("Error from blockCategory :",error)
    return res.status(500).json({
      success : false,
      message : "Server error"
    })
  }
  
}

const deleteVariant = async (req, res) => {
  try {
    const variantId = req.params.id;

    const product = await Product.findOne({ "variants.varientId": variantId });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Variant not found"
      });
    }

    if (product.variants.length === 1) {
      return res.status(400).json({
        success: false,
        message: "At least one variant is required"
      });
    }

    product.variants = product.variants.filter(
      (variant) => variant.varientId !== variantId
    );

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Variant deleted successfully"
    });
  } catch (error) {
    console.log("Error from deleteVariant:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export {
  loadProducts,
  loadAddPage,
  addProduct,
  variantLoad,
  loadEdit,
  editProduct,
  blockProduct,
  deleteVariant
}
