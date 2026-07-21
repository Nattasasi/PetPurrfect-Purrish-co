export default function ShopPage() {
  return (
    <>
      <section className="page-header">
        <h1>Our Products 🐾</h1>
        <p>Find adorable products specially designed for pet lovers.</p>
      </section>

      <section className="shop-controls">
        <div className="search-box">
          <input type="text" placeholder="Search products..." />
          <button>
            <i className="fas fa-search" />
          </button>
        </div>

        <div className="categories">
          <button className="active">All</button>
          <button>Accessories</button>
          <button>Clothing</button>
          <button>Home</button>
          <button>Stickers</button>
        </div>
      </section>

      <section className="products">
        <div className="product-grid">
          <div className="product-card">
            <img src="/images/product1.jpg" alt="Pet Mug" />
            <h3>Pet Mug</h3>
            <p className="price">$15.99</p>
            <a href="https://example-shop.com/products/pet-mug" target="_blank" rel="noreferrer">
              <button>Buy on Partner Site</button>
            </a>
          </div>

          <div className="product-card">
            <img src="/images/product2.jpg" alt="Pet Hoodie" />
            <h3>Pet Hoodie</h3>
            <p className="price">$22.99</p>
            <a href="https://example-shop.com/products/pet-hoodie" target="_blank" rel="noreferrer">
              <button>Buy on Partner Site</button>
            </a>
          </div>

          <div className="product-card">
            <img src="/images/product3.jpg" alt="Sticker Pack" />
            <h3>Sticker Pack</h3>
            <p className="price">$6.99</p>
            <a href="https://example-shop.com/products/sticker-pack" target="_blank" rel="noreferrer">
              <button>Buy on Partner Site</button>
            </a>
          </div>

          <div className="product-card">
            <img src="/images/product4.jpg" alt="Phone Case" />
            <h3>Phone Case</h3>
            <p className="price">$17.99</p>
            <a href="https://example-shop.com/products/phone-case" target="_blank" rel="noreferrer">
              <button>Buy on Partner Site</button>
            </a>
          </div>
        </div>
      </section>

      <section className="newsletter">
        <h2>Stay Updated!</h2>
        <p>Get updates on new products and special offers.</p>

        <div className="newsletter-box">
          <input type="email" placeholder="Enter your email" />
          <button>Subscribe</button>
        </div>
      </section>

      <section className="cta">
        <h2>Shop More on Our Partner Store</h2>
        <p>Browse full catalog and checkout on our trusted e-commerce platform.</p>
        <a href="https://example-shop.com" target="_blank" rel="noreferrer" className="btn btn-primary">
          Open Partner Store
        </a>
      </section>
    </>
  );
}
