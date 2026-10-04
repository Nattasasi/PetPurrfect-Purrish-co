import ProductRecommendations from "../components/products/ProductRecommendations";
import { trackProductClick } from "../lib/analytics";

export default function HomePage() {
  return (
    <>
      <section className="hero hero--business">
        <div className="hero-text">
          <span className="badge">Everyday pet care, made delightful</span>
          <h1>
            Practical Cleanup
            <br />
            For Your Best Friend <img src="/business_assets/purrish_pet-06.png" alt="" className="inline-pet-icon" />
          </h1>
          <p>
            Explore Purrish&amp;Co. pet-cleaning wipes for home and travel, then
            enjoy our pet quiz and personalized digital sticker experience.
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

      <ProductRecommendations context="home" />

      <section className="shop-confidence" aria-labelledby="shop-confidence-title">
        <div className="catalog-heading">
          <span className="catalog-kicker">A clearer way to shop</span>
          <h2 id="shop-confidence-title">Choose the pack that fits your routine</h2>
        </div>
        <div className="cards shop-confidence-grid">
          <div className="card">
            <i className="fa-solid fa-suitcase-rolling" aria-hidden="true" />
            <h3>Travel Ready</h3>
            <p>Keep a compact 20-sheet pack ready for walks, day trips and pet bags.</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-house" aria-hidden="true" />
            <h3>Easy Home Care</h3>
            <p>Choose an 80-sheet pack or bundle for regular cleanup at home.</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-bag-shopping" aria-hidden="true" />
            <h3>Verified at Checkout</h3>
            <p>Confirm the latest ingredients, price, stock and delivery details directly on Shopee.</p>
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
            <h3>Download &amp; Discover</h3>
            <p>Download or share your result, then compare practical care packs from Purrish&amp;Co.</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to find your pet match?</h2>
        <p>Take the quiz or upload a photo, then shop the real Purrish&amp;Co. lineup on Shopee.</p>
        <a
          href="https://shopee.co.th/purrishandco"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          onClick={() => trackProductClick("storefront", "home-footer", "storefront")}
        >
          Visit Our Shopee Shop
        </a>
      </section>
    </>
  );
}
