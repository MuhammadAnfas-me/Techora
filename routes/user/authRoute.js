import express from 'express'
import passport from 'passport'
const router = express.Router()

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      req.session.errorMessage = "Something went wrong";
      return res.redirect('/login');
    }

    if (!user) {
      req.session.errorMessage = info?.message || "Google authentication failed";
      return res.redirect('/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        req.session.errorMessage = "Login failed";
        return res.redirect('/login');
      }

      req.session.user = {
        userId: user.userId
      };

      return res.redirect('/');
    });
  })(req, res, next);
});

export default router
