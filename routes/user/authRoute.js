import express from 'express'
import passport from 'passport'
const router = express.Router()

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res)=>{
    req.session.user = {
      userId : req.user.userId
    }
    res.redirect("/")
  }
)

export default router
