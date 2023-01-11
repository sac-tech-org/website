import type { NextApiRequest, NextApiResponse } from 'next'
import nodemailer from 'nodemailer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(400);
  };
  const transporter = nodemailer.createTransport({
    port: Number(process.env.SMTP_PORT),
    host: process.env.SMTP_HOST,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    secure: true,
  })

  try {
    await new Promise<void>((resolve, reject) => transporter.verify((error) => {
      if (error) {
        reject(error);
        return;
      } else {
        resolve();
      }
    }))

    const mailData = {
      from: process.env.SMTP_USER,
      to: req.body.email,
      subject: `Invitation to the SacTech Slack`,
      text: "Testing",
      html: `<div>This is a test</div>`
    }

    await new Promise((resolve, reject) => {
      transporter.sendMail(mailData, (err, info) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(info)
      })
    });
    return res.status(200).json({message: "Success"});

  } catch (e) {
    console.error(e);
    return res.status(500).json({message: "Error"});;
  }
}
