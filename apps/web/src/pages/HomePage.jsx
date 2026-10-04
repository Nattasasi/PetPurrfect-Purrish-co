import ProductRecommendations from "../components/products/ProductRecommendations";

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

    </>
  );
}
