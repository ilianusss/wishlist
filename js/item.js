import { h, richText, showError, showMessage } from "./dom.js";
import { formatPrice, isPodium, loadWishlist } from "./wishlist.js";

const back = document.getElementById("back");
const article = document.getElementById("item");
const status = document.getElementById("status");

restoreListState();

try {
  const { title, categories } = await loadWishlist();
  const id = new URLSearchParams(location.search).get("id");
  const category = categories.find(({ items }) => items.some((candidate) => candidate.id === id));
  if (category) renderItem(category.items.find((candidate) => candidate.id === id), category, title);
  else showMessage(status, "Ce cadeau n'existe pas (ou plus).");
} catch (error) {
  showError(status, error);
}

function restoreListState() {
  if (!URL.canParse(document.referrer)) return;
  const referrer = new URL(document.referrer);
  const listPath = new URL(".", location.href).pathname;
  const isFromList = referrer.origin === location.origin && [listPath, `${listPath}index.html`].includes(referrer.pathname);
  if (isFromList) back.href = referrer.href;
}

function renderItem(item, category, wishlistTitle) {
  document.title = `${item.name} · ${wishlistTitle}`;
  const hasPhotos = item.photos.length > 0;
  article.classList.toggle("has-photos", hasPhotos);
  article.replaceChildren(
    ...(item.warning === null ? [] : [renderWarning(item.warning)]),
    ...(hasPhotos ? [renderGallery(item)] : []),
    renderDetails(item, category),
  );
  article.hidden = false;
}

function renderWarning(warning) {
  return h(
    "aside",
    { class: "warning", role: "note" },
    h("span", { class: "warning-icon", "aria-hidden": "true" }, "!"),
    h("div", {}, h("p", { class: "warning-title" }, "Important"), h("p", { class: "warning-text rich" }, richText(warning))),
  );
}

function renderDetails(item, category) {
  return h(
    "div",
    { class: "card details" },
    h(
      "div",
      { class: "meta" },
      h("span", { class: isPodium(item) ? "rank rank-podium" : "rank" }, `#${item.rank}`),
      h("span", { class: "tag" }, item.category),
    ),
    h("h1", { class: "item-name" }, item.name),
    h("p", { class: "price" }, formatPrice(item.price)),
    item.note !== null &&
      h("section", { class: "note" }, h("h2", { class: "section-title" }, "Note"), h("p", { class: "rich" }, richText(item.note))),
    renderBuyLink(item.link),
    category.note !== null &&
      h(
        "section",
        { class: "category-info" },
        h("h2", { class: "section-title" }, category.name),
        h("p", { class: "rich" }, richText(category.note)),
      ),
  );
}

function renderBuyLink(link) {
  if (link === null) return h("p", { class: "buy buy-missing" }, "Pas de lien");
  const url = new URL(link);
  return [
    h(
      "a",
      { class: "buy", href: url.href, target: "_blank", rel: "noopener noreferrer" },
      "Voir le cadeau",
      h("span", { "aria-hidden": "true" }, "↗"),
    ),
    h("p", { class: "buy-host" }, `sur ${url.hostname.replace(/^www\./, "")}`),
  ];
}

function renderGallery(item) {
  const photos = item.photos;
  const multiple = photos.length > 1;
  let current = 0;

  const openViewer = () => {
    document.documentElement.classList.add("viewer-open");
    viewer.showModal();
  };

  const image = h("img", { src: photos[0], alt: `${item.name}, photo 1` });
  const zoomIn = h("button", { type: "button", class: "gallery-zoom", "aria-label": "Agrandir la photo", onclick: openViewer }, image);
  const main = h("div", { class: "gallery-main" }, zoomIn);
  const gallery = h("section", { class: "gallery", "aria-label": "Photos" }, main);

  const counter = h("span", { class: "gallery-counter" });
  const viewerImage = h("img", { class: "viewer-image", src: photos[0], alt: image.alt, draggable: "false" });
  const viewerCounter = h("span", { class: "viewer-counter" });
  const viewer = h(
    "dialog",
    { class: "viewer", "aria-label": `Photos de ${item.name}` },
    h("div", { class: "viewer-stage" }, viewerImage),
    h("button", { type: "button", class: "viewer-close", "aria-label": "Fermer", onclick: () => viewer.close() }, "×"),
    multiple && [
      h("button", { type: "button", class: "viewer-nav viewer-prev", "aria-label": "Photo précédente", onclick: () => show(current - 1, -1) }, "‹"),
      h("button", { type: "button", class: "viewer-nav viewer-next", "aria-label": "Photo suivante", onclick: () => show(current + 1, 1) }, "›"),
      viewerCounter,
    ],
  );
  gallery.append(viewer);

  const thumbs = multiple
    ? photos.map((src, index) =>
        h(
          "button",
          { type: "button", class: "thumb", "aria-label": `Photo ${index + 1}`, onclick: () => show(index) },
          h("img", { src, alt: "", loading: "lazy" }),
        ),
      )
    : [];

  const markCurrent = () => {
    counter.textContent = viewerCounter.textContent = `${current + 1} / ${photos.length}`;
    thumbs.forEach((thumb, index) => thumb.setAttribute("aria-current", String(index === current)));
  };

  const animate = (element, keyframes) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.animate(keyframes, { duration: 260, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
  };

  const show = (index, direction = 0) => {
    current = (index + photos.length) % photos.length;
    image.src = viewerImage.src = photos[current];
    image.alt = viewerImage.alt = `${item.name}, photo ${current + 1}`;
    animate(image, [{ opacity: 0, transform: "scale(0.98)" }, { opacity: 1, transform: "none" }]);
    animate(viewerImage, [{ opacity: 0, transform: `translateX(${direction * 40}px)` }, { opacity: 1, transform: "none" }]);
    markCurrent();
    for (const neighbour of [current - 1, current + 1]) new Image().src = photos[(neighbour + photos.length) % photos.length];
  };

  viewer.addEventListener("click", (event) => {
    if (event.target === viewer || event.target.classList.contains("viewer-stage")) viewer.close();
  });
  viewer.addEventListener("close", () => document.documentElement.classList.remove("viewer-open"));

  if (!multiple) return gallery;

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(current - 1, -1);
    if (event.key === "ArrowRight") show(current + 1, 1);
  });

  let swipeStart = null;
  viewer.addEventListener("pointerdown", (event) => {
    swipeStart = event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
  });
  viewer.addEventListener("pointerup", (event) => {
    if (swipeStart === null) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  viewer.addEventListener("pointercancel", () => (swipeStart = null));

  main.append(
    h("button", { type: "button", class: "gallery-nav gallery-prev", "aria-label": "Photo précédente", onclick: () => show(current - 1) }, "‹"),
    h("button", { type: "button", class: "gallery-nav gallery-next", "aria-label": "Photo suivante", onclick: () => show(current + 1) }, "›"),
    counter,
  );
  gallery.append(h("div", { class: "gallery-thumbs" }, thumbs));
  markCurrent();
  return gallery;
}
