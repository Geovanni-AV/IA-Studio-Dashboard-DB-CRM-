import fetch from 'node-fetch';

const url = 'https://iqxwrfjfdvixidsnfwja.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeHdyZmpmZHZpeGlkc25md2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjc2NDEsImV4cCI6MjA5NjcwMzY0MX0.mt76SY7Op1JdsjnJ3YoMQocWz40-Q0gp23poSqKTaEg';

async function run() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  };

  const res = await fetch(url, { headers });
  console.log("Status:", res.status, res.statusText);
  const data = (await res.json()) as any;
  
  if (data.paths) {
    console.log("Paths available:");
    console.log(Object.keys(data.paths));
  }
  
  if (data.definitions && data.definitions.Contactos) {
    console.log("\nDefinition for Contactos:");
    console.log(JSON.stringify(data.definitions.Contactos, null, 2));
  } else {
    console.log("\nNo definition found for Contactos in OpenAPI specs");
    if (data.definitions) {
      console.log("Available definitions:", Object.keys(data.definitions));
    }
  }
}

run();
