export default function AboutPage() {
  return (
    <>
      <section className="page-header">
        <h1>About Purrish&Co.</h1>
        <p>Creating personalized experiences for pets and the people who love them.</p>
      </section>

      <section className="about-section">
        <div className="about-content">
          <div className="about-text">
            <h2>Our Story 🐾</h2>
            <p>
              Purrish&Co. is a pet-centered brand created for young pet owners who love cute
              and personalized products. Our goal is to combine creativity with modern AI
              technology to make every purchase more meaningful.
            </p>
            <p>
              From custom pet stickers to interactive personality quizzes, we believe every pet
              deserves something unique.
            </p>
          </div>

          <div className="about-image">
            <img src="/images/about.jpg" alt="About Us" />
          </div>
        </div>
      </section>

      <section className="features">
        <h2>Our Mission &amp; Vision</h2>

        <div className="cards">
          <div className="card">
            <i className="fas fa-bullseye" />
            <h3>Mission</h3>
            <p>Create personalized pet products that strengthen the bond between pets and their owners.</p>
          </div>

          <div className="card">
            <i className="fas fa-eye" />
            <h3>Vision</h3>
            <p>Become a leading AI-powered pet lifestyle brand in the future.</p>
          </div>

          <div className="card">
            <i className="fas fa-heart" />
            <h3>Our Promise</h3>
            <p>Deliver high-quality products with creativity, care and innovation.</p>
          </div>
        </div>
      </section>

      <section className="team-section">
        <h2>Meet Our Team</h2>

        <div className="cards">
          <div className="card">
            <img src="/images/team1.jpg" alt="Team member" />
            <h3>Mya Tagu</h3>
            <p>Frontend Developer</p>
          </div>
          <div className="card">
            <img src="/images/team2.jpg" alt="Team member" />
            <h3>Team Member</h3>
            <p>Backend Developer</p>
          </div>
          <div className="card">
            <img src="/images/team3.jpg" alt="Team member" />
            <h3>Team Member</h3>
            <p>AI Developer</p>
          </div>
        </div>
      </section>
    </>
  );
}
