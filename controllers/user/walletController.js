import crypto from 'crypto'
import { generateTxnId } from '../../utils/generateTxnId.js'
import { razorpayInstance } from '../../config/razorpay.js'
import { Wallet } from '../../models/walletModel.js'

export const loadWallet = async (req, res) => {
  try {
    const user = req.session.user

    let wallet = await Wallet.findOne({ userId: user.id })
    
    if (!wallet) {
      const newWallet = Wallet({
        userId: user.id,
        balance: 0
      })
      await newWallet.save()
      res.render('User/userProfile/walletPage.ejs', {
        wallet: newWallet,
        totalCredits : 0,
        totalDebits : 0
      })
    }
    
    const totalCredits = wallet?.transaction?.reduce((acc, trs) => {
      if (trs.type === 'credit') {
        acc = acc + trs.amount
      }
      return acc
    }, 0)

    const totalDebits = wallet?.transaction?.reduce((acc, trs) => {
      if (trs.type === 'debit') {
        acc = acc + trs.amount
      }
      return acc
    }, 0)
    res.render('User/userProfile/walletPage.ejs', {
      wallet,
      totalCredits,
      totalDebits
    })
  } catch (error) {
    console.log('Error from loadWallet :', error)
  }
}

export const createWalletOrder = async (req, res) => {
  try {
    const { amount } = req.body

    const order = await razorpayInstance.orders.create({
      amount: amount * 100,
      currency: 'INR'
    })

    res.json({
         success: true,
         order,
         key : process.env.RAZOR_KEY
         })
  } catch (err) {
    console.log(err)
  }
}

export const verifyWalletPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount
    } = req.body
    const user = req.session.user
    const body = razorpay_order_id + '|' + razorpay_payment_id

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZOR_SECRET)
      .update(body.toString())
      .digest('hex')

    if (expectedSignature === razorpay_signature) {
      const wallet = await Wallet.findOne({ userId: user.id })

      wallet.balance += Number(amount)

      // optional: transaction history
      wallet.transaction.push({
        txnId: generateTxnId(),
        type: 'credit',
        amount,
        description: 'Added via Razorpay'
      })

      await wallet.save()

      res.json({ success: true })
    } else {
      res.status(400).json({ success: false })
    }
  } catch (err) {
    console.log(err)
  }
}
