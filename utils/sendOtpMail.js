import nodeMailer from 'nodemailer'
import bcrypt from 'bcrypt'
import { generateOtp } from '../services/authService/emailVerify.js'

const sendOtpMail = async (reciverEmail, otp, name) => {
  const transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAILER_USER,
      pass: process.env.MAILER_PASS
    }
  })

  await transporter.sendMail({
    from: `"Techora" <anfasmuhammadkclm@gmail.com>`,
    to: reciverEmail,
    subject: 'Verify Your Account',
    html: otpTemplate(otp, name)
  })
  console.log('Email sended')
}

const otpTemplate = (otp, name) => {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#f4f6f8; font-family: Arial, sans-serif;">
    <div style="max-width:520px; margin:40px auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
      
      <!-- Header -->
      <div style="background:#1B3C53; padding:20px; text-align:center;">
        <h1 style="margin:0; color:#ffffff; font-size:22px; letter-spacing:1px;">
          Techora
        </h1>
      </div>

      <!-- Body -->
      <div style="padding:30px; color:#333;">
        <p style="margin-top:0;">Hi ${name},</p>

        <p>
          We received a request to verify your Techora account.
          Please use the one-time verification code below:
        </p>

        <!-- OTP Box -->
        <div style="margin:30px 0; text-align:center;">
          <span style="
            display:inline-block;
            padding:15px 30px;
            font-size:28px;
            letter-spacing:6px;
            color:#1B3C53;
            background:#eef3f6;
            border-radius:8px;
            font-weight:bold;
          ">
            ${otp}
          </span>
        </div>

        <p style="font-size:14px; color:#555;">
          This OTP is valid for 1 minute.  
          Do not share this code with anyone.
        </p>

        <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">

        <p style="font-size:12px; color:#888;">
          If you did not request this verification, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f0f3f6; padding:15px; text-align:center;">
        <p style="margin:0; font-size:12px; color:#1B3C53;">
          © ${new Date().getFullYear()} Techora. All rights reserved.
        </p>
      </div>

    </div>
  </body>
</html>
  `
}

export const sendOtp = async ({ model, email, expiryTime, name }) => {
  const otp = generateOtp()
  const hashedOtp = await bcrypt.hash(otp, 10)

  const updateData = {
    otp: hashedOtp,
    otpExpiresAt: new Date(Date.now() + expiryTime * 60 * 1000),
    otpAttempts: 0
  }

  // Only refresh signupExpiresAt if this is the User model and they are unverified
  if (model.modelName === 'User') {
    const user = await model.findOne({ email })
    if (user && !user.isVerified) {
      updateData.signupExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
    }
  }
  
  await model.updateOne({email}, updateData)
  await sendOtpMail(email, otp, name)
}
export default sendOtpMail
