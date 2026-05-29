const fs = require('fs');
require('dotenv').config();
async function main() {
  const headers = { apikey: process.env.SUPABASE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_KEY };
  const supabaseUrl = process.env.SUPABASE_URL;

  const [mayorRes, detalRes] = await Promise.all([
    fetch(supabaseUrl + '/rest/v1/productos?select=*&lista=eq.mayor&order=ref_id.asc', { headers }),
    fetch(supabaseUrl + '/rest/v1/productos?select=*&lista=eq.detal&order=ref_id.asc', { headers })
  ]);

  const mayor = await mayorRes.json();
  const detal = await detalRes.json();

  fs.writeFileSync('mayor_supabase.json', JSON.stringify(mayor, null, 2));
  fs.writeFileSync('detal_supabase.json', JSON.stringify(detal, null, 2));
  console.log('Mayor:', mayor.length, '| Detal:', detal.length);
}
main().catch(e => console.error(e));
