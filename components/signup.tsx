"use client"
import { FormEventHandler } from "react"

interface SignupProps {
  onSubmit: FormEventHandler;
  sendError: string | null;
  sendSuccess: boolean;
  cocAgree: boolean;
  setCocAgree: (val: boolean) => void;
}

export const Signup = ({ onSubmit, sendError, sendSuccess, cocAgree, setCocAgree }: SignupProps) => {
  if (sendSuccess) {
    return <div className="form">
      <a href={process.env.NEXT_PUBLIC_INVITE_LINK} className="button">Join Slack</a>
      {sendError && <p aria-live="polite">{sendError}</p>}
    </div>
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="coc-agreeLabel">
        <input required className="coc-agree" type="checkbox" checked={cocAgree} onChange={e => setCocAgree(e.target.checked)} /> I agree to terms of the Code of Conduct
      </label>
      <button>
        Get my Invite
      </button>
      {sendError && <p aria-live="polite">{sendError}</p>}
    </form>
  )
}
