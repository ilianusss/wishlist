export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, value === true ? "" : String(value));
  }
  element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return element;
}

const RICH_TEXT_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function richText(text) {
  const nodes = [];
  let end = 0;
  for (const match of text.matchAll(RICH_TEXT_PATTERN)) {
    const [whole, bold, label, href] = match;
    nodes.push(text.slice(end, match.index));
    nodes.push(
      bold === undefined
        ? h("a", { href, target: "_blank", rel: "noopener noreferrer" }, label)
        : h("strong", {}, bold),
    );
    end = match.index + whole.length;
  }
  nodes.push(text.slice(end));
  return nodes;
}

export function showMessage(status, message) {
  status.textContent = message;
  status.classList.remove("status-error");
  status.hidden = false;
}

export function showError(status, error) {
  status.textContent = error.message;
  status.classList.add("status-error");
  status.hidden = false;
}
