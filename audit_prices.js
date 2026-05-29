const fs = require('fs');

// ─── Parse PDF text ───────────────────────────────────────────────────────
function parsePDFList(text, listType) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const products = [];
  let currentCategory = '';
  let inTable = false;
  let colFormat = null; // 'mayor' (5 cols) or 'detal' (4 cols)

  for (const line of lines) {
    if (line.startsWith('A2 -') || line.startsWith('0424-') || line.match(/^\s*-- \d+ of \d+ --/)) continue;
    if (line === line.toUpperCase() && line.length > 5 && !line.startsWith('#') && line !== 'DETAL') {
      currentCategory = line;
      inTable = false;
      continue;
    }
    if (line.startsWith('#')) {
      const parts = line.split('\t');
      const hasEmpaque = parts.some(p => p.includes('Empaque'));
      const hasPresentacion = parts.some(p => p.includes('Presentacion'));
      if (hasEmpaque && hasPresentacion) colFormat = 'mayor';
      else if (hasPresentacion) colFormat = 'detal';
      inTable = true;
      continue;
    }
    if (!inTable || !colFormat) continue;

    let parts;
    if (colFormat === 'mayor') {
      // # \t Producto \t Empaque \t Presentacion \t Precio
      parts = line.split('\t').map(p => p.trim());
      if (parts.length < 5) continue;
      const id = parseInt(parts[0]);
      if (isNaN(id)) continue;
      let precio = parts[4].replace('$', '').trim();
      if (precio.includes(' ')) precio = precio.split(' ')[0];
      const precioNum = parseFloat(precio);
      products.push({
        ref_id: id, categoria: currentCategory, nombre: parts[1],
        empaque: parts[2], presentacion: parts[3],
        precio: isNaN(precioNum) ? null : precioNum, tipo: listType
      });
    } else if (colFormat === 'detal') {
      // # \t Producto \t Presentacion \t Precio
      parts = line.split('\t').map(p => p.trim());
      if (parts.length < 4) continue;
      const id = parseInt(parts[0]);
      if (isNaN(id)) continue;
      let precio = parts[3].replace('$', '').trim();
      if (precio.includes(' ')) precio = precio.split(' ')[0];
      const precioNum = parseFloat(precio);
      // Parse presentacion to extract weight info
      let empaque = '';
      let presentacion = parts[2];
      if (presentacion.includes(' ')) {
        // e.g., "1 Kg", "500 gr", "10 x 1"
        const presParts = presentacion.split(' ');
        empaque = presParts[0]; // first part is the number
        presentacion = presParts.slice(1).join(' '); // rest is unit
      }
      products.push({
        ref_id: id, categoria: currentCategory, nombre: parts[1],
        empaque, presentacion: parts[2],
        precio: isNaN(precioNum) ? null : precioNum, tipo: listType
      });
    }
  }
  return products;
}

function normalize(n) {
  return n.toLowerCase()
    .replace(/[áäàâ]/g, 'a').replace(/[éëèê]/g, 'e').replace(/[íïìî]/g, 'i')
    .replace(/[óöòô]/g, 'o').replace(/[úüùû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function compareLists(pdfProducts, dbProducts, listName) {
  const priceDiffs = [];
  const unmatchedPDF = [];
  const extraInDB = [];

  const dbMap = new Map();
  for (const p of dbProducts) {
    const key = normalize(p.nombre);
    if (!dbMap.has(key)) dbMap.set(key, []);
    dbMap.get(key).push(p);
  }

  const pdfMap = new Map();
  for (const p of pdfProducts) {
    const key = normalize(p.nombre);
    if (!pdfMap.has(key)) pdfMap.set(key, []);
    pdfMap.get(key).push(p);
  }

  for (const pdf of pdfProducts) {
    if (pdf.precio === null) continue;
    const key = normalize(pdf.nombre);
    const dbCandidates = dbMap.get(key);
    if (!dbCandidates || dbCandidates.length === 0) {
      unmatchedPDF.push(pdf);
      continue;
    }
    // Match by name + approximation by empaque/presentacion
    let bestMatch = null;
    let bestSimilarity = -1;
    for (const db of dbCandidates) {
      let sim = 0;
      if (pdf.empaque && db.empaque && normalize(pdf.empaque) === normalize(db.empaque)) sim += 2;
      if (pdf.presentacion && db.presentacion && normalize(pdf.presentacion) === normalize(db.presentacion)) sim += 1;
      // Price proximity bonus
      const diff = Math.abs(db.precio - pdf.precio);
      if (diff < 0.01 * pdf.precio) sim += 3; // within 1%, strong match
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = db;
      }
    }
    if (!bestMatch) {
      unmatchedPDF.push(pdf);
      continue;
    }
    if (Math.abs(bestMatch.precio - pdf.precio) > 0.005) {
      priceDiffs.push({
        pdf, db: bestMatch,
        diff: bestMatch.precio - pdf.precio,
        diffPct: ((bestMatch.precio - pdf.precio) / pdf.precio * 100).toFixed(1),
        list: listName
      });
    }
  }

  for (const db of dbProducts) {
    const key = normalize(db.nombre);
    const pdfCandidates = pdfMap.get(key);
    if (!pdfCandidates || pdfCandidates.length === 0) {
      extraInDB.push({ db, list: listName });
    }
  }

  return { priceDiffs, unmatchedPDF, extraInDB };
}

async function main() {
  const mayorPDF = parsePDFList(fs.readFileSync('ListasCostos/mayor_extracted.txt', 'utf8'), 'MAYOR');
  const detalPDF = parsePDFList(fs.readFileSync('ListasCostos/detal_extracted.txt', 'utf8'), 'DETAL');
  const mayorDB = JSON.parse(fs.readFileSync('mayor_supabase.json', 'utf8'));
  const detalDB = JSON.parse(fs.readFileSync('detal_supabase.json', 'utf8'));

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   AUDITORÍA COMPLETA: PDF ListasCostos vs Supabase         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('PDF Mayor:', mayorPDF.length, 'productos');
  console.log('PDF Detal:', detalPDF.length, 'productos');
  console.log('DB Mayor:', mayorDB.length, 'productos');
  console.log('DB Detal:', detalDB.length, 'productos');
  console.log('');

  for (const [listName, pdf, db] of [['MAYOR', mayorPDF, mayorDB], ['DETAL', detalPDF, detalDB]]) {
    const result = compareLists(pdf, db, listName);
    console.log(`── ${listName} ──`);
    console.log(`  Productos en PDF: ${pdf.length}`);
    console.log(`  Productos en BD:  ${db.length}`);
    console.log(`  Precios correctos: ${pdf.length - result.priceDiffs.length - result.unmatchedPDF.length}`);
    console.log(`  Discrepancias: ${result.priceDiffs.length}`);
    console.log(`  No encontrados en PDF: ${result.extraInDB.length}`);
    console.log(`  No encontrados en BD:  ${result.unmatchedPDF.length}`);
    console.log('');

    if (result.priceDiffs.length > 0) {
      // Show sample of discrepancies
      const sorted = [...result.priceDiffs].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      console.log(`  ⚠️  DISCREPANCIAS (mostrando ${Math.min(10, sorted.length)} de ${sorted.length}):`);
      console.log(`     ${'Nombre'.padEnd(40)} ${'PDF $'.padStart(8)} ${'DB $'.padStart(8)} ${'Dif $'.padStart(7)} ${'Dif %'.padStart(7)}`);
      console.log(`     ${''.repeat(40)} ${''.padStart(8)} ${''.padStart(8)} ${''.padStart(7)} ${''.padStart(7)}`);
      for (const d of sorted.slice(0, 10)) {
        console.log(`     ${d.pdf.nombre.padEnd(40)} ${d.pdf.precio.toFixed(2).padStart(8)} ${d.db.precio.toFixed(2).padStart(8)} ${d.diff.toFixed(2).padStart(7)} ${d.diffPct.padStart(7)}%`);
      }
      
      // Check if differences are systematic (utility-related)
      const diffs = result.priceDiffs.map(d => parseFloat(d.diffPct));
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const minDiff = Math.min(...diffs);
      const maxDiff = Math.max(...diffs);
      console.log(`     Rango diferencia: ${minDiff}% a ${maxDiff}% | Promedio: ${avgDiff.toFixed(1)}%`);
      
      // Check utilities in DB for these products
      const utilSet = new Set();
      for (const d of result.priceDiffs) {
        if (d.db.utilidad !== undefined) utilSet.add(d.db.utilidad);
      }
      if (utilSet.size > 0) {
        const utils = [...utilSet].sort((a, b) => a - b);
        console.log(`     Utilidades en BD: ${utils.join(', ')}%`);
      }
      console.log('');
    }

    if (result.extraInDB.length > 0) {
      console.log(`  ➕ Extras en BD (no en PDF) (${listName}): ${result.extraInDB.length}`);
      const withPrice = result.extraInDB.filter(e => e.db.precio > 0);
      const withoutPrice = result.extraInDB.filter(e => e.db.precio <= 0);
      console.log(`     Con precio: ${withPrice.length} | Sin precio: ${withoutPrice.length}`);
      if (withPrice.length > 0) {
        console.log(`     Con precio (muestra):`);
        for (const e of withPrice.slice(0, 5)) {
          console.log(`       #${e.db.ref_id} "${e.db.nombre}" $${e.db.precio.toFixed(2)}`);
        }
      }
      console.log('');
    }

    if (result.unmatchedPDF.length > 0) {
      console.log(`  ❓ En PDF no en BD (${listName}): ${result.unmatchedPDF.length}`);
      for (const p of result.unmatchedPDF.slice(0, 10)) {
        console.log(`       #${p.ref_id} "${p.nombre}" $${p.precio?.toFixed(2) || 'N/A'} [${p.categoria}]`);
      }
      if (result.unmatchedPDF.length > 10) console.log(`       ... y ${result.unmatchedPDF.length - 10} más`);
      console.log('');
    }
  }
}

main().catch(e => console.error(e));
