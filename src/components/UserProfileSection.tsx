import React from 'react';
import { UserRole } from '../types';
import { User, Shield, Key, Signpost, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

interface UserProfileSectionProps {
  googleUser: { name: string; email: string; picture: string } | null;
  googleToken: string;
  role: UserRole;
  onChangeRole: (newRole: UserRole) => void;
  onDisconnect: () => void;
}

export default function UserProfileSection({
  googleUser,
  googleToken,
  role,
  onChangeRole,
  onDisconnect,
}: UserProfileSectionProps) {
  const userEmail = googleUser?.email || 'geovanni@verse-technology.com';
  const userName = googleUser?.name || 'Geovanni Verse';
  const userPicture = googleUser?.picture || '';

  const handleLogoutClick = () => {
    onDisconnect();
  };

  return (
    <div className="space-y-6 fade-in text-left">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-[#0b1c30]">Ajustes de Perfil de Usuario</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestiona las políticas de acceso, roles simulados B2B y las credenciales activas del ecosistema comercial.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Account Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
              Credencial Activa
            </span>
            <div className="flex items-center gap-4">
              {userPicture ? (
                <img
                  referrerPolicy="no-referrer"
                  src={userPicture}
                  alt={userName}
                  className="w-16 h-16 rounded-full border-2 border-emerald-500 shadow-sm object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-750 flex items-center justify-center text-xl font-bold text-white shadow-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-bold text-lg text-slate-800 leading-tight">{userName}</h3>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-150">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Conexión Activa
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correo Electrónico Autenticado</span>
                <span className="text-sm font-semibold text-slate-700 font-mono leading-none">{userEmail}</span>
              </div>
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Método de Acceso</span>
                <span className="text-xs font-semibold text-slate-650 flex items-center gap-1.5 mt-0.5">
                  <svg className="h-4 w-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  Google Enterprise Single Sign-On
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-650 p-3 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all duration-200 text-xs font-bold uppercase tracking-wider shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión Segura
          </button>
        </div>

        {/* Middle Card: Role Simulation Details */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-6 lg:col-span-2">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
              Control Técnico de Perfiles & Roles
            </span>
            <p className="text-xs text-slate-500 leading-relaxed">
              Seleccione abajo el perfil operativo que desea simular para evaluar las restricciones de la bitácora técnica de seguridad, el bridge de datos de Google Sheets y las políticas de la mesa de control comercial.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <button
                type="button"
                onClick={() => onChangeRole('Admin')}
                className={`p-4 rounded-xl text-left border transition-all ${
                  role === 'Admin'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-100 shadow-3xs'
                    : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-1.5 rounded-lg ${role === 'Admin' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Shield className="w-4 h-4" />
                  </span>
                  {role === 'Admin' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                </div>
                <h4 className="font-bold text-sm text-slate-800 leading-tight">Administrador</h4>
                <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wide">Acceso Total</p>
                <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                  Autorización absoluta. Reset de datos, depuración de logs e integración activa.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeRole('Vendedor')}
                className={`p-4 rounded-xl text-left border transition-all ${
                  role === 'Vendedor'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-100 shadow-3xs'
                    : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-1.5 rounded-lg ${role === 'Vendedor' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    <User className="w-4 h-4" />
                  </span>
                  {role === 'Vendedor' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                </div>
                <h4 className="font-bold text-sm text-slate-800 leading-tight">Vendedor</h4>
                <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wide">Comercial</p>
                <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                  Gestión operativa. Altas de leads, actualización de cotizaciones y bitácora. No puede limpiar logs.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeRole('Solo Lectura')}
                className={`p-4 rounded-xl text-left border transition-all ${
                  role === 'Solo Lectura'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-100 shadow-3xs'
                    : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-1.5 rounded-lg ${role === 'Solo Lectura' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Signpost className="w-4 h-4" />
                  </span>
                  {role === 'Solo Lectura' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                </div>
                <h4 className="font-bold text-sm text-slate-800 leading-tight">Auditor</h4>
                <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wide">Solo Lectura</p>
                <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                  Inspección pasiva. Consulta tablas e informes financieros, pero no puede editar ni borrar.
                </p>
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-500 leading-normal">
              <strong>Control de Cumplimiento (Compliance):</strong> El rol <strong>{role}</strong> se simula a nivel sesión. Su identidad {userEmail} se asocia automáticamente con este nivel de privilegios al estampar firmas en la base de datos distribuida de Google y Supabase.
            </p>
          </div>
        </div>
      </div>

      {/* Integration details row */}
      <div className="bg-[#f8f9ff] border border-blue-100 rounded-xl p-5 shadow-inner">
        <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
          <Key className="w-4 h-4 text-[#004ddf]" />
          Token de Sincronización API Google
        </h3>
        {googleToken ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              El navegador tiene cargado un token OAuth Bearer para el API de Google Drive y Sheets validado.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] shrink-0"></span>
              <span className="text-[11px] font-mono font-bold bg-[#eff6ff] border border-blue-250 p-1.5 rounded text-[#004ddf] select-all truncate max-w-lg scrollbar-none block">
                {googleToken}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              No se ha inicializado sesión mediante un token OAuth real en esta pestaña. La sincronización se realiza mediante la cuenta cargada de manera predeterminada y persistencia híbrida.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
