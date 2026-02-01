import dotenv from "dotenv"
dotenv.config({path : "./.env"})

import express from "express"
import  userRoute from "./routes/userRoute.js"
import connectDB from "./config/connect.js"
import session from "express-session"
const PORT = process.env.PORT
const app = express()


app.set("views")
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


app.use("/",userRoute)



connectDB()
app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`))