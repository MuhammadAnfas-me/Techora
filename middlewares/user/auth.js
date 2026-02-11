import { User } from "../../models/userModel.js"

const checkAuth = (req, res, next)=>{
    if(req.session?.user || req?.user){
        next()
    }else{
        res.redirect("/login")
    }
}

const isLogged = (req, res, next)=>{
    if(req.session?.user || req?.user){
        res.redirect("/")
    }else{
        next()
    }
}

const isBlocked = async (req,res,next)=>{
    if(req.session?.user?.userId){
        const userId = req.session?.user?.userId
        const user = await User.findOne({userId})
        if(user.isBlocked){
            res.redirect("/login?blocked=true")
            req.session.destroy()
        }else{
            next()
        }
    }
}

const setUser = async (req,res,next)=>{
    try {
        if (req.session?.user?.userId) {
        const user = await User.findOne({ userId: req.session.user.userId })
          .select("-password");
    
        res.locals.user = user;
      } else {
        res.locals.user = null;
      }
      next()
        
    } catch (error) {
        console.error(error)
        res.redirect("/admin/login")
    }
}
export {checkAuth , isLogged, setUser , isBlocked}