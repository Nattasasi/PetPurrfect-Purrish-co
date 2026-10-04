import test from "node:test";
import assert from "node:assert/strict";
import { listProducts } from "../src/services/productService.js";

test("managed product catalog exposes real THB Shopee products without stale prices", () => {
  const result = listProducts({ context: "quiz" });
  assert.ok(result.products.length >= 2);
  assert.equal(result.meta.currency, "THB");
  for (const product of result.products) {
    assert.match(product.id, /^pet-wipes-/);
    assert.match(product.externalUrl, /^https:\/\/shopee\.co\.th\//);
    assert.equal(product.currency, "THB");
    assert.equal(product.price, null);
    assert.match(product.priceLabel, /live THB price/i);
  }
});
