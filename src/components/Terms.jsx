import { Link } from 'react-router-dom'
import '../styles/global.css'

const LAST_UPDATED = 'June 18, 2026'

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <div className="user-setup-logo">
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="#7C3AED" />
            <text x="16" y="23" fontFamily="serif" fontSize="20" fill="white" textAnchor="middle">M</text>
          </svg>
          <span>MassRead</span>
        </div>

        <h1>Terms of Use</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using massread.com (the “Service”), you agree to be bound by
          these Terms of Use. If you do not agree to these terms, please do not use the
          Service.
        </p>

        <h2>2. The Service</h2>
        <p>
          MassRead is a shared reading platform that lets people read eBooks together,
          highlight passages, and discuss them. The Service is provided on an “as is” and
          “as available” basis, and we may modify, suspend, or discontinue any part of it
          at any time without notice.
        </p>

        <h2>3. Content and Copyright</h2>
        <p>
          The eBooks and other materials offered through the Service are made available on
          the basis that they are in the public domain in the United States or are
          otherwise lawfully provided.
        </p>
        <p>
          Non-US persons are advised to check copyright laws of their country before
          accessing any eBooks or other content from massread.com. Some content may be
          copyrighted, or otherwise restricted, for use in other countries. Massread.com
          offers no warranty or assurances about copyright status or freedom to access or
          use its materials outside of the United States.
        </p>
        <p>
          You are solely responsible for ensuring that your access to and use of any
          content complies with the laws applicable to you.
        </p>

        <h2>4. User Conduct</h2>
        <p>
          You agree to use the Service lawfully and respectfully. You are responsible for
          the highlights, comments, and other content you submit, and you agree not to post
          material that is unlawful, infringing, abusive, or otherwise objectionable. We may
          remove content or restrict access at our discretion.
        </p>

        <h2>5. Accounts and Sign-In</h2>
        <p>
          Some features require signing in. You are responsible for activity that occurs
          under your account and for keeping your access credentials secure.
        </p>

        <h2>6. Disclaimer of Warranties</h2>
        <p>
          The Service and all content are provided without warranties of any kind, whether
          express or implied, including but not limited to warranties of merchantability,
          fitness for a particular purpose, non-infringement, and any warranties regarding
          the copyright status or availability of content in any jurisdiction.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, massread.com and its operators shall not
          be liable for any indirect, incidental, or consequential damages arising out of
          or related to your use of the Service or any content accessed through it.
        </p>

        <h2>8. Changes to These Terms</h2>
        <p>
          We may update these Terms of Use from time to time. Continued use of the Service
          after changes take effect constitutes acceptance of the revised terms.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions about these Terms of Use may be directed to the operators of
          massread.com.
        </p>

        <Link to="/" className="legal-back">← Back to MassRead</Link>
      </div>
    </div>
  )
}
