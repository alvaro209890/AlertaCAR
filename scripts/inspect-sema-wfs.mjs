// Lista as camadas WFS da SEMA-MT por categoria (verificação do catálogo).
// Uso: node scripts/inspect-sema-wfs.mjs   (rodar de um IP no Brasil)
// A authkey da SEMA é pública; sobreponha via env WFS_AUTHKEY se preferir.
const AUTH = process.env.WFS_AUTHKEY || "541085de-9a2e-454e-bdba-eb3d57a2f492";
const OWS = process.env.WFS_BASE_URL || "https://geo.sema.mt.gov.br/geoserver/ows";

const url = `${OWS}?service=WFS&request=GetCapabilities&version=2.0.0&authkey=${AUTH}`;
const xml = await (await fetch(url)).text();
const re = /<(?:Name|wfs:Name)>\s*([^<]+?)\s*<\/(?:Name|wfs:Name)>/gi;
const names = new Set();
let m;
while ((m = re.exec(xml))) { const n = m[1].trim(); if (n.includes(":")) names.add(n); }
const all = [...names];
console.log(`WFS bytes=${xml.length} renderable=${all.length}`);

const cats = {
  "CAR/SIMCAR": /:(CAR_|SIMCAR_|MVW_REQUERIMENTO)/i,
  Fiscalizacao: /(EMBARG|INFRACAO|INSPECAO|NOTIFICACAO|FISCALIZACAO|DESEMBARG|AUTOS_|APREENSAO|DEPOSITO|SOLTURA|LAS)/i,
  Licenciamento: /(SIMLAMGEO|LICENC|SIGA_LAC|_LP|_LI|_LO)/i,
  Autorizacao: /(AUTORIZACAO|AUTEX|PMFS|DESMATE|EXPLORACAO)/i,
  Fundiario: /(TERRAS_INDIGENAS|UNIDADE|ASSENTAMENTO|CORREDOR|QUILOMBOLA|GLEBA|INCRA|INTERMAT)/i,
  DesmateHist: /(DESMATAMENTO|PRODES|DETER|USO_CONSOLIDADO)/i,
  Hidrografia: /(HIDRO|DRENAGEM|NASCENTE|RIO|BACIA|MASSA_DAGUA|RESERVATORIO)/i,
  Vegetacao: /(VEGETACAO|FLORESTA|BIOMA|TIPOLOGIA|VEREDA|MANGUE|RESTINGA|SAVANA)/i,
};
for (const [cat, rx] of Object.entries(cats)) {
  const hits = all.filter((n) => rx.test(n)).sort();
  console.log(`\n### ${cat} (${hits.length})`);
  hits.forEach((n) => console.log("  " + n));
}
