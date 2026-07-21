const products = [
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

export function listProducts() {
  return products;
}
