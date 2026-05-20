import bycrpt from "bcrypt"
import { User } from '../../models/userModel.js'

const loginLoad = (req, res) => {
  res.render('Admin/login.ejs')
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing credentials'
      })
    }

    const admin = await User.findOne({ email, role: 'Admin' })

    if (!admin)
      return res
        .status(400)
        .json({ success: false, message: 'Invalid Credential' })

    if(admin.isBlocked) return res.status(400).json({success : true , message : "Account is blocked"})
    const isMatch = await bycrpt.compare(password , admin.password)
    if(!isMatch)return res.status(400).json({success : false , message : "Password do not match"})

        req.session.admin = {
            id : admin._id,
            email : admin.email
        }

    return res.json({
      success: true,
      message: 'Logined Successfully'
    })
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to login' })
  }
}

const logout =(req,res)=>{
    delete req.session.admin

    req.session.save((err)=>{
      if(err){
        console.log(err)
      }
      res.redirect("/admin/login")
    })
}

export { loginLoad, login ,logout}
