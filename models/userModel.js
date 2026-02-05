import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim : true,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: function(){
        return !this.googleId
      }
    },
    profileImage: {
      type: String,
      default: ''
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    number: {
      type: Number
    },
    dob: {
      type: Date
    },
    gender: {
      type: String,
    },
    country: {
      type: String
    },
    reffrelCode: {
      type: String
    },
    totalReferce: {
      type: Number
    },
    succesFullReference: {
      type: Number
    },
    isVerified :{
      type : Boolean,
      default : false,
    },
    otp : {
      type : String,
    },
    otpExpiresAt :{
      type : Date
    },
    googleId : {
      type : String,
      unique : true,
      sparse : true
    },
    resetToken : {
      type : String, 
    },
    resetTokenExpiry :{
      type : String
    }
    

  },
  { timestamps: true }
)

export const User = mongoose.model("User", userSchema)

