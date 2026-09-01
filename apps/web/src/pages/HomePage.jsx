export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="badge">AI Powered Pet Experience</span>
          <h1>
            Personalized Products
            <br />
            For Your Best Friend 🐶
          </h1>
          <p>
            Purrish&amp;Co. creates adorable pet products with AI-powered
            personalization, making every purchase special for you and your furry
            friend.
          </p>
          <div className="hero-buttons">
            <a href="https://shopee.co.th/purrishandco?entryPoint=ShopBySearch&searchKeyword=purrish" target="_blank" rel="noreferrer" className="btn btn-primary">
              Shop Now
            </a>
            <a href="/pet" className="btn btn-outline">
              Try Features
            </a>
          </div>
        </div>
        <div className="hero-image">
          <img src="/images/hero-dog.png" alt="Pet" />
        </div>
      </section>

      <section className="features">
        <h2>Why Choose Purrish&amp;Co.</h2>
        <div className="cards">
          <div className="card">
            <i className="fa-solid fa-paw" />
            <h3>Personalized Products</h3>
            <p>Every purchase is designed around your own pet.</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-robot" />
            <h3>AI Technology</h3>
            <p>Pet breed recognition and AI recommendations.</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-gift" />
            <h3>Free Sticker</h3>
            <p>Receive a custom pet sticker with every order.</p>
          </div>
        </div>
      </section>

      <section className="steps">
        <h2>How It Works</h2>
        <div className="step-container">
          <div className="step">
            <div className="number">1</div>
            <h3>Browse</h3>
            <p>Explore our adorable products.</p>
          </div>
          <div className="step">
            <div className="number">2</div>
            <h3>Personalize</h3>
            <p>Use AI features to customize your order.</p>
          </div>
          <div className="step">
            <div className="number">3</div>
            <h3>Receive</h3>
            <p>Enjoy your order with a free sticker.</p>
          </div>
        </div>
      </section>

      <section className="products">
        <h2>Featured Products</h2>
        <div className="product-grid">
          <div className="product-card">
            <img src="/images/product1.jpg" alt="Pet Mug" />
            <h3>Pet Mug</h3>
            <p>$15.99</p>
            <button>View</button>
          </div>
          <div className="product-card">
            <img src="/images/product2.jpg" alt="Pet T-Shirt" />
            <h3>Pet T-Shirt</h3>
            <p>$19.99</p>
            <button>View</button>
          </div>
          <div className="product-card">
            <img src="/images/product3.jpg" alt="Pet Keychain" />
            <h3>Pet Keychain</h3>
            <p>$8.99</p>
            <button>View</button>
          </div>
          <div className="product-card">
            <img src="/images/product4.jpg" alt="Sticker Pack" />
            <h3>Sticker Pack</h3>
            <p>$5.99</p>
            <button>View</button>
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="stat">
          <h2>500+</h2>
          <p>Happy Pets</p>
        </div>
        <div className="stat">
          <h2>1200+</h2>
          <p>Orders</p>
        </div>
        <div className="stat">
          <h2>98%</h2>
          <p>Satisfaction</p>
        </div>
        <div className="stat">
          <h2>24/7</h2>
          <p>AI Experience</p>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to make your pet feel extra special?</h2>
        <p>Join thousands of happy pet owners today.</p>
        <a href="https://shopee.co.th/purrishandco?entryPoint=ShopBySearch&searchKeyword=purrish" target="_blank" rel="noreferrer" className="btn btn-primary">
          Start Shopping
        </a>
      </section>
    </>
  );
}
