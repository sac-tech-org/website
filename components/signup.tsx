import { FormEventHandler } from "react"

interface SignupProps {
  onSubmit: FormEventHandler;
  email: string;
  setEmail: (val: string) => void;
  sendError: string | null;
  isSendLoading: boolean;
  sendSuccess: boolean;
  cocAgree: boolean;
  setCocAgree: (val: boolean) => void;
}

export const Signup = ({ onSubmit, email, setEmail, sendError, isSendLoading, sendSuccess, cocAgree, setCocAgree }: SignupProps) => {
  if (isSendLoading) {
    return (
      <div className="form">
        <p aria-live="polite">Sending your email to your inbox...</p>
        {sendError && <p aria-live="polite">{sendError}</p>}
      </div>
    )
  }

  if (sendSuccess) {
    return <div className="form">
      <p aria-live="polite" className="success">Email sent - Check your email</p>
      {sendError && <p aria-live="polite">{sendError}</p>}
    </div>
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="coc-agreeLabel">
        <input required className="coc-agree" type="checkbox" checked={cocAgree} onChange={e => setCocAgree(e.target.checked)} /> I agree to terms of the Code of Conduct
      </label>
      <input value={email} required onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@yourdomain.com" className="form-item" />
      <button>
        Get my Invite
      </button>
      {sendError && <p aria-live="polite">{sendError}</p>}
    </form>
  )
}