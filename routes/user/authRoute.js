import express from 'express'
import passport from 'passport'
const router = express.Router()

import { googleAuthCallback ,googleAuth} from '../../controllers/admin/googleAuthController.js'

router.get(
  '/google',
  googleAuth,
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/google/callback',googleAuthCallback)

export default router
