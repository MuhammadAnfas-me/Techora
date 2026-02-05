const checkAuth = (req, res, next)=>{
    if(req.session.user || req.user){
        next()
    }else{
        res.redirect("/login")
    }
}

const isLogged = (req, res, next)=>{
    if(req.session.user || req.user){
        res.redirect("/")
    }else{
        next()
    }
}
export {checkAuth , isLogged}