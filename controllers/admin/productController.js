const loadProducts = (req,res)=>{
    res.render("Admin/products/productList",{currentPage : "products"})
}


const loadAddPage = (req,res)=>{
    res.render("Admin/products/addPage",{currentPage : "products"})
}

const addProduct = (req,res)=>{
    console.log(req.body)
    return res.status(200).json({success : true , message : "Created successfully"})
}


export {
    loadProducts,
    loadAddPage,
    addProduct
}