import  passport from "passport";
import {Strategy as GoogleStrategy} from "passport-google-oauth20"
import {User} from "../models/userModel.js"
import generateUserId from "../utils/generateUserId.js";


passport.use(
    new GoogleStrategy(
        {
            clientID : process.env.GOOGLE_CLIENT_ID,
            clientSecret : process.env.GOOGLE_CLIENT_SECRET,
            callbackURL : '/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done)=>{
            try {
                let user = await User.findOne({
                    $or : [{googleId : profile.id},{email:profile.emails[0].value}]
                })
               
                if(!user){
                    const userId = generateUserId()
                    user = await User.create({
                        userId,
                        fullName : profile.displayName,
                        email : profile.emails[0].value,
                        googleId : profile.id,
                        profileImage : process.env.DEFAULT_IMAGE,
                        isVerified : true
                    })
                }else{
                    if(!user.googleId) user.googleId = profile.id
                    if(!user.isVerified) user.isVerified = true
                    if(!user.profileImage){
                        user.profileImage = process.env.DEFAULT_IMAGE
                    } 
                    await user.save()
                }
                return done(null,user)
            } catch (error) {
                return done(error,null)
            }
        }
    )
)

passport.serializeUser((user,done)=>done(null,user.id))

passport.deserializeUser(async (id ,done)=>{
    try {
        const user = await User.findById(id)
        done(null,user)
    } catch (error) {
        done(err,null)
    }
})

export default passport