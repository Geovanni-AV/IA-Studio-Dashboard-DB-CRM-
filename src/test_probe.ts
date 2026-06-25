import fetch from 'node-fetch';

const url = 'https://iqxwrfjfdvixidsnfwja.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeHdyZmpmZHZpeGlkc25md2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjc2NDEsImV4cCI6MjA5NjcwMzY0MX0.mt76SY7Op1JdsjnJ3YoMQocWz40-Q0gp23poSqKTaEg';

async function run() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  const candidates = ['contactos', 'Contactos', 'contacts'];
  for (const cand of candidates) {
    const encoded = encodeURIComponent(cand);
    try {
      const selectQuery = (cand === 'Contactos' || cand === 'contactos') ? '*' : 'id';
      const res = await fetch(`${url}/rest/v1/${encoded}?select=${selectQuery}&limit=1`, { headers, method: 'GET' });
      const text = await res.text();
      console.log(`Cand: ${cand}, Status: ${res.status}, Response: ${text.substring(0, 200)}`);
    } catch (e: any) {
      console.log(`Cand: ${cand}, Error: ${e.message}`);
    }
  }
}

run();
