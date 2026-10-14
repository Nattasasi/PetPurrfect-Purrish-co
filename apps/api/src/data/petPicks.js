// Affiliate short links (from Shopee Affiliate > Custom Link) for each pick group's Shopee search, keyed "<species>:<group id>".
// Groups without a link fall back to a plain Shopee search that earns no commission.
export const SEARCH_LINKS = {
  "dog:food": "https://s.shopee.co.th/1VzwiJ2lVx",
  "dog:food-young": "https://s.shopee.co.th/gQpivIwGc",
  "dog:food-senior": "https://s.shopee.co.th/qkFvEIIvf",
  "dog:food-small": "https://s.shopee.co.th/4LK85f4ypM",
  "dog:food-large": "https://s.shopee.co.th/4VdYHy4LUP",
  "dog:groom": "https://s.shopee.co.th/40hHh36FVK",
  "dog:active": "https://s.shopee.co.th/4fwyUILJoc",
  "dog:toys": "https://s.shopee.co.th/4qGOgbKgTf",
  "dog:bed": "https://s.shopee.co.th/30okVERfCK",
  "cat:food": "https://s.shopee.co.th/3B8AhXR1rN",
  "cat:food-young": "https://s.shopee.co.th/2gBu6cSvsI",
  "cat:food-senior": "https://s.shopee.co.th/7VH9rWS8i0",
  "cat:groom": "https://s.shopee.co.th/7KxjfDSm2z",
  "cat:active": "https://s.shopee.co.th/7pu0G8Qs26",
  "cat:toys": "https://s.shopee.co.th/7faa3pRVN5",
  "cat:bed": "https://s.shopee.co.th/6q1T4IUg3w"
};

// Optional hand-picked products per group, same keys.
// Example: "dog:groom": [{ id: "brush-1", name: "Slicker brush", imageUrl: "https://...", priceLabel: "฿129", url: "https://s.shopee.co.th/..." }]
export const PET_PICKS = {};
