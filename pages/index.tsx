import Head from 'next/head'
import { FormEvent, useCallback, useState } from 'react'

export default function Home() {
  const [email, setEmail] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSendLoading, setIsSendLoading] = useState<boolean>(false);

  const sendEmail = useCallback((e: FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setIsSendLoading(true);
    fetch("/api/mail", {
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
        // DO THING HERE
      })
      .catch(() => {
        setIsSendLoading(false);
        setSendError("There was an error sending your email");
      })
  }, [email]);

  return (
    <>
      <Head>
        <title>SacTech Community</title>
        <meta name="description" content="Join SacTech - The Sacramento technology community" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <p>This website is under construction</p>
        {isSendLoading ?
          <p>Sending email...</p>
          : sendError ?
            <p>{sendError}</p>
            : <form onSubmit={sendEmail}>
              <label>Your email
                <input onChange={e => { setEmail(e.target.value) }} value={email} />
              </label>
              <button>Send email</button>
            </form>}
      </main>
    </>
  )
}
