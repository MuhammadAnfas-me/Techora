

const productsList = (req,res)=>{
    const user = req.session?.user
    res.render("User/products/productPage",{name : user.name ,email : user.email} )
}

export {
    productsList
}