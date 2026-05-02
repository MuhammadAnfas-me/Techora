import  passport from "passport";
import {Strategy as GoogleStrategy} from "passport-google-oauth20"
import {User} from "../models/userModel.js"
import generateUserId from "../utils/generateUserId.js";
import generateReferralCode from "../utils/referral.js";
import { Wallet } from "../models/walletModel.js";
import { generateTxnId } from "../utils/generateTxnId.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://qxsmm2fx-3000.inc1.devtunnels.ms/auth/google/callback",
      passReqToCallback: true // ✅ IMPORTANT
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // ✅ Now you can access session
        const code = req.session.referralCode;
        let referredUser = null;

        if (code) {
          referredUser = await User.findOne({ referralCode: code });
        }

        let user = await User.findOne({
          $or: [
            { googleId: profile.id },
            { email: profile.emails[0].value }
          ]
        });

        if (user && user.role === "Admin") {
          return done(null, false, {
            message: "This email is already registered with admin."
          });
        }

        // ✅ New user
        if (!user) {
          const userId = generateUserId();

          user = new User({
            userId,
            fullName: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            profileImage: process.env.DEFAULT_IMAGE,
            role: "Customer",
            isVerified: true,
            referralCode: generateReferralCode()
          });

          await user.save();

          // 🎁 Apply referral logic HERE
          let newWallet = new Wallet({
            userId: user._id,
            balance: 0,
            transaction: []
          });

          if (referredUser) {
            // New user reward
            newWallet.balance = 50;
            newWallet.transaction.push({
              txnId: generateTxnId(),
              type: "credit",
              description: "Referral reward",
              amount: 50,
              date: new Date()
            });

            // Referrer reward
            let wallet = await Wallet.findOne({ userId: referredUser._id });

            if (!wallet) {
              wallet = new Wallet({
                userId: referredUser._id,
                balance: 0,
                transaction: []
              });
            }

            wallet.balance += 100;
            wallet.transaction.push({
              txnId: generateTxnId(),
              type: "credit",
              description: `Referral reward by ${profile.displayName}`,
              amount: 100,
              date: new Date()
            });

            referredUser.totalReference += 1;

            await wallet.save();
            await referredUser.save();
          }

          await newWallet.save();
        } else {
          // Existing user update
          if (!user.googleId) user.googleId = profile.id;
          if (!user.isVerified) user.isVerified = true;
          if (!user.profileImage) {
            user.profileImage = process.env.DEFAULT_IMAGE;
          }

          await user.save();
        }

        // ✅ Clear referral after use
        req.session.referralCode = null;

        return done(null, user);

      } catch (error) {
        return done(error, null);
      }
    }
  )
);

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