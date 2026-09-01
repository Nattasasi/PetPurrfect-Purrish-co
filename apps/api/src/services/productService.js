const products = [
  {
    id: "pet-mug",
    name: "Pet Mug",
    price: 15.99,
    externalUrl: "https://shopee.co.th/purrishandco?entryPoint=ShopBySearch&searchKeyword=purrish"
  },
  {
    id: "pet-hoodie",
    name: "Pet Hoodie",
    price: 22.99,
    externalUrl: "https://shopee.co.th/purrishandco?entryPoint=ShopBySearch&searchKeyword=purrish"
  }
];

export function listProducts() {
  return products;
}
