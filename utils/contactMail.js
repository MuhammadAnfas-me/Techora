import nodemailer from "nodemailer";

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAILER_USER,
      pass: process.env.MAILER_PASS
    }
  })



export async function sendContactMail({ name, email, phone, subject, message }) {
  await transporter.sendMail({
    from: `"${name}" <${process.env.MAILER_USER}>`,
    to: process.env.MAILER_USER, // you receive it
    subject: `Contact: ${subject}`,
    text: `
Name: ${name}
Email: ${email}
Phone: ${phone}

Message:
${message}
    `,
  });
}