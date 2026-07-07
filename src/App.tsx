import React, { useState, useEffect } from 'react';
import { DataProvider } from './contexts/DataContext';
import { getSupabaseClient } from './supabaseService';
import MainAppContent from './components/MainAppContent';

const getSupabaseConfig = () => {
  const prodUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const prodKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  return {
    url: prodUrl || localStorage.getItem('verse_supabase_url') || '',
    key: prodKey || localStorage.getItem('verse_supabase_key') || ''
  };
};

export default function App() {
  const [supabaseStatus, setSupabaseStatus] = useState<'LOADING' | 'CONNECTED' | 'ERROR' | 'OFFLINE'>('OFFLINE');

  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' | null }>({
    show: false,
    message: '',
    type: null
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ show: true, message, type });
  };

  // Self-dismissing toast duration handler
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, message: '', type: null });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  return (
    <DataProvider supabaseStatus={supabaseStatus} showToast={showToast}>
      <AppContent supabaseStatus={supabaseStatus} setSupabaseStatus={setSupabaseStatus} />
      {/* REGISTRO / TOAST NOTIFICATION FLOATING PANEL */}
      {toast.show && (
        <div className="fixed bottom-14 right-5 z-50">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border text-xs font-semibold ${
            toast.type === 'success' 
              ? 'bg-emerald-950/95 text-white border-emerald-500' 
              : toast.type === 'error'
                ? 'bg-red-950/95 text-white border-red-500 animate-pulse'
                : 'bg-slate-900/95 text-white border-slate-700'
          }`}>
            <span className="w-2 h-2 rounded-full animate-ping bg-white shrink-0 font-bold"></span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </DataProvider>
  );
}

function AppContent({ supabaseStatus, setSupabaseStatus }: {
  supabaseStatus: 'LOADING' | 'CONNECTED' | 'ERROR' | 'OFFLINE';
  setSupabaseStatus: React.Dispatch<React.SetStateAction<'LOADING' | 'CONNECTED' | 'ERROR' | 'OFFLINE'>>;
}) {
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const isAuthenticated = !!session;

  const { url, key } = getSupabaseConfig();
  const supabase = getSupabaseClient(url, key);

  const googleUser = session?.user ? {
    name: session.user.user_metadata?.full_name || session.user.email || '',
    email: session.user.email || '',
    picture: session.user.user_metadata?.avatar_url || ''
  } : null;

  // Intercept Google Auth popup callback before routing/bootstrapping to prevent recursive app loading
  if (typeof window !== 'undefined' && window.opener && window.location.hash.includes('access_token')) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const state = params.get('state');
    if (token && state === 'sheets_sync') {
      try {
        window.opener.postMessage({ type: 'GOOGLE_SHEETS_TOKEN', token }, '*');
      } catch (err) {
        console.error("Error sending token to opener:", err);
      }
      setTimeout(() => {
        window.close();
      }, 150);
    } else {
      try {
        window.opener.postMessage({ 
          type: 'SUPABASE_AUTH_SUCCESS',
          accessToken: token,
          refreshToken: refreshToken
        }, '*');
      } catch (err) {
        console.error("Error sending success message to opener:", err);
      }
      setTimeout(() => {
        window.close();
      }, 150);
    }
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-10 h-10 border-2 border-t-transparent border-blue-500 rounded-full animate-spin mb-4"></div>
        <h2 className="text-base font-bold mb-1">Vinculando Cuenta Google...</h2>
        <p className="text-xs text-slate-400">Esta ventana emergente de autorización se cerrará automáticamente.</p>
      </div>
    );
  }

  // 🛡️ Error de Infraestructura Core si Supabase no está configurado de forma segura
  if (!supabase) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="max-w-md w-full bg-slate-800 border border-red-500/30 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3 text-red-400 font-bold text-lg">
            <span>⚠️ Error de Infraestructura Core</span>
          </div>
          <p className="text-slate-300 text-sm mt-3 leading-relaxed">
            El cliente de persistencia remota no pudo ser inicializado de forma segura. 
            Este fallo ocurre si las variables <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-400 text-xs">VITE_SUPABASE_URL</code> no fueron inyectadas correctamente durante el empaquetado estático (Build-Time).
          </p>
          <div className="mt-4 bg-slate-950 p-3 rounded-xl font-mono text-xs text-slate-400 border border-slate-700">
            Status: Cliente Supabase No Detectado (Null)
          </div>
        </div>
      </div>
    );
  }

  // Observador de sesión de Supabase Auth
  useEffect(() => {
    // 🛡️ CORRECCIÓN: Cláusula de Guardia para Ventanas Emergentes (Popup Self-Destruction)
    if (typeof window !== 'undefined' && window.opener && (window.location.hash.includes('access_token') || window.location.search.includes('code'))) {
      console.log("🎯 Callback OAuth interceptado dentro del popup. Sincronizando con ventana padre...");
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      try {
        window.opener.postMessage({ 
          type: 'SUPABASE_AUTH_SUCCESS',
          accessToken: token || '',
          refreshToken: refreshToken || ''
        }, window.location.origin);
      } catch (err) {
        console.error("Error sending success message to opener:", err);
      }
      setTimeout(() => {
        window.close();
      }, 150);
      return;
    }

    // Verificar la sesión actual al cargar la página
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setIsAuthLoading(false);
    });

    // Escuchar cambios (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Escuchar mensajes de éxito de autenticación desde la ventana emergente (popup)
  useEffect(() => {
    const handleSupabaseMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        const { accessToken, refreshToken } = event.data;
        if (accessToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          }).then(({ data: { session: currentSession }, error }) => {
            if (error) {
              console.error("Error setting session from popup:", error);
              return;
            }
            if (currentSession) {
              setSession(currentSession);
              setIsAuthLoading(false);
            }
          });
        } else {
          supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            setSession(currentSession);
            setIsAuthLoading(false);
          });
        }
      }
    };
    window.addEventListener('message', handleSupabaseMessage);
    return () => window.removeEventListener('message', handleSupabaseMessage);
  }, [supabase]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-10 h-10 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin mb-4"></div>
        <h2 className="text-base font-bold mb-1">Cargando Sesión de Usuario...</h2>
        <p className="text-xs text-slate-400">Restableciendo conexión segura con Verse Connect.</p>
      </div>
    );
  }

  if (!isAuthenticated || !googleUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-3xl shadow-md flex flex-col items-center text-center">
          
          {/* 🛡️ PORTAL TOTALMENTE PURGADO DE CÓDIGO LEGADO B2C */}
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-sm mb-4">
            V
          </div>
          <h2 className="text-slate-900 font-black text-2xl tracking-tight">Portal Oficial de Acceso</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Usa tu cuenta institucional de Google autorizada para ingresar a la consola comercial de Verse Connect de forma segura.
          </p>

          <div className="w-full my-6 border-b border-slate-100" />

          <button 
            onClick={async () => {
              try {
                // Try iframe-safe popup Auth first to ensure it operates correctly in frames
                const { data, error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: window.location.origin, 
                    skipBrowserRedirect: true, // Evita que Google bloquee el iframe
                    queryParams: {
                      access_type: 'offline',
                      prompt: 'consent',
                    }
                  }
                });

                if (error) throw error;
                
                if (data?.url) {
                  const width = 600;
                  const height = 650;
                  const left = window.screen.width / 2 - width / 2;
                  const top = window.screen.height / 2 - height / 2;
                  
                  window.open(
                    data.url,
                    'google_oauth_popup',
                    `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
                  );
                } else {
                  // Fallback regular
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin }
                  });
                }
              } catch (err) {
                console.warn("Direct popup OAuth rejected, falling back to standard redirect:", err);
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: window.location.origin }
                });
              }
            }}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all hover:border-slate-300"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            <span>Iniciar Sesión con Google</span>
          </button>

          <div className="w-full mt-4 bg-slate-50 p-3 rounded-xl text-left border border-slate-100">
            <h4 className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
              Seguridad &amp; Integraciones Activas
            </h4>
            <p className="text-slate-500 text-[11px] mt-1 leading-normal">
              Acceso protegido bajo políticas RLS corporativas de Supabase Cloud. Registro de auditoría inmutable persistido mediante transacciones ACID nativas.
            </p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <MainAppContent 
      session={session} 
      setSession={setSession} 
      supabaseStatus={supabaseStatus} 
      setSupabaseStatus={setSupabaseStatus} 
    />
  );
}
