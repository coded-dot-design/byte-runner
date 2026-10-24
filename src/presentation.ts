import type { GameContext } from '@coded-design/dom-virus';
import type { Actor, Maze, Point, Wall } from './maze.js';

// Original 14px sprites, with deliberately square silhouettes and readable eyes.
export const RUNNER_OPEN = 'M4 0h6v1h2v2h2v1h-2v1h-2v1H8v2h2v1h2v1h2v1h-2v2h-2v1H4v-1H2v-2H1V9H0V5h1V3h1V1h2Z';
export const RUNNER_CLOSED = 'M4 0h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H4v-1H2v-2H1V9H0V5h1V3h1V1h2Z';
export const GHOST = 'M4 0h6v1h2v2h1v2h1v9h-2v-2h-2v2H8v-2H6v2H4v-2H2v2H0V5h1V3h1V1h2Z';
export const CHERRY = '<path d="M7 7V3h3V1h2v2h-1v6H9V5H8v4Z" fill="#4bce82"/><path d="M2 7h4v1h2v5H6v1H2v-1H1V9h1Zm8 2h4v1h1v4h-1v1h-4v-1H9v-4h1Z" fill="#f4457a"/><path d="M2 8h2v2H2zm8 2h2v2h-2Z" fill="#fff4ff"/>';
export const BERRY = '<path d="M3 1h3v2h4V1h3v3h-3v2H6V4H3Z" fill="#4bce82"/><path d="M3 5h10v1h2v4h-2v2h-2v2H9v1H7v-1H5v-2H3v-2H1V6h2Z" fill="#ee6875"/><path d="M4 6h1v2H4zm6 0h1v2h-1zM7 9h1v2H7Z" fill="#fff4ff"/>';
const NS = 'http://www.w3.org/2000/svg';
export interface Frame { x: number; y: number; width: number; height: number; scaleX: number; scaleY: number; left: number; top: number; walls: Wall[]; key: string }
export function createPresentation(api: GameContext) {
  const doc = api.options.document ?? globalThis.document;
  const root = typeof api.options.root === 'string' ? doc.querySelector(api.options.root) : api.options.root ?? doc.body;
  const shadow = root && api.board.attach?.(root);
  if (!shadow) throw new Error('Byte Runner needs an attachable HTML content root.');
  const host = shadow.host as HTMLElement;
  host.style.setProperty('z-index', '2147482990', 'important');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('data-byte-maze', '');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;isolation:isolate;';
  shadow.append(svg);
  let runner: SVGGElement, body: SVGPathElement, guard: SVGCircleElement, fruit: SVGGElement;
  let ghostNodes: SVGGElement[] = [], pelletNodes: SVGElement[] = [];
  let frame: Frame;
  function measure(): Frame {
    const r = host.getBoundingClientRect();
    const scaleX = r.width / (host.clientWidth || r.width) || 1, scaleY = r.height / (host.clientHeight || r.height) || 1;
    const left = Math.max(8, r.left), top = Math.max(8, r.top), right = Math.min(api.width - 8, r.right), bottom = Math.min(api.height - 8, r.bottom);
    const wallElements = new Set<Element>(api.board.targets.map(t => t.element).filter(Boolean));
    for (const el of root!.querySelectorAll('[data-byte-wall]')) if (!el.closest('[data-virus-ignore]')) wallElements.add(el);
    const hud = doc.querySelector('[data-dom-virus-root]')?.shadowRoot;
    for (const el of hud?.querySelectorAll('.hud,.dpad') ?? []) wallElements.add(el);
    const walls: Wall[] = [];
    for (const el of [...wallElements].slice(0, 50)) {
      const b = el.getBoundingClientRect();
      if (b.width && b.height && b.right > left && b.left < right && b.bottom > top && b.top < bottom) walls.push({ left: (b.left - left) / scaleX, right: (b.right - left) / scaleX, top: (b.top - top) / scaleY, bottom: (b.bottom - top) / scaleY });
    }
    const width = Math.max(0, (right - left) / scaleX), height = Math.max(0, (bottom - top) / scaleY);
    const x = (left - r.left) / scaleX, y = (top - r.top) / scaleY;
    const key = [x, y, width, height, ...walls.flatMap(w => [w.left, w.top, w.right, w.bottom])].map(n => Math.round(n / 12)).join(',');
    return { x, y, width, height, scaleX, scaleY, left, top, walls, key };
  }
  function mount(maze: Maze, nextFrame: Frame) {
    frame = nextFrame;
    svg.style.left = `${frame.x}px`; svg.style.top = `${frame.y}px`;
    svg.setAttribute('width', String(frame.width)); svg.setAttribute('height', String(frame.height));
    svg.setAttribute('viewBox', `0 0 ${frame.width || 1} ${frame.height || 1}`);
    const dark = api.options.theme === 'dark' || (api.options.theme !== 'light' && doc.defaultView!.matchMedia('(prefers-color-scheme:dark)').matches);
    const track = dark ? '#100a1bc7' : '#ffffffc7';
    svg.innerHTML = `<path d="${maze.path}" stroke="#628dce" stroke-width="30" stroke-linecap="square" stroke-linejoin="miter" fill="none"/><path d="${maze.path}" stroke="${track}" stroke-width="26" stroke-linecap="square" stroke-linejoin="miter" fill="none"/><g data-byte-food></g><g data-byte-fruit visibility="hidden" shape-rendering="crispEdges"></g><g data-byte-ghosts></g><g data-byte-runner><circle r="17" fill="none" stroke="#8573ee" stroke-width="2"/><g data-byte-body shape-rendering="crispEdges"><path fill="#cdde00" stroke="#222e56" stroke-width=".6" d="${RUNNER_OPEN}"/><path d="M5 2h2v2H5Z" fill="#222e56"/></g></g>`;
    const food = svg.querySelector('[data-byte-food]')!;
    pelletNodes = maze.pellets.map(p => {
      const node = doc.createElementNS(NS, p.power ? 'g' : 'circle');
      node.setAttribute(p.power ? 'data-byte-power' : 'data-byte-pellet', String(p.id));
      if (p.power) { node.setAttribute('transform', `translate(${p.x} ${p.y})`); node.innerHTML = '<circle r="12" fill="#f4457a" opacity=".16"/><circle r="9" fill="#f4457a" opacity=".3"/><circle r="6" fill="#f4457a" stroke="#fff4ff" stroke-width="1.5"/>'; }
      else { node.setAttribute('cx', String(p.x)); node.setAttribute('cy', String(p.y)); node.setAttribute('r', '2.8'); node.setAttribute('fill', dark ? '#fff4df' : '#6758bd'); }
      if (p.eaten) node.setAttribute('visibility', 'hidden');
      food.append(node); return node;
    });
    runner = svg.querySelector<SVGGElement>('[data-byte-runner]')!;
    body = runner.querySelector('path')!; guard = runner.querySelector('circle')!;
    fruit = svg.querySelector('[data-byte-fruit]')!;
    ghostNodes = []; lastMouth = -1;
  }
  let origin = { x: 0, y: 0 };
  const syncPosition = () => { const r = host.getBoundingClientRect(); origin = { x: r.left, y: r.top }; };
  const viewport = (p: Point): Point => ({ x: origin.x + (frame.x + p.x) * frame.scaleX, y: origin.y + (frame.y + p.y) * frame.scaleY });
  let lastMouth = -1;
  return {
    measure, mount, viewport, syncPosition,
    eat(id: number) { pelletNodes[id]?.setAttribute('visibility', 'hidden'); },
    render(player: Actor | null, ghosts: readonly (Actor & { kind: number })[], power: number, shield: number, bonus: (Point & { kind: number }) | null) {
      if (!runner) return;
      runner.setAttribute('visibility', player ? 'visible' : 'hidden');
      if (!player) return;
      runner.setAttribute('transform', `translate(${player.x.toFixed(2)} ${player.y.toFixed(2)})`);
      runner.querySelector('[data-byte-body]')!.setAttribute('transform', `rotate(${Math.max(0, player.direction) * 90}) scale(1.65) translate(-7 -7)`);
      guard.setAttribute('visibility', power > 0 || shield > 0 ? 'visible' : 'hidden');
      guard.setAttribute('stroke', power > 0 ? '#f4457a' : '#8573ee');
      const mouth = api.reducedMotion ? 1 : Math.floor(api.time * 9) % 2;
      if (mouth !== lastMouth) { body.setAttribute('d', mouth ? RUNNER_OPEN : RUNNER_CLOSED); lastMouth = mouth; }
      const layer = svg.querySelector('[data-byte-ghosts]')!;
      while (ghostNodes.length < ghosts.length) {
        const g = doc.createElementNS(NS, 'g'); g.setAttribute('data-byte-ghost', ''); g.setAttribute('shape-rendering', 'crispEdges');
        g.innerHTML = `<path d="${GHOST}" stroke="#222e56" stroke-width=".6"/><path fill="#fff4ff" d="M2 4h4v5H2zm6 0h4v5H8Z"/><path data-pupils fill="#222e56" d="M4 5h2v3H4zm6 0h2v3h-2Z"/>`; layer.append(g); ghostNodes.push(g);
      }
      while (ghostNodes.length > ghosts.length) ghostNodes.pop()!.remove();
      ghosts.forEach((g, i) => {
        const node = ghostNodes[i]!;
        node.setAttribute('transform', `translate(${g.x.toFixed(2)} ${g.y.toFixed(2)}) scale(1.6) translate(-7 -7)`);
        node.firstElementChild!.setAttribute('fill', power > 0 ? (power < 2 && Math.floor(api.time * 5) % 2 ? '#fff4ff' : '#628dce') : ['#8573ee', '#f4457a', '#06c4ff'][g.kind % 3]!);
        node.querySelector('[data-pupils]')!.setAttribute('transform', `translate(${g.direction === 2 ? -2 : g.direction === 0 ? 0 : -1} ${g.direction === 1 ? 1 : g.direction === 3 ? -1 : 0})`);
      });
      fruit.setAttribute('visibility', bonus ? 'visible' : 'hidden');
      if (bonus) { fruit.setAttribute('transform', `translate(${bonus.x - 12} ${bonus.y - 12}) scale(1.6)`); if (fruit.getAttribute('data-kind') !== String(bonus.kind)) { fruit.setAttribute('data-kind', String(bonus.kind)); fruit.innerHTML = bonus.kind ? BERRY : CHERRY; } }
    },
  };
}
