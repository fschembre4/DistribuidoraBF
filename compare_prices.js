const fs = require('fs');

// ─── Parse PDF text ───────────────────────────────────────────────────────
function parsePDFList(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const products = [];
  let currentCategory = '';
  let inTable = false;

  for (const line of lines) {
    // Skip headers and page markers
    if (line.startsWith('A2 -') || line.startsWith('0424-') || line.match(/^\s*-- \d+ of \d+ --/) || line.includes('page_number')) continue;

    // Check for category header: all uppercase, followed by table header
    if (line === line.toUpperCase() && line.length > 5 && !line.startsWith('#')) {
      currentCategory = line;
      inTable = false;
      continue;
    }

    // Detect table header (has #, Producto, Empaque)
    if (line.startsWith('#') && line.includes('Producto') && line.includes('Empaque')) {
      inTable = true;
      continue;
    }

    if (!inTable) continue;

    // Parse product row: # \t Producto \t Empaque \t Presentacion \t Precio
    const parts = line.split('\t').map(p => p.trim());
    if (parts.length < 5) continue;

    const id = parseInt(parts[0]);
    if (isNaN(id)) continue;

    const nombre = parts[1];
    const empaque = parts[2];
    // Handle presentacion which might be multiple words, "x" separator, or a number
    const presentacion = parts[3];
    let precio = parts[4].replace('$', '').trim();

    // Handle when price might have extra info appended
    if (precio.startsWith('$')) precio = precio.substring(1);
    if (precio.includes(' ')) precio = precio.split(' ')[0];
    const precioNum = parseFloat(precio);

    // Handle multi-presentacion rows (same # repeated)
    const existing = products.find(p => p.ref_id === id && p.nombre === nombre && p.empaque === empaque && p.presentacion === presentacion);
    if (existing) continue;

    products.push({
      ref_id: id,
      categoria: currentCategory,
      nombre,
      empaque,
      presentacion,
      precio: isNaN(precioNum) ? null : precioNum,
      precioRaw: parts[4]
    });
  }
  return products;
}

// ─── Normalize name for matching ──────────────────────────────────────────
function normalize(n) {
  return n.toLowerCase()
    .replace(/[áäàâ]/g, 'a').replace(/[éëèê]/g, 'e').replace(/[íïìî]/g, 'i')
    .replace(/[óöòô]/g, 'o').replace(/[úüùû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Match and compare ────────────────────────────────────────────────────
function compareLists(pdfProducts, dbProducts, listName) {
  const matched = [];
  const unmatched = [];
  const priceDiffs = [];

  const dbMap = new Map();
  for (const p of dbProducts) {
    const key = normalize(p.nombre) + '|' + normalize(p.empaque || '') + '|' + normalize(p.presentacion || '');
    if (!dbMap.has(key)) dbMap.set(key, []);
    dbMap.get(key).push(p);
  }

  for (const pdf of pdfProducts) {
    if (pdf.precio === null) continue;
    const key = normalize(pdf.nombre) + '|' + normalize(pdf.empaque || '') + '|' + normalize(pdf.presentacion || '');
    const dbCandidates = dbMap.get(key);

    if (!dbCandidates || dbCandidates.length === 0) {
      // Try matching by name only
      const nameKey = normalize(pdf.nombre);
      let found = false;
      for (const p of dbProducts) {
        if (normalize(p.nombre) === nameKey) {
          if (Math.abs(p.precio - pdf.precio) > 0.01) {
            priceDiffs.push({ pdf, db: p, diff: p.precio - pdf.precio, list: listName });
          }
          matched.push({ pdf, db: p });
          found = true;
          break;
        }
      }
      if (!found) {
        unmatched.push({ pdf, reason: 'No encontrado en BD', list: listName });
      }
      continue;
    }

    // Find best match by price proximity
    let bestMatch = null;
    let bestDiff = Infinity;
    for (const db of dbCandidates) {
      const diff = Math.abs(db.precio - pdf.precio);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = db;
      }
    }

    if (bestMatch) {
      if (Math.abs(bestMatch.precio - pdf.precio) > 0.01) {
        priceDiffs.push({ pdf, db: bestMatch, diff: bestMatch.precio - pdf.precio, list: listName });
      }
      matched.push({ pdf, db: bestMatch });
    } else {
      unmatched.push({ pdf, reason: 'Sin match en BD', list: listName });
    }
  }

  // Find DB products not in PDF
  const extraInDB = [];
  const pdfNames = new Set(pdfProducts.map(p => normalize(p.nombre)));
  for (const db of dbProducts) {
    if (!pdfNames.has(normalize(db.nombre))) {
      extraInDB.push({ db, list: listName });
    }
  }

  return { matched, unmatched, priceDiffs, extraInDB };
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const mayorPDF = parsePDFList(fs.readFileSync('ListasCostos/mayor_extracted.txt', 'utf8'));
  const detalPDF = parsePDFList(fs.readFileSync('ListasCostos/detal_extracted.txt', 'utf8'));
  const mayorDB = JSON.parse(fs.readFileSync('mayor_supabase.json', 'utf8'));
  const detalDB = JSON.parse(fs.readFileSync('detal_supabase.json', 'utf8'));

  console.log('=== PRODUCTOS EN PDF ===');
  console.log('Mayor PDF:', mayorPDF.length, 'productos');
  console.log('Detal PDF:', detalPDF.length, 'productos');
  console.log('');
  console.log('=== PRODUCTOS EN SUPABASE ===');
  console.log('Mayor DB:', mayorDB.length, 'productos');
  console.log('Detal DB:', detalDB.length, 'productos');
  console.log('');

  const mayorResult = compareLists(mayorPDF, mayorDB, 'MAYOR');
  const detalResult = compareLists(detalPDF, detalDB, 'DETAL');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             AUDITORÍA DE PRECIOS - RESUMEN                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const result of [mayorResult, detalResult]) {
    const name = result === mayorResult ? 'MAYOR' : 'DETAL';
    console.log(`── ${name} ──`);
    console.log(`  Coincidencias: ${result.matched.length}`);
    console.log(`  Discrepancias precio: ${result.priceDiffs.length}`);
    console.log(`  No encontrados en BD: ${result.unmatched.length}`);
    console.log(`  Extras en BD (no en PDF): ${result.extraInDB.length}`);
    console.log('');

    if (result.priceDiffs.length > 0) {
      console.log(`  ⚠️  DISCREPANCIAS DE PRECIO (${name}):`);
      for (const d of result.priceDiffs) {
        const cat = d.pdf.categoria || d.db.categoria;
        console.log(`      #${d.pdf.ref_id} "${d.pdf.nombre}" | PDF: $${d.pdf.precio.toFixed(2)} | BD: $${d.db.precio.toFixed(2)} | Diff: ${d.diff > 0 ? '+' : ''}${d.diff.toFixed(2)}`);
      }
      console.log('');
    }

    if (result.unmatched.length > 0) {
      console.log(`  ❓ NO ENCONTRADOS EN BD (${name}):`);
      for (const u of result.unmatched.slice(0, 20)) {
        console.log(`      #${u.pdf.ref_id} "${u.pdf.nombre}" | Cat: ${u.pdf.categoria} | Precio: $${u.pdf.precio?.toFixed(2) || 'N/A'}`);
      }
      if (result.unmatched.length > 20) console.log(`      ... y ${result.unmatched.length - 20} más`);
      console.log('');
    }

    if (result.extraInDB.length > 0) {
      console.log(`  ➕ EXTRAS EN BD (no en PDF) (${name}):`);
      for (const e of result.extraInDB.slice(0, 15)) {
        console.log(`      #${e.db.ref_id} "${e.db.nombre}" | Cat: ${e.db.categoria} | Precio: $${e.db.precio.toFixed(2)}`);
      }
      if (result.extraInDB.length > 15) console.log(`      ... y ${result.extraInDB.length - 15} más`);
      console.log('');
    }
  }

  // Detail of specific categories with issues
  console.log('═══ DETALLE POR CATEGORÍA ═══');
  const allCategories = [...new Set([...mayorPDF, ...detalPDF, ...mayorDB, ...detalDB].map(p => p.categoria))].filter(Boolean).sort();
  for (const cat of allCategories) {
    const pdfCount = [...mayorPDF, ...detalPDF].filter(p => p.categoria === cat).length;
    const dbCount = [...mayorDB, ...detalDB].filter(p => p.categoria === cat).length;
    if (pdfCount > 0 || dbCount > 0) {
      console.log(`  ${cat}: ${pdfCount} pdf vs ${dbCount} bd`);
    }
  }
}

main().catch(e => console.error(e));
