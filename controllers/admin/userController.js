import {User} from "../../models/userModel.js"
import formatDateForInput from "../../services/dateFormat.js"

const userList = async(req,res)=>{
    const users = await User.find().limit(5)
    res.render("Admin/users.ejs",{users})
}

export {
    userList
}