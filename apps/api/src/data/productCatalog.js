const SHOP_URL = "https://shopee.co.th/purrishandco";

function shopSearch(keyword) {
  return `${SHOP_URL}?${new URLSearchParams({ entryPoint: "ShopBySearch", searchKeyword: keyword })}`;
}

// Managed catalog: stable merchandising copy lives here while Shopee remains
// authoritative for live prices, stock, ingredients and checkout.
// The shape is intentionally compatible with a future Shopee Open Platform sync.
export const PRODUCT_CATALOG = [
  {
    id: "pet-wipes-20",
    name: "Pet Wipes — 20 Sheets",
    nameTh: "ผ้าเปียกสำหรับสัตว์เลี้ยง 20 แผ่น",
    description: "A compact pack for walks, travel bags and quick everyday cleanups.",
    packSize: "20 sheets",
    useCase: "Travel & quick cleanup",
    price: null,
    currency: "THB",
    priceLabel: "See live THB price on Shopee",
    imageUrl: "/business_assets/product_pictures/web/pet-wipes-20.jpg",
    externalUrl: shopSearch("Purrish 20 แผ่น"),
    contexts: ["home", "quiz", "sticker"],
    priority: 2,
    active: true
  },
  {
    id: "pet-wipes-80",
    name: "Pet Wipes — 80 Sheets",
    nameTh: "ผ้าเปียกสำหรับสัตว์เลี้ยง 80 แผ่น",
    description: "The practical home-size pack for regular paw, coat and surface cleanup.",
    packSize: "80 sheets",
    useCase: "Everyday home care",
    price: null,
    currency: "THB",
    priceLabel: "See live THB price on Shopee",
    imageUrl: "/business_assets/product_pictures/web/pet-wipes-80.jpg",
    externalUrl: shopSearch("Purrish 80 แผ่น"),
    contexts: ["home", "quiz", "sticker"],
    priority: 1,
    active: true
  },
  {
    id: "pet-wipes-mixed-bundle",
    name: "Home + Travel Bundle",
    nameTh: "ชุดผ้าเปียกห่อใหญ่ 2 + ห่อเล็ก 2",
    description: "A mixed bundle that keeps larger packs at home and compact packs ready to go.",
    packSize: "2 large + 2 small packs",
    useCase: "Home & travel",
    price: null,
    currency: "THB",
    priceLabel: "See live THB price on Shopee",
    imageUrl: "/business_assets/product_pictures/web/home-travel-bundle.jpg",
    externalUrl: shopSearch("Purrish 2+2"),
    contexts: ["home", "sticker"],
    priority: 3,
    active: true
  },
  {
    id: "pet-wipes-6-pack",
    name: "80-Sheet Value Pack — 6 Packs",
    nameTh: "ผ้าเปียก 80 แผ่น จำนวน 6 ห่อ",
    description: "A larger restock option for multi-pet homes or frequent everyday use.",
    packSize: "6 × 80 sheets",
    useCase: "Value restock",
    price: null,
    currency: "THB",
    priceLabel: "See live THB price on Shopee",
    imageUrl: "/business_assets/product_pictures/web/value-pack-80.jpg",
    externalUrl: "https://shopee.co.th/product/812768/26711602563",
    contexts: ["home", "quiz"],
    priority: 4,
    active: true
  }
];

export const PRODUCT_CATALOG_META = {
  storeName: "Purrish&Co.",
  storeUrl: SHOP_URL,
  currency: "THB",
  managedAt: "2026-10-01",
  liveFields: ["price", "stock", "ingredients", "shipping"]
};
