import express from "express"
import userRoute from "./routes/user/userRoute.js"
import authRoute from "./routes/user/authRoute.js"
import adminRoute from "./routes/admin/adminRoute.js"
import connectDB from "./config/connect.js"
import session from "express-session"
import passport from "passport"
import nocache from "nocache"
import { setUser } from "./middlewares/user/auth.js"


const PORT = process.env.PORT
const app = express()


app.set("view engine","ejs")
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(
    session({
        secret : "my_secret_code",
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


import "./config/passport.js"
app.use("/auth",authRoute)
app.use("/",userRoute)
app.use("/admin",adminRoute)


connectDB()
app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`))