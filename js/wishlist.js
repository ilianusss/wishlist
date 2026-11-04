export const WISHLISTS = [
  { id: "iliane", label: "Iliane" },
  { id: "juliette", label: "Juliette" },
];
const DEFAULT_WISHLIST = WISHLISTS[0].id;
const PHOTOS_PATH = "data/photos.json";
const PHOTOS_DIR = "assets/items";
const DEFAULT_TITLE = "Wishlist";
const PODIUM_SIZE = 3;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const priceFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function wishlistFromUrl() {
  const id = new URLSearchParams(location.search).get("list");
  return WISHLISTS.some((wishlist) => wishlist.id === id) ? id : DEFAULT_WISHLIST;
}

// The default wishlist keeps the bare URLs that were shared before there were several lists.
export function withWishlist(params, wishlist) {
  if (wishlist !== DEFAULT_WISHLIST) params.set("list", wishlist);
  return params;
}

export async function loadWishlist(id) {
  const path = `data/wishlists/${id}.json`;
  const [wishlistResponse, photosResponse] = await Promise.all([request(path), request(PHOTOS_PATH)]);
  const wishlist = await readJson(wishlistResponse, path);
  const photos = photosResponse.status === 404 ? {} : await readJson(photosResponse, PHOTOS_PATH);
  try {
    const categorized = wishlist.categories !== undefined;
    return {
      title: isText(wishlist.title) ? wishlist.title : DEFAULT_TITLE,
      intro: optionalText(wishlist.intro, (reason) => fail(`"intro" ${reason}`)),
      categorized,
      categories: categorized
        ? parseCategories(wishlist.categories, photos, wishlist.ranking)
        : [parseUncategorized(wishlist.items, photos)],
    };
  } catch (error) {
    throw new Error(`${path}, ${error.message}`);
  }
}

export function formatPrice(price) {
  if (price === null) return "N/C";
  return typeof price === "number" ? priceFormat.format(price) : price;
}

export function priceValue(item) {
  return typeof item.price === "number" ? item.price : Infinity;
}

export function listUrl(wishlist) {
  const query = withWishlist(new URLSearchParams(), wishlist).toString();
  return query ? `index.html?${query}` : "index.html";
}

export function itemUrl(item, wishlist) {
  return `item.html?${withWishlist(new URLSearchParams({ id: item.id }), wishlist)}`;
}

export function isPodium(rank) {
  return rank <= PODIUM_SIZE;
}

async function request(path) {
  try {
    return await fetch(path, { cache: "no-cache" });
  } catch {
    throw new Error(`Impossible de charger ${path}. Lance "npm run dev" et ouvre l'adresse affichée.`);
  }
}

async function readJson(response, path) {
  if (!response.ok) throw new Error(`Impossible de charger ${path} (HTTP ${response.status}).`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${path} n'est pas un JSON valide : ${error.message}`);
  }
}

function parseCategories(rawCategories, photos, rawRanking) {
  if (!Array.isArray(rawCategories)) fail(`"categories" doit être une liste.`);

  const names = new Set();
  const ids = new Set();
  const categories = rawCategories.map((raw, index) => {
    const failCategory = (reason) => fail(`catégorie n°${index + 1} : ${reason}`);
    if (!isText(raw.name)) failCategory(`le champ "name" est obligatoire.`);
    if (names.has(raw.name)) failCategory(`la catégorie "${raw.name}" existe déjà.`);
    names.add(raw.name);
    if (!Array.isArray(raw.items)) failCategory(`"items" doit être une liste (vide si besoin).`);

    return {
      name: raw.name,
      note: optionalText(raw.note, (reason) => failCategory(`"note" ${reason}`)),
      items: raw.items.map((item, itemIndex) =>
        parseItem(item, { category: raw.name, rank: itemIndex + 1, ids, photos }),
      ),
    };
  });

  applyGlobalRanking(categories, rawRanking, ids);
  return categories;
}

// A wishlist without categories is a plain "items" list, already in order of preference.
function parseUncategorized(rawItems, photos) {
  if (!Array.isArray(rawItems)) fail(`"categories" ou "items" doit être une liste.`);

  const ids = new Set();
  const items = rawItems.map((item, index) => parseItem(item, { category: null, rank: index + 1, ids, photos }));
  for (const item of items) item.globalRank = item.rank;
  return { name: null, note: null, items };
}

// "ranking" lists every item id from best to worst; it must cover all items exactly once.
function applyGlobalRanking(categories, rawRanking, ids) {
  if (!Array.isArray(rawRanking)) fail(`"ranking" doit être une liste d'id, du préféré au moins préféré.`);

  const globalRanks = new Map();
  for (const id of rawRanking) {
    if (!ids.has(id)) fail(`"ranking" : l'id "${id}" ne correspond à aucun cadeau.`);
    if (globalRanks.has(id)) fail(`"ranking" : l'id "${id}" apparaît plusieurs fois.`);
    globalRanks.set(id, globalRanks.size + 1);
  }

  const missing = [...ids].filter((id) => !globalRanks.has(id));
  if (missing.length > 0) fail(`"ranking" : il manque ${missing.map((id) => `"${id}"`).join(", ")}.`);

  for (const item of categories.flatMap((category) => category.items)) item.globalRank = globalRanks.get(item.id);
}

function parseItem(raw, { category, rank, ids, photos }) {
  const failItem = (reason) => fail(`${category === null ? "" : `${category}, `}cadeau n°${rank} : ${reason}`);

  for (const field of ["id", "name"]) {
    if (!isText(raw[field])) failItem(`le champ "${field}" est obligatoire.`);
  }
  if (!ID_PATTERN.test(raw.id)) failItem(`l'id "${raw.id}" ne doit contenir que des minuscules, chiffres et tirets.`);
  if (ids.has(raw.id)) failItem(`l'id "${raw.id}" est déjà utilisé.`);
  ids.add(raw.id);
  if (raw.price != null && !Number.isFinite(raw.price) && !isText(raw.price)) {
    failItem(`"price" doit être un nombre (ex : 49.99) ou un texte (ex : "∞").`);
  }
  if (raw.link != null && !isWebUrl(raw.link)) failItem(`"link" doit être une adresse http(s).`);

  return {
    id: raw.id,
    rank,
    globalRank: 0, // filled in once the whole ranking has been read
    category,
    name: raw.name,
    price: raw.price ?? null,
    link: raw.link ?? null,
    note: optionalText(raw.note, (reason) => failItem(`"note" ${reason}`)),
    warning: optionalText(raw.warning, (reason) => failItem(`"warning" ${reason}`)),
    photos: (photos[raw.id] ?? []).map((file) => `${PHOTOS_DIR}/${raw.id}/${encodeURIComponent(file)}`),
  };
}

function optionalText(value, onInvalid) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") onInvalid("doit être du texte.");
  return value;
}

function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isWebUrl(value) {
  return URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol);
}

function fail(reason) {
  throw new Error(reason);
}
