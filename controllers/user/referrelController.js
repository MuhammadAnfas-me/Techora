import { User } from "../../models/userModel.js"

export const referralLoad = async (req,res)=>{
    try {
        const user = req.session.user
        if(!user){
            res.redirect("/")
        }
        const userDetails = await User.findOne({_id : user.id})
        
        res.render("User/userProfile/referral.ejs",{
            totalReferrals : userDetails ? userDetails.totalReference :  null,
            successfulReferrals :  null,
            totalRewards : userDetails ? userDetails.totalReference * 100 : null  ,
            code : userDetails.referralCode
        })
    } catch (error) {
        console.log("Error from referralLoad :",error)
    }
}

export const checkReferral = async (req, res) => {
  const { code } = req.body;

  const user = await User.findOne({ referralCode: code });

  if (user) {
    return res.json({ valid: true });
  } else {
    return res.json({ valid: false });
  }
};