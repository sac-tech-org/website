import type { NextApiRequest, NextApiResponse } from 'next'
import nodemailer from 'nodemailer';
import mjml2html from 'mjml'

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

    // https://mjml.io/try-it-live
    const htmlOutput = mjml2html(`
    <mjml>
    <mj-head>
      <mj-title>Invitation to SacTech Slack</mj-title>
      <mj-preview>Welcome! This is the invite to the SacTech Slack you requested.</mj-preview>
      <mj-attributes>
        <mj-all font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"></mj-all>
        <mj-text font-weight="400" font-size="16px" color="#000000" line-height="24px" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"></mj-text>
      </mj-attributes>
      <mj-style inline="inline">
        .body-section {
        -webkit-box-shadow: 1px 4px 11px 0px rgba(0, 0, 0, 0.15);
        -moz-box-shadow: 1px 4px 11px 0px rgba(0, 0, 0, 0.15);
        box-shadow: 1px 4px 11px 0px rgba(0, 0, 0, 0.15);
        }
      </mj-style>
      <mj-style inline="inline">
        .text-link {
        color: #5e6ebf
        }
      </mj-style>
      <mj-style inline="inline">
        .footer-link {
        color: #888888
        }
      </mj-style>
  
    </mj-head>
    <mj-body background-color="#E7E7E7" width="600px">
      <mj-section full-width="full-width" background-color="#3CB879" padding-bottom="0">
        <mj-column width="100%">
          <mj-text color="#ffffff" font-weight="bold" align="center" text-transform="uppercase" font-size="16px" letter-spacing="1px" padding-top="30px">
            SacTech Community
          </mj-text>
        </mj-column>
      </mj-section>
      <mj-wrapper padding-top="0" padding-bottom="0" css-class="body-section">
        <mj-section background-color="#ffffff" padding-left="15px" padding-right="15px">
          <mj-column width="100%">
            <mj-text color="#212b35" font-weight="bold" font-size="20px">
              Welcome to #SacTech
            </mj-text>
            <mj-text color="#637381" font-size="16px">
              Hey there, fellow Sacramentan!
            </mj-text>
            <mj-text color="#637381" font-size="16px">
              We're excited that you want to join our Slack community. Below, you can find a link that you can use to join the server.
            </mj-text>
            <mj-button background-color="#5e6ebf" align="center" color="#ffffff" font-size="17px" font-weight="bold" href="${process.env.INVITE_LINK}" width="300px">
              Join the Slack
            </mj-button>
            <mj-text color="#8498A9" font-size="14px" padding-top="30px">
              Want to invite someone else to the community? We ask that you send them to <a href="https://sac-tech.com">our signup page</a> in order to recieve an invite. It allows us to ensure that everyone that's joining our community has accepted our Code of Conduct.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-wrapper>
  
      <mj-wrapper full-width="full-width">
        <mj-section padding-top="0">
          <mj-group>
            <mj-column width="100%" padding-right="0">
              <mj-text color="#445566" font-size="11px" align="center" line-height="16px" font-weight="bold">
                <a class="footer-link" href="https://sac-tech.com">Code of Conduct</a>
              </mj-text>
            </mj-column>
          </mj-group>
  
        </mj-section>
      </mj-wrapper>
  
    </mj-body>
  </mjml>
    `);

    if (htmlOutput.errors.length) {
      throw htmlOutput.errors;
    }

    const mailData = {
      from: process.env.SMTP_USER,
      to: req.body.email,
      subject: `Invitation to the SacTech Slack`,
      text: "Testing",
      html: htmlOutput.html
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
    return res.status(200).json({ message: "Success" });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error" });;
  }
}
