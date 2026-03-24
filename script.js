import express from "express"
import userRoute from "./routes/user/userRoute.js"
import authRoute from "./routes/user/authRoute.js"
import adminRoute from "./routes/admin/adminRoute.js"
import connectDB from "./config/connect.js"
import session from "express-session"
import flash from "connect-flash"
import passport from "passport"
import nocache from "nocache"
import "./config/passport.js"
import { setUser } from "./middlewares/user/auth.js"


const PORT = process.env.PORT
const app = express()


app.set("view engine","ejs")
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(
    session({
        secret : process.env.SESSION_SECRET,
        resave : false,
        saveUninitialized : true,
        cookie : {
            maxAge : 1000*60*60*24
        }
    })
)
app.use(nocache())
app.use(passport.initialize())
app.use(passport.session())
app.use(setUser)

app.use(flash())
app.use((req, res, next) => {
  res.locals.message = req.flash()
  next()
})
app.use("/auth",authRoute)
app.use("/",userRoute)
app.use("/admin",adminRoute)


connectDB()
app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`))