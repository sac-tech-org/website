import Head from 'next/head'
import { FormEvent, useCallback, useState } from 'react'
import { Signup } from '../components/signup';

export default function Home() {
  const [email, setEmail] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSendLoading, setIsSendLoading] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [cocAgree, setCocAgree] = useState<boolean>(false);

  const sendEmail = useCallback((e: FormEvent) => {
    e.preventDefault();
  
    if (!cocAgree) {
      setSendError("You must accept the Code of Conduct first")
    }
    setSendError(null);
    setIsSendLoading(true);
    fetch("/api/mail", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email
      })
    })
      .then(res => {
        if (res.status !== 200) throw res;
        return res.json();
      })
      .then(() => {
        setIsSendLoading(false);
        setSendSuccess(true);
      })
      .catch(() => {
        setIsSendLoading(false);
        setSendError("There was an error sending your email");
      })
  }, [email, cocAgree]);

  return (
    <>
      <Head>
        <title>SacTech Community</title>
        <meta name="description" content="Join SacTech - The Sacramento technology community" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="splash">
        <header className="header">
          <section className="logos">
            <div className="logo slack"></div>
          </section>

          <p>
            Join <b>#SacTech</b> on Slack.
          </p>
        </header>

        <aside className="coc">
          <h1 className="coc-title">
            #SacTech Code of Conduct
          </h1>
          <div className="coc-content">
            <p>
              All members of our Slack group are required to agree with the
              following code of conduct. Organisers will enforce this code
              throughout all channels. We are expecting cooperation from all
              participants to help ensuring a safe environment for everybody.
            </p>

            <p>
              <em>tl;dr: Be excellent with each other</em>
            </p>

            <h2>
              Need Help?
            </h2>

            <p>
              You have our contact details in the Slack Team Directory
            </p>

            <h2>
              The Quick Version
            </h2>

            <p>
              Our Slack group is dedicated to providing a harassment-free
              communication experience for everyone, regardless of gender, gender
              identity and expression, age, sexual orientation, disability,
              physical appearance, body size, race, or religion (or lack thereof).
              We do not tolerate harassment of Slack participants in any form.
              Sexual language and imagery is not appropriate for any conference
              venue, including talks, workshops, parties, Twitter and other online
              media. Slack participants violating these rules may be sanctioned or
              expelled from the Slack group at the discretion of the Slack group
              organisers.
            </p>

            <h2>
              The Less Quick Version
            </h2>

            <p>
              Harassment includes offensive comments related to gender, gender
              identity and expression, age, sexual orientation, disability,
              physical appearance, body size, race, religion, sexual images,
              deliberate intimidation, stalking, sustained disruption of channels
              or other mediums, and unwelcome sexual attention.
            </p>

            <p>
              Participants asked to stop any harassing behavior are expected to comply immediately.
            </p>

            <p>
              Sponsors are also subject to the anti-harassment policy. In
              particular, sponsors should not use sexualised images, activities, or
              other material. Slack staff (including volunteers) should not use
              sexualised content or otherwise create a sexualised environment.
            </p>

            <p>
              If a participant engages in harassing behavior, the Slack group
              organisers may take any action they deem appropriate, including
              warning the offender or expulsion from the Slack group.
            </p>

            <p>
              If you are being harassed, notice that someone else is being
              harassed, or have any other concerns, please contact a member of the
              Slack group staff immediately. Slack group staff can be identified
              through the Team Directory.
            </p>

            <p>
              Slack group staff will be happy to help participants contact local
              law enforcement or otherwise assist those experiencing harassment to
              feel safe for the duration of their time in our Slack group. We value
              your contribution.
            </p>
          </div>
        </aside>

        <Signup 
          sendError={sendError}
          isSendLoading={isSendLoading} 
          onSubmit={sendEmail} 
          email={email} 
          setEmail={setEmail} 
          sendSuccess={sendSuccess} 
          cocAgree={cocAgree}
          setCocAgree={setCocAgree}
        />
      </main>
    </>
  )
}
