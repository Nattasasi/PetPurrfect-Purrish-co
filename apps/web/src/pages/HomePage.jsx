export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="badge">AI Powered Pet Experience</span>
          <h1>
            Personalized Products
            <br />
            For Your Best Friend <img src="/business_assets/purrish_pet-06.png" alt="" className="inline-pet-icon" />
          </h1>
          <p>
            Purrish&amp;Co. creates adorable pet products with AI-powered
            personalization, making every purchase special for you and your furry
            friend.
          </p>
          <div className="hero-buttons">
            <a href="/quiz" className="btn btn-primary">
              Take the Quiz
            </a>
            <a href="/pet" className="btn btn-outline">
              Get a Sticker!
            </a>
          </div>
        </div>
      </section>

      <section className="steps">
        <h2>How It Works</h2>
        <div className="step-container">
          <div className="step">
            <div className="number">1</div>
            <h3>Take the Quiz or Upload a Photo</h3>
            <p>Answer a short personality quiz, or upload a photo of your cat or dog.</p>
          </div>
          <div className="step">
            <div className="number">2</div>
            <h3>AI Generates Your Result</h3>
            <p>Get an AI-matched pet breed, or a custom sticker made from your pet's photo.</p>
          </div>
          <div className="step">
            <div className="number">3</div>
            <h3>Download &amp; Shop</h3>
            <p>Download or share your result, then visit our Shopee shop for real products.</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to find your pet match?</h2>
        <p>Take the quiz or upload a photo, then shop the real Purrish&amp;Co. lineup on Shopee.</p>
        <a href="https://shopee.co.th/purrishandco?entryPoint=ShopBySearch&searchKeyword=purrish" target="_blank" rel="noreferrer" className="btn btn-primary">
          Visit Our Shopee Shop
        </a>
      </section>
    </>
  );
}

