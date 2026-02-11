const checkAdminAuth = (req,res,next)=>{
    if(req.session.admin){
        next()
    }else{
        res.redirect("/admin/login")
    }
}

const isAdminLogged = (req,res,next) =>{
    if(req.session.admin){
        res.redirect("/admin/users")
    }else{
        next()
    }
}

export { 
    checkAdminAuth,
    isAdminLogged
}