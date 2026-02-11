import {User} from "../../models/userModel.js"
import formatDateForInput from "../../services/dateFormat.js"

const userList = async(req,res)=>{

    try {
        const page = parseInt(req.query.page) || 1
        const limit = 5
        const skip = (page-1)*limit

        const search = (req.query.search || "").trim()
        const role = (req.query.role || "").trim()
        const status = (req.query.status || "").trim()

        const filter = {}

        if(search){
            filter.$or = [
                {fullName : {$regex : search,$options : "i"} },
                {email : {$regex : search,$options : "i"}}
            ]
        }

        if(role) filter.role = role

        if(status === "Active") filter.isBlocked = false
        if(status === "Blocked") filter.isBlocked = true 

        const totalUsers = await User.countDocuments(filter)
        const totalPages = Math.ceil(totalUsers/limit)

        const users = await User.find(filter).sort({updateAt : -1}).skip(skip).limit(limit)

        res.render("Admin/users.ejs",{
            users,
            page,
            totalUsers,
            totalPages,
            filter : {search,role,status}
        })
    } catch (err) {
        console.error(err)
        return
    }
}

const blockUser = async (req, res) => {
  console.log("call reached")
  try {
    const id = req.params.id;

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Toggle block status
    user.isBlocked = !user.isBlocked;

    await user.save();

    res.json({
      success: true,
      message: user.isBlocked ? "User blocked" : "User unblocked"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};




export {
    userList,
    blockUser
}