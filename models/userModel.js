import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
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
    dateOfBirth: {
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
    otpAttemps : {
      type : Number,
      default : 0
    },
    

  },
  { timestamps: true }
)

export const User = mongoose.model("User", userSchema)

