import { getQuizProfiles } from "./breedProfileService.js";
import { lifeStage } from "./petService.js";
import { listProducts } from "./productService.js";
import { shopeeSearchUrl } from "../adapters/shopeeLinks.js";
import { PET_PICKS, SEARCH_LINKS } from "../data/petPicks.js";

const TERMS = {
  dog: {
    food: "อาหารสุนัข", puppy: "อาหารลูกสุนัข", senior: "อาหารสุนัขสูงวัย",
    small: "อาหารสุนัขพันธุ์เล็ก", large: "อาหารสุนัขพันธุ์ใหญ่",
    groom: "แปรงขนสุนัข", toys: "ของเล่นสุนัข", active: "สายรัดอก สุนัข", bed: "ที่นอนสุนัข"
  },
  cat: {
    food: "อาหารแมว", puppy: "อาหารลูกแมว", senior: "อาหารแมวสูงวัย",
    groom: "แปรงขนแมว", toys: "ของเล่นแมว", active: "ที่ลับเล็บแมว", bed: "ที่นอนแมว"
  }
};

// Groups come from species, life stage, size and workbook care data. No medication terms.
export function buildPickPlan(pet, breed) {
  const t = TERMS[pet.species];
  const stage = lifeStage(pet.birthDate, pet.species);
  const info = breed?.breedInfo;
  const plan = [];

  if (stage === "puppy" || stage === "kitten") plan.push({ id: "food-young", reason: `Food for a young ${pet.species}`, keyword: t.puppy });
  else if (stage === "senior") plan.push({ id: "food-senior", reason: `Food for a senior ${pet.species}`, keyword: t.senior });
  else if (pet.species === "dog" && pet.weightKg && pet.weightKg < 10) plan.push({ id: "food-small", reason: "Food for small breeds", keyword: t.small });
  else if (pet.species === "dog" && pet.weightKg && pet.weightKg > 25) plan.push({ id: "food-large", reason: "Food for large breeds", keyword: t.large });
  else plan.push({ id: "food", reason: `Everyday ${pet.species} food`, keyword: t.food });

  if (info?.groomingHoursMonthly >= 3) plan.push({ id: "groom", reason: `${breed.name}s need regular grooming`, keyword: t.groom });
  if (info?.exerciseMinutesDaily >= 60) plan.push({ id: "active", reason: `${breed.name}s are high-energy`, keyword: t.active });
  plan.push({ id: "toys", reason: "Play and enrichment", keyword: t.toys });
  plan.push({ id: "bed", reason: "A comfortable rest spot", keyword: t.bed });
  return plan.slice(0, 4);
}

export async function picksForPet(pet) {
  const breed = pet.breedId ? (await getQuizProfiles()).breeds.find((item) => item.id === pet.breedId) : null;
  const groups = buildPickPlan(pet, breed).map(({ id, reason, keyword }) => ({
    reason,
    searchUrl: SEARCH_LINKS[`${pet.species}:${id}`] || shopeeSearchUrl(keyword),
    products: PET_PICKS[`${pet.species}:${id}`] || []
  }));
  const cleanup = {
    reason: "Purrish&Co. cleanup picks",
    searchUrl: null,
    products: listProducts({ context: "quiz" }).products.map((product) => ({
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl || null,
      priceLabel: Number.isFinite(product.price) ? null : product.priceLabel || null,
      price: Number.isFinite(product.price) ? product.price : null,
      url: product.externalUrl
    }))
  };
  return { picks: [...groups, cleanup] };
}
