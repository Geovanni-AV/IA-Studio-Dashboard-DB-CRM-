import fetch from 'node-fetch';

const url = 'https://iqxwrfjfdvixidsnfwja.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeHdyZmpmZHZpeGlkc25md2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjc2NDEsImV4cCI6MjA5NjcwMzY0MX0.mt76SY7Op1JdsjnJ3YoMQocWz40-Q0gp23poSqKTaEg';

const candidates = ['DB CRM', 'DB_CRM', 'db_crm', 'contactos', 'Contactos', 'contacts', 'CONTACTS', 'crm_records', 'audit_logs', 'Usuarios', 'usuarios'];

async function run() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  console.log("=== PROBING ALL TABLE CANDIDATES ===");
  for (const cand of candidates) {
    try {
      // Fetch with select=* and limit=2 to see columns and if there are any rows
      const res = await fetch(`${url}/${cand}?select=*&limit=2`, { headers, method: 'GET' });
      console.log(`Table "${cand}": status = ${res.status} ${res.statusText}`);
      if (res.ok) {
        const rows = await res.json() as any[];
        console.log(`  -> Exists! Row count returned: ${rows.length}`);
        if (rows.length > 0) {
          console.log(`  -> Column names:`, Object.keys(rows[0]));
          console.log(`  -> Sample row:`, JSON.stringify(rows[0], null, 2));
        } else {
          console.log(`  -> Active table but returned 0 rows.`);
        }
      } else {
        const text = await res.text();
        console.log(`  -> Failed: ${text.substring(0, 150)}`);
      }
    } catch (err: any) {
      console.log(`  -> Error querying ${cand}:`, err.message);
    }
  }
}

run();
