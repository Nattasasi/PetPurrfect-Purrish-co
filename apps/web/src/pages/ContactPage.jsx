import { useEffect, useRef } from "react";
import { connectContactForm } from "../../../../js/ingestion-client.mjs";

export default function ContactPage() {
  const formRef = useRef(null);
  useEffect(() => connectContactForm(formRef.current), []);
  return (
    <>
      <section className="page-header">
        <h1>Get In Touch <img src="/business_assets/purrish_pet-06.png" alt="" className="inline-pet-icon" /></h1>
        <p>Have questions or suggestions? We'd love to hear from you!</p>
      </section>

      <section className="contact-section">
        <div className="contact-form">
          <h2>Send Us a Message</h2>
          <form ref={formRef}>
            <input name="name" aria-label="Full name" type="text" placeholder="Full Name" minLength={2} maxLength={100} required />
            <input name="email" aria-label="Email address" type="email" placeholder="Email Address" maxLength={150} required />
            <input name="subject" aria-label="Subject" type="text" placeholder="Subject" maxLength={150} />
            <textarea name="message" aria-label="Message" rows="6" placeholder="Your Message" maxLength={2000} required />
            <button type="submit" className="btn btn-primary">Send Message</button>
            <p role="status" aria-live="polite" />
          </form>
        </div>
      </section>

    </>
  );
}
