import Product from '../../models/productModel.js'
import { Categories } from '../../models/categoryModel.js'
import { Cart } from '../../models/cartModel.js'
import { Offers } from '../../models/offerModel.js'
import { Wishlist } from '../../models/wishListModel.js'
import { getDiscountAmount } from '../../utils/offer.js'
import { Review } from '../../models/reviewModel.js'

// ─────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────


export const getActiveOffers = async () => {
  const now = new Date()
  return Offers.find({
    isActive: true,
    start: { $lte: now },
    end: { $gte: now }
  }).lean()
}


export const applyBestOfferToProduct = (product, offers) => {
  if (!product.variants || product.variants.length === 0) return

  const variant = product.variants[0]

  let bestOffer = null
  let maxDiscount = 0

  for (const offer of offers) {
    if (!offer.isActive) continue

    const productMatch =
      offer.scope === 'product' &&
      offer.product?.toString() === product._id.toString()

    const categoryMatch =
      offer.scope === 'category' &&
      offer.category?.toString() ===
        (product.categoryId?._id || product.categoryId)?.toString()

    if (productMatch || categoryMatch) {
      const discount = getDiscountAmount(offer, variant.price)
      if (discount > maxDiscount) {
        maxDiscount = discount
        bestOffer = offer
      }
    }
  }

  let discountAmount = 0
  if (bestOffer) {
    discountAmount = Math.min(
      getDiscountAmount(bestOffer, variant.price),
      variant.price
    )
  }

  // Keep original price intact
  variant.originalPrice = variant.price
  variant.offerPrice = Math.max(1, Math.round(variant.price - discountAmount))
  product.offer = bestOffer
}

export const applyBestOfferToAllVariants = (product, offers) => {
  let bestOffer = null
  let maxDiscount = 0

  for (const offer of offers) {
    if (!offer.isActive) continue

    const productMatch =
      offer.scope === 'product' &&
      offer.product?.toString() === product._id.toString()

    const categoryMatch =
      offer.scope === 'category' &&
      offer.category?.toString() === product.categoryId?.toString()

    if (productMatch || categoryMatch) {
      const discount = getDiscountAmount(offer, product.variants[0].price)
      if (discount > maxDiscount) {
        maxDiscount = discount
        bestOffer = offer
      }
    }
  }

  product.variants.forEach(variant => {
    let finalPrice = variant.price
    if (bestOffer) {
      const discountAmount = getDiscountAmount(bestOffer, variant.price)
      finalPrice = variant.price - discountAmount
    }
    variant.originalPrice = variant.price
    variant.offerPrice = Math.max(1, Math.round(finalPrice))
  })

  product.offer = bestOffer
}


export const getWishlistIds = async userId => {
  if (!userId) return []
  const wishList = await Wishlist.findOne({ userId })
  if (!wishList || !Array.isArray(wishList.items)) return []
  return wishList.items.map(item => ({
    productId: item.productId.toString(),
    variantId: item.variantId || ''
  }))
}

// ─────────────────────────────────────────────
//  Products list service
// ─────────────────────────────────────────────


export const getProductsListData = async (query, userId) => {
  let { category, brand, sort, minPrice, maxPrice, page, search } = query

  page = parseInt(page) || 1
  const limit = 9
  const skip = (page - 1) * limit

  const selectedCategory = category
    ? Array.isArray(category)
      ? category
      : [category]
    : []

  const selectedBrands = brand ? (Array.isArray(brand) ? brand : [brand]) : []

  // ── Get Active Categories ──────────────────
  const activeCategories = await Categories.find({ isActive: true }).select('_id');
  const activeCategoryIds = activeCategories.map(cat => cat._id);

  // ── Build filter ──────────────────────────────
  const filter = { status: 'active' };

  if (selectedCategory.length) {
    // Only allow categories that are both selected and active
    const filteredCategories = selectedCategory.filter(id => 
      activeCategoryIds.some(activeId => activeId.toString() === id)
    );
    filter.categoryId = { $in: filteredCategories };
  } else {
    // Default: Only show products from active categories
    filter.categoryId = { $in: activeCategoryIds };
  }
  
  if (selectedBrands.length) filter.brand = { $in: selectedBrands };

  if (minPrice || maxPrice) {
    filter['variants.0.price'] = {}
    if (minPrice) filter['variants.0.price'].$gte = Number(minPrice)
    if (maxPrice) filter['variants.0.price'].$lte = Number(maxPrice)
  }

  if (search && search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { brand: { $regex: search.trim(), $options: 'i' } },
      { shortDescription: { $regex: search.trim(), $options: 'i' } }
    ]
  }

  // ── Build sort ────────────────────────────────
  let sortOption = { createdAt: -1 }
  if (sort === 'priceLowToHigh') sortOption = { 'variants.0.price': 1 }
  if (sort === 'priceHighToLow') sortOption = { 'variants.0.price': -1 }
  if (sort === 'newest') sortOption = { createdAt: -1 }
  if (sort === 'nameAZ') sortOption = { name: 1 }

  // ── Fetch in parallel ─────────────────────────
  const [products, totalProducts, categories, brands] = await Promise.all([
    Product.find(filter)
      .populate('categoryId')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
    Categories.find({ isActive: true }).lean(),
    Product.distinct('brand', { status: 'active', categoryId: { $in: activeCategoryIds }, brand: { $ne: '' } })
  ])

  const totalPages = Math.ceil(totalProducts / limit)

  // ── Apply offers ──────────────────────────────
  const offers = await getActiveOffers()
  products.forEach(product => applyBestOfferToProduct(product, offers))
  for (let product of products) {
    const reviews = await Review.find({ productId: product._id })

    const total = reviews.reduce((sum, r) => sum + r.rating, 0)
    const avg = reviews.length ? total / reviews.length : 0

    product.avgRating = avg
    product.reviewCount = reviews.length
  }

  // ── Wishlist ──────────────────────────────────
  const wishListIds = await getWishlistIds(userId)

  return {
    products,
    totalProducts,
    totalPages,
    categories,
    brands,
    selectedCategory,
    selectedBrands,
    selectedSort: sort || '',
    minPrice: minPrice || '',
    maxPrice: maxPrice || '',
    currentPage: page,
    search: search || '',
    wishListIds,
  }
}

// ─────────────────────────────────────────────
//  Product detail service
// ─────────────────────────────────────────────


export const getProductDetailData = async (productName, userId) => {
  const product = await Product.findOne({ name: productName }).populate('categoryId').lean()
  if (!product || !product.categoryId || !product.categoryId.isActive) return null
    
    const productReviews = await Review.find({ productId: product._id })
    .populate('userId', 'fullName profileImage')
    .sort({ createdAt: -1 });
    
    const total = productReviews.reduce((sum, r) => sum + r.rating, 0)
    const avg = productReviews.length ? total / productReviews.length : 0

    product.avgRating = avg
    product.reviewCount = productReviews.length

  const [activeCategories, offers] = await Promise.all([
    Categories.find({ isActive: true }).select('_id'),
    getActiveOffers()
  ])
  const activeCategoryIds = activeCategories.map(cat => cat._id.toString());

  const relatedItems = await Product.find({ 
    categoryId: { $in: activeCategoryIds }, 
    status: 'active',
    _id: { $ne: product._id } 
  })
    .limit(4)
    .lean();

  applyBestOfferToAllVariants(product, offers)

  const wishListIds = await getWishlistIds(userId)
    for (let product of relatedItems) {
    const reviews = await Review.find({ productId: product._id })

    const total = reviews.reduce((sum, r) => sum + r.rating, 0)
    const avg = reviews.length ? total / reviews.length : 0

    product.avgRating = avg
    product.reviewCount = reviews.length
  }


  let cart = null
  if (userId) {
    cart = await Cart.findOne({ userId })
  }

  return { product, relatedItems, wishListIds, cart ,productReviews}
}
