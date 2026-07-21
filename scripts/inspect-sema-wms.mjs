// Lista as camadas de IMAGEM (satélite) do WMS da SEMA-MT, por satélite e ano.
// Uso: node scripts/inspect-sema-wms.mjs   (rodar de um IP no Brasil)
const AUTH = process.env.WFS_AUTHKEY || "541085de-9a2e-454e-bdba-eb3d57a2f492";
const OWS = process.env.WFS_BASE_URL || "https://geo.sema.mt.gov.br/geoserver/ows";

const url = `${OWS}?service=WMS&request=GetCapabilities&version=1.3.0&authkey=${AUTH}`;
const xml = await (await fetch(url)).text();
const re = /<Name>\s*([^<]+?)\s*<\/Name>/gi;
const names = new Set();
let m;
while ((m = re.exec(xml))) { const n = m[1].trim(); if (n.includes(":")) names.add(n); }
const all = [...names];
const img = all.filter((n) => /(landsat|sentinel|spot|resourcesat|mosaico|cbers|alos|palsar|ndvi|nir)/i.test(n));
console.log(`WMS renderable=${all.length} imagery=${img.length}`);

const groupOf = (n) =>
  /landsat/i.test(n) ? "Landsat" :
  /sentinel/i.test(n) ? "Sentinel" :
  /spot/i.test(n) ? "SPOT" :
  /resourcesat/i.test(n) ? "RESOURCESAT" : "Outros";

const byGroup = {};
for (const n of img) (byGroup[groupOf(n)] ??= []).push(n);
for (const [g, arr] of Object.entries(byGroup)) {
  const years = [...new Set(arr.map((n) => (n.match(/\b(19|20)\d{2}\b/) || [])[0]).filter(Boolean))].sort();
  console.log(`\n### ${g} (${arr.length}) anos: ${years.join(", ") || "—"}`);
  arr.sort().forEach((n) => console.log("  " + n));
}
