import mongoose from 'mongoose'

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balance : {
    type : Number,
    min : 0,
    default : 0
  },
  transaction : [
    {
        txnId : String,
        type : {
            type : String,
            enum : ["debit","credit"]
        },
        description : String,
        amount : Number,
        date : {
            type : Date,
            default : Date.now
        }
    }
  ]
},{timestamps : true})


export const Wallet = mongoose.model('Wallet',walletSchema)