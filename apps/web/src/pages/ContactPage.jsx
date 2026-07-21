export default function ContactPage() {
  return (
    <>
      <section className="page-header">
        <h1>Get In Touch 🐾</h1>
        <p>Have questions or suggestions? We'd love to hear from you!</p>
      </section>

      <section className="features">
        <h2>Contact Information</h2>
        <div className="cards">
          <div className="card">
            <i className="fas fa-envelope" />
            <h3>Email</h3>
            <p>support@purrishco.com</p>
          </div>
          <div className="card">
            <i className="fas fa-phone" />
            <h3>Phone</h3>
            <p>+66 12 345 6789</p>
          </div>
          <div className="card">
            <i className="fas fa-location-dot" />
            <h3>Location</h3>
            <p>Bangkok, Thailand</p>
          </div>
        </div>
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

      <section className="stats">
        <div className="stat">
          <h2>Mon - Fri</h2>
          <p>09:00 - 18:00</p>
        </div>
        <div className="stat">
          <h2>Saturday</h2>
          <p>10:00 - 16:00</p>
        </div>
        <div className="stat">
          <h2>Sunday</h2>
          <p>Closed</p>
        </div>
      </section>
    </>
  );
}
