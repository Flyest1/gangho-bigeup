type Props<K extends keyof HTMLElementTagNameMap> =
  Partial<Omit<HTMLElementTagNameMap[K], 'dataset' | 'className' | 'style'>> & {
    class?: string;
    dataset?: Record<string, string>;
    aria?: Record<string, string>;
  };

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Props<K> = {}, children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: className, dataset, aria, ...rest } = props;
  if (className) node.className = className;
  for (const [k, v] of Object.entries(dataset ?? {})) node.dataset[k] = v;
  for (const [k, v] of Object.entries(aria ?? {})) node.setAttribute(`aria-${k}`, v);
  Object.assign(node, rest);
  for (const child of children) node.append(child);
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
