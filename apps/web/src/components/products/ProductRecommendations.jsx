import { useEffect, useState } from "react";
import { getProducts } from "../../lib/apiClient";
import { trackProductClick } from "../../lib/analytics";

export default function ProductRecommendations({
  context = "home",
  petType = "pet",
  matchName = "",
  heading = "Everyday care from Purrish&Co."
}) {
  const [catalog, setCatalog] = useState({ products: [], meta: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProducts(context).then((result) => {
      if (active) {
        setCatalog(result || { products: [], meta: null });
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [context]);

  if (!loading && catalog.products.length === 0) return null;

  return (
    <section className={`catalog-section catalog-section--${context}`} aria-labelledby={`catalog-${context}-title`}>
      <div className="catalog-heading">
        <span className="catalog-kicker">Shop Purrish&amp;Co.</span>
        <h2 id={`catalog-${context}-title`}>{heading}</h2>
        <p>{recommendationCopy(context, petType, matchName)}</p>
      </div>

      {loading ? (
        <p className="catalog-status" role="status">Loading products...</p>
      ) : (
        <div className="product-grid catalog-grid">
          {catalog.products.slice(0, context === "home" ? 4 : 2).map((product) => (
            <article className="product-card catalog-product-card" key={product.id}>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={`${product.name} by Purrish&Co.`}
                  loading="lazy"
                  decoding="async"
                  width="1200"
                  height="1200"
                />
              ) : (
                <div className="product-card-placeholder" aria-hidden="true">
                  <img src="/business_assets/purrish_pet-08.png" alt="" />
                </div>
              )}
              <div className="catalog-product-body">
                <span className="catalog-use-case">{product.useCase}</span>
                <h3>{product.name}</h3>
                <p className="catalog-name-th" lang="th">{product.nameTh}</p>
                <p>{product.description}</p>
                <p className="catalog-pack-size">{product.packSize}</p>
                <p className="price">{formatPrice(product)}</p>
                <a
                  href={product.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary catalog-shop-link"
                  onClick={() => trackProductClick(product.id, context, matchName || petType)}
                >
                  View on Shopee
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="catalog-live-note">
        Shopee is the source of truth for current THB prices, ingredients, stock and delivery details.
      </p>
    </section>
  );
}

function formatPrice(product) {
  if (Number.isFinite(product.price)) {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: product.currency || "THB" }).format(product.price);
  }
  return product.priceLabel || "See live THB price on Shopee";
}

function recommendationCopy(context, petType, matchName) {
  if (context === "quiz") {
    return `Every pet brings a little everyday mess. For life with ${matchName || "your match"}, compare a home-size pack with a compact pack for trips.`;
  }
  if (context === "sticker") {
    return `You made something personal for your ${petType || "pet"}; here are practical cleanup packs for home and travel.`;
  }
  return "Pet-cleaning wipes in compact, home-size and value packs. Choose a pack here, then confirm live details on Shopee.";
}
