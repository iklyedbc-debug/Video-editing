// One-off: turn lucide-static icon nodes into one SVG path string per icon (24x24 viewBox).
// Usage: node build_icons.mjs <lucide-static dir> <out icons.js>
import fs from 'fs';
const [dir, out] = process.argv.slice(2);
const nodes = JSON.parse(fs.readFileSync(dir + '/icon-nodes.json', 'utf8'));
const tags = JSON.parse(fs.readFileSync(dir + '/tags.json', 'utf8'));
const n = v => +(+v).toFixed(2);
function circle(cx, cy, rx, ry) {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
}
function rect(a) {
  const x = +a.x || 0, y = +a.y || 0, w = +a.width, h = +a.height;
  let r = Math.min(+(a.rx ?? a.ry ?? 0), w / 2, h / 2);
  if (!r) return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
  return `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(h - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(w - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}v${n(-(h - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}Z`;
}
const icons = {};
for (const [name, list] of Object.entries(nodes)) {
  const parts = [];
  for (const [tag, a] of list) {
    if (tag === 'path') parts.push(a.d);
    else if (tag === 'circle') parts.push(circle(+a.cx, +a.cy, +a.r, +a.r));
    else if (tag === 'ellipse') parts.push(circle(+a.cx, +a.cy, +a.rx, +a.ry));
    else if (tag === 'rect') parts.push(rect(a));
    else if (tag === 'line') parts.push(`M${a.x1} ${a.y1}L${a.x2} ${a.y2}`);
    else if (tag === 'polyline' || tag === 'polygon') parts.push('M' + a.points.trim().replace(/\s+/g, ' ') + (tag === 'polygon' ? 'Z' : ''));
  }
  icons[name] = parts;
}
fs.writeFileSync(out, 'window.ICONDATA=' + JSON.stringify({ icons, tags }) + ';');
console.log(Object.keys(icons).length, 'icons');
