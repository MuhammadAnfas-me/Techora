import passport from 'passport'

export const googleAuthCallback =  (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.log(err)
      req.session.errorMessage = 'Something went wrong'
      return res.redirect('/login')
    }

    if (!user) {
      req.session.errorMessage = info?.message || 'Google authentication failed'
      return res.redirect('/login')
    }

    req.logIn(user, err => {
      if (err) {
        req.session.errorMessage = 'Login failed'
        return res.redirect('/login')
      }

      req.session.user = {
        userId: user.userId,
        id: user._id,
        email: user.email,
        number: user?.number
      }

      return res.redirect('/')
    })
  })(req, res, next)
}

export const googleAuth = (req, res, next) => {
    if (req.query.code) {
      req.session.referralCode = req.query.code
    }
    next()
  }