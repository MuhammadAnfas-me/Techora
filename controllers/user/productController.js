import { getProductsListData, getProductDetailData } from '../../services/user/productService.js'



const productsList = async (req, res) => {
  try {
    const userId = req.session?.user?.id || null

    const data = await getProductsListData(req.query, userId)

    const isAjax =
      req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest'

    if (isAjax) {
      return res.json({
        success: true,
        products:      data.products,
        totalProducts: data.totalProducts,
        totalPages:    data.totalPages,
        wishListIds:   data.wishListIds,
        currentPage:   data.currentPage
      })
    }

    return res.render('User/products/productPage', {
      products:       data.products,
      category:       data.categories,
      brands:         data.brands,
      selectedCategory: data.selectedCategory,
      selectedBrands:   data.selectedBrands,
      selectedSort:     data.selectedSort,
      minPrice:         data.minPrice,
      maxPrice:         data.maxPrice,
      currentPage:      data.currentPage,
      totalPages:       data.totalPages,
      totalProducts:    data.totalProducts,
      search:           data.search,
      wishListIds:      data.wishListIds
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}



const productPage = async (req, res) => {
  try {
    const userId      = req.session?.user?.id || null
    const productName = req.params.productId

    const data = await getProductDetailData(productName, userId)

    if (!data) {
      return res.redirect("/products") 
    }

    return res.render('User/products/productDetails', {
      product:      data.product,
      relatedItems: data.relatedItems,
      cart:         data.cart,
      wishListIds:  data.wishListIds,
      reviews : data.productReviews
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}


export { productsList, productPage }