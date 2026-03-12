import Product from '../../models/productModel.js'
import { Categories } from '../../models/categoryModel.js'
import { Cart } from '../../models/cartModel.js';


const productsList = async (req,res)=>{
    try {
        const user = req.session.user 
        
    let { category, brand, sort, minPrice, maxPrice,page, search } = req.query;

    page = parseInt(page)||1
    const limit = 9
    const skip = (page-1)*limit
    const selectedCategory = category
      ? Array.isArray(category) ? category : [category]
      : [];

    const selectedBrands = brand
      ? Array.isArray(brand) ? brand : [brand]
      : [];

    const filter = { status: "active"  , "variants.stock" :{$gte : 1}};

    if (selectedCategory.length) {
      filter.categoryId = { $in: selectedCategory };
    }

    if (selectedBrands.length) {
      filter.brand = { $in: selectedBrands };
    }

    if (minPrice || maxPrice) {
      filter["variants.0.price"] = {};
      if (minPrice) filter["variants.0.price"].$gte = Number(minPrice);
      if (maxPrice) filter["variants.0.price"].$lte = Number(maxPrice);
    }

    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { brand: { $regex: search.trim(), $options: "i" } },
        { shortDescription: { $regex: search.trim(), $options: "i" } }
      ];
    }

    let sortOption = { createdAt: -1 };

    if (sort === "priceLowToHigh") sortOption = { "variants.0.price": 1 };
    if (sort === "priceHighToLow") sortOption = { "variants.0.price": -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };
    if (sort === "nameAZ") sortOption = { name: 1 };

    const [products, totalProducts, categories, brands] = await Promise.all([
      Product.find(filter)
        .populate("categoryId")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
      Categories.find({ isActive: true }).lean(),
      Product.distinct("brand", { status: "active", brand: { $ne: "" } })
    ]);

    const totalPages = Math.ceil(totalProducts/limit)

    res.render("User/products/productPage", {
      products,
      category: categories,
      brands,
      selectedCategory,
      selectedBrands,
      selectedSort: sort || "",
      minPrice: minPrice || "",
      maxPrice: maxPrice || "",
      currentPage : page,
      totalPages,
      search : search || ""
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error",error);
  } 
}

const productPage = async (req,res)=>{
  const user = req?.session?.user || ""
  const productName = req.params.productId
  const product = await Product.findOne({name : productName})
  const relatedItems = await Product.find({categoryId : product.categoryId , status : "active"}).limit(4)

  if(user){
    const cart = await Cart.findOne({userId : user.id})
    res.render("User/products/productDetails",{product,relatedItems,cart})
    return 
  }
  res.render("User/products/productDetails",{product,relatedItems,cart : null})
}

export {
    productsList,
    productPage
}