require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const PRODUCTOS_MAYOR = require('../productos_mayor.json');
const PRODUCTOS_DETAL = require('../productos_detal.json');
const CONFIG = require('../config.json');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('Migrando productos_mayor...');
  const mayorRows = PRODUCTOS_MAYOR.map(p => ({
    ref_id: p.id,
    lista: 'mayor',
    categoria: p.categoria,
    nombre: p.nombre,
    empaque: p.empaque || '',
    presentacion: p.presentacion,
    precio: p.precio,
    disponible: p.disponible ?? true,
    utilidad: p.utilidad ?? 0,
    etiqueta: p.etiqueta || ''
  }));

  const { error: err1 } = await supabase.from('productos').upsert(mayorRows, { onConflict: 'lista,ref_id' });
  if (err1) { console.error('Error mayor:', err1); process.exit(1); }
  console.log(`  ${mayorRows.length} productos insertados`);

  console.log('Migrando productos_detal...');
  const detalRows = PRODUCTOS_DETAL.map(p => ({
    ref_id: p.id,
    lista: 'detal',
    categoria: p.categoria,
    nombre: p.nombre,
    empaque: p.empaque || '',
    presentacion: p.presentacion,
    precio: p.precio,
    disponible: p.disponible ?? true,
    utilidad: p.utilidad ?? 0,
    etiqueta: p.etiqueta || ''
  }));

  const { error: err2 } = await supabase.from('productos').upsert(detalRows, { onConflict: 'lista,ref_id' });
  if (err2) { console.error('Error detal:', err2); process.exit(1); }
  console.log(`  ${detalRows.length} productos insertados`);

  console.log('Migrando configuracion...');
  const { error: err3 } = await supabase.from('configuracion').upsert({
    id: 1,
    tasa_bcv: CONFIG.tasa_bcv,
    diferencial: CONFIG.diferencial,
    ultima_actualizacion: CONFIG.ultima_actualizacion,
    updated_at: new Date().toISOString()
  });
  if (err3) { console.error('Error config:', err3); process.exit(1); }
  console.log('  Configuracion insertada');

  console.log('Migración completada exitosamente.');
}

migrate();
