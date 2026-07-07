import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // 1. Tus plugins originales (React y Tailwind v4)
    plugins: [react(), tailwindcss()],
    
    // 2. Tus rutas asignadas originales
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    
    // 3. La configuración obligatoria de AI Studio para evitar parpadeos
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },

    // 🛡️ 4. NUEVA INYECCIÓN: Tus credenciales reales integradas sin romper nada
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        'https://iqxwrfjfdvixidsnfwja.supabase.co/auth/v1/callback'
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeHdyZmpmZHZpeGlkc25md2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjc2NDEsImV4cCI6MjA5NjcwMzY0MX0.mt76SY7Op1JdsjnJ3YoMQocWz40-Q0gp23poSqKTaEg'
      )
    }
  };
});