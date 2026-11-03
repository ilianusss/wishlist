import { h, richText, showError, showMessage } from "./dom.js";
import { formatPrice, isPodium, itemUrl, loadWishlist, priceValue } from "./wishlist.js";

const ALL_CATEGORIES = "all";
const DEFAULT_SORT = "rank";
const SORT_ORDERS = {
  rank: (a, b) => a.rank - b.rank,
  price: (a, b) => Math.sign(priceValue(a) - priceValue(b)) || 0,
};

const titleElement = document.getElementById("title");
const intro = document.getElementById("intro");
const chipGroup = document.getElementById("categories");
const sortGroup = document.getElementById("sort");
const sortButtons = [...document.querySelectorAll("[data-sort]")];
const categoryNote = document.getElementById("category-note");
const tableCard = document.getElementById("table-card");
const table = document.getElementById("table");
const rows = document.getElementById("rows");
const status = document.getElementById("status");

try {
  start(await loadWishlist());
} catch (error) {
  showError(status, error);
}

function start({ title, intro: introText, categories }) {
  document.title = title;
  titleElement.textContent = title;
  if (introText !== null) {
    intro.replaceChildren(...richText(introText));
    intro.hidden = false;
  }

  const allItems = categories.flatMap((category) => category.items);
  const params = new URLSearchParams(location.search);
  const state = {
    category: categories.some(({ name }) => name === params.get("category")) ? params.get("category") : ALL_CATEGORIES,
    sort: Object.hasOwn(SORT_ORDERS, params.get("sort") ?? "") ? params.get("sort") : DEFAULT_SORT,
  };

  const update = (change) => {
    if (Object.entries(change).every(([key, value]) => state[key] === value)) return;
    Object.assign(state, change);
    render();
  };

  const chips = [ALL_CATEGORIES, ...categories.map(({ name }) => name)].map((category) =>
    h(
      "button",
      { type: "button", class: "chip", "data-category": category, onclick: () => update({ category }) },
      category === ALL_CATEGORIES ? "Tout" : category,
    ),
  );
  chipGroup.replaceChildren(...chips);
  for (const button of sortButtons) button.addEventListener("click", () => update({ sort: button.dataset.sort }));

  const render = () => {
    const isAll = state.category === ALL_CATEGORIES;
    const category = categories.find(({ name }) => name === state.category);
    // Ranks only exist inside a category, so the "all" view has a single fixed order.
    const visible = isAll ? allItems.toSorted(SORT_ORDERS.price) : category.items.toSorted(SORT_ORDERS[state.sort]);

    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.category === state.category));
    for (const button of sortButtons) button.setAttribute("aria-pressed", String(button.dataset.sort === state.sort));
    sortGroup.hidden = isAll;
    table.classList.toggle("is-all", isAll);

    categoryNote.hidden = !category?.note;
    if (category?.note) categoryNote.replaceChildren(...richText(category.note));

    rows.replaceChildren(...visible.map(renderRow));
    tableCard.hidden = visible.length === 0;
    if (visible.length === 0) showMessage(status, "Rien dans cette catégorie pour l'instant.");
    else status.hidden = true;

    saveStateInUrl(state, isAll);
  };

  render();
}

function renderRow(item, index) {
  const link = h("a", { href: itemUrl(item), class: "row-link" }, item.name);
  return h(
    "tr",
    {
      class: "row",
      style: `--i: ${index}`,
      onclick: (event) => {
        if (!event.target.closest("a")) link.click();
      },
    },
    h("td", { class: "col-rank" }, h("span", { class: isPodium(item) ? "rank rank-podium" : "rank" }, item.rank)),
    h(
      "td",
      { class: "col-name" },
      link,
      item.warning && h("span", { class: "flag", title: item.warning }, "Important"),
      h("span", { class: "cell-sub" }, item.category),
    ),
    h("td", { class: "col-price" }, formatPrice(item.price)),
    h("td", { class: "col-category" }, h("span", { class: "tag" }, item.category)),
  );
}

function saveStateInUrl(state, isAll) {
  const params = new URLSearchParams();
  if (!isAll) params.set("category", state.category);
  if (!isAll && state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  const query = params.toString();
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
}
