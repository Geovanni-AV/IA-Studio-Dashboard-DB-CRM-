import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Creamos el cliente de caché con reglas estrictas de rendimiento
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Los datos se consideran "frescos" por 5 minutos (No se vuelve a consultar Supabase en ese tiempo)
      refetchOnWindowFocus: false, // Evita recargar datos si el usuario cambia de pestaña en Chrome y regresa
      retry: 1, // Si falla la red, intenta 1 vez más
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
