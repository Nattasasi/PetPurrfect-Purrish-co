export default function ContactPage() {
  return (
    <>
      <section className="page-header">
        <h1>Get In Touch <img src="/business_assets/purrish_pet-06.png" alt="" className="inline-pet-icon" /></h1>
        <p>Have questions or suggestions? We'd love to hear from you!</p>
      </section>

      <section className="contact-section">
        <div className="contact-form">
          <h2>Send Us a Message</h2>
          <form>
            <input type="text" placeholder="Full Name" required />
            <input type="email" placeholder="Email Address" required />
            <input type="text" placeholder="Subject" />
            <textarea rows="6" placeholder="Your Message" />
            <button className="btn btn-primary">Send Message</button>
          </form>
        </div>
      </section>

    </>
  );
}
