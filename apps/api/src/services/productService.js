import { PRODUCT_CATALOG, PRODUCT_CATALOG_META } from "../data/productCatalog.js";

export function listProducts({ context = "home" } = {}) {
  const normalizedContext = ["home", "quiz", "sticker"].includes(context) ? context : "home";
  const products = PRODUCT_CATALOG
    .filter((product) => product.active && product.contexts.includes(normalizedContext))
    .sort((left, right) => left.priority - right.priority)
    .map(({ active: _active, priority: _priority, contexts: _contexts, ...product }) => product);

  return { products, meta: PRODUCT_CATALOG_META };
}
