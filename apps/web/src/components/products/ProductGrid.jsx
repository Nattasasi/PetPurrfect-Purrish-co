const mockProducts = [
  {
    id: "pet-mug",
    name: "Pet Mug",
    price: 15.99,
    externalUrl: "https://example-shop.com/products/pet-mug"
  },
  {
    id: "pet-hoodie",
    name: "Pet Hoodie",
    price: 22.99,
    externalUrl: "https://example-shop.com/products/pet-hoodie"
  }
];

export default function ProductGrid() {
  return (
    <div>
      {mockProducts.map((product) => (
        <article key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price.toFixed(2)}</p>
          <a href={product.externalUrl} target="_blank" rel="noreferrer">
            <button>Buy on Partner Site</button>
          </a>
        </article>
      ))}
    </div>
  );
}
