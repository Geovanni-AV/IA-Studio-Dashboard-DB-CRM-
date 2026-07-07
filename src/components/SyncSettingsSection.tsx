import React, { useState, useEffect } from 'react';
import { UserRole, CRMRecord } from '../types';
import { 
  Database, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  Sparkles
} from 'lucide-react';

interface SyncSettingsSectionProps {
  role: UserRole;
  onResetDatabase: () => void;
  onSyncComplete?: (logs: any[], records?: CRMRecord[]) => void;
  onShowAudit: (action: string, details: string) => void;
}

export default function SyncSettingsSection({
  role,
  onResetDatabase,
  onShowAudit
}: SyncSettingsSectionProps) {
  const isSuperAdmin = role === 'Admin';

  const handleReset = () => {
    if (!isSuperAdmin) {
      alert("🔒 Acción restringida: Solo el usuario administrador con rol 'Admin' puede realizar el restablecimiento administrativo de prueba local.");
      return;
    }

    if (window.confirm('¿Está seguro de que desea restablecer la base de datos? Se perderán las modificaciones locales y se regresará a los expedientes estándar.')) {
      onResetDatabase();
      onShowAudit('RESTABLECIMIENTO', 'Reestableció la base de datos local a valores estándar de prueba.');
      alert('Base de datos restablecida correctamente a sus valores de fábrica.');
    }
  };

  return (
    <div className="space-y-6 fade-in text-left">
      <div className="pb-2">
        <h1 className="text-2xl font-bold text-[#0b1c30]">Ajustes de Infraestructura y Marca</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configura la identidad corporativa visual de Verse Technology y gestiona la persistencia de prueba local del Sandbox.
        </p>
      </div>

      {/* BANNERS DE CONTROL EXCLUSIVO DE INFRAESTRUCTURA */}
      {!isSuperAdmin ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Modo de Visualización Autorizado (Solo Lectura)</p>
            <p className="leading-relaxed font-medium">
              Estás visualizando el panel de infraestructura. Solo los usuarios con rol <strong className="font-bold text-slate-900">Admin</strong> tienen facultades de escritura, cambio de logo y restablecimiento de base de datos.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Sesión de Administrador Detectada</p>
            <p className="leading-relaxed font-medium">
              Tienes privilegios administrativos completos para reconfigurar la identidad de marca, cambiar el logo oficial y restablecer cachés del sistema.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Identidad de Marca */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sparkles className="text-blue-600 w-4.5 h-4.5" />
              Identidad Corporativa y Logo Oficial
            </h3>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Administra el identificador visual de <strong>Verse Technology</strong>. El logo se sincronizará de forma automática y unificada en la barra superior de seguridad y en todos los formularios interactivos de exportación y cotizaciones.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-2">
              <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider block">Formatos recomendados:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11.5px] pl-1 font-sans">
                <li><strong className="text-slate-900 font-semibold">SVG Vectorial (.svg):</strong> Escalado nítido para pantallas de alta densidad.</li>
                <li><strong className="text-slate-900 font-semibold">PNG con transparencia (.png):</strong> Fondo transparente de min. 128x128 píxeles.</li>
              </ul>
            </div>

            {/* Logo Customizer controls */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-4 p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="w-12 h-12 flex-shrink-0 bg-slate-800 rounded flex items-center justify-center p-2 border border-slate-700">
                  {localStorage.getItem('verse_custom_logo') ? (
                    <img 
                      src={localStorage.getItem('verse_custom_logo') || ''} 
                      alt="Logo Oficial Preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <svg viewBox="0 0 100 100" className="w-10 h-10 select-none rounded shadow-sm overflow-hidden" xmlns="http://www.w3.org/2000/svg">
                      <rect width="100" height="100" fill="#2f67ff" />
                      <text x="52" y="52" fill="white" fontSize="68" fontWeight="800" fontFamily='"Outfit", "Inter", "Space Grotesk", sans-serif' textAnchor="middle" dominantBaseline="central">T</text>
                    </svg>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <span className="text-[10px] text-green-400 font-mono font-bold tracking-widest uppercase block mb-0.5">Vista previa activa</span>
                  <span className="text-xs text-slate-200 font-semibold leading-none">
                    {localStorage.getItem('verse_custom_logo') ? 'Logo oficial personalizado de Verse' : 'Logo Vectorial Oficial (Por Defecto)'}
                  </span>
                </div>
              </div>

              {/* Upload controls */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Cargar nuevo logo corporativo
                </label>
                <input
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg"
                  disabled={!isSuperAdmin}
                  onChange={(e) => {
                    if (!isSuperAdmin) {
                      alert("🔒 Modificación restringida: Solo un administrador puede cambiar el logo oficial.");
                      return;
                    }
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64String = reader.result as string;
                        localStorage.setItem('verse_custom_logo', base64String);
                        window.dispatchEvent(new Event('storage'));
                        alert('¡Logo oficial cargado e incorporado con éxito de forma unificada!');
                        window.location.reload();
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="block w-full text-xs text-slate-500
                    file:mr-3 file:py-1.5 file:px-3
                    file:rounded-md file:border-0
                    file:text-xs file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* URL Customizer controls */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  O vincular vía URL de imagen pública
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="logo_url_input"
                    placeholder="https://ejemplo.com/logo-oficial.svg"
                    disabled={!isSuperAdmin}
                    className="text-xs flex-1 bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (!isSuperAdmin) return;
                        const target = e.currentTarget;
                        if (target.value.trim()) {
                          localStorage.setItem('verse_custom_logo', target.value.trim());
                          window.dispatchEvent(new Event('storage'));
                          alert('¡Logo cargado mediante URL exitosamente!');
                          window.location.reload();
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('logo_url_input') as HTMLInputElement | null;
                      if (input && input.value.trim()) {
                        localStorage.setItem('verse_custom_logo', input.value.trim());
                        window.dispatchEvent(new Event('storage'));
                        alert('¡Logo cargado mediante URL exitosamente!');
                        window.location.reload();
                      }
                    }}
                    disabled={!isSuperAdmin}
                    className="px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    Vincular
                  </button>
                </div>
              </div>

              {localStorage.getItem('verse_custom_logo') && (
                <button
                  onClick={() => {
                    if (window.confirm('¿Desea restablecer el logo por defecto oficial?')) {
                      localStorage.removeItem('verse_custom_logo');
                      window.dispatchEvent(new Event('storage'));
                      window.location.reload();
                    }
                  }}
                  className="w-full text-center text-red-500 hover:text-red-600 font-bold text-xs py-1 mt-1 block"
                >
                  Restablecer logo oficial por defecto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sandbox reset & Tax Compliance card */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="bg-red-50/25 border border-red-200 rounded-lg p-5 space-y-4">
            <h4 className="font-semibold text-sm text-red-950 flex items-center gap-1.5 font-title-sm">
              <Database className="text-red-600 w-4.5 h-4.5" />
              Restablecimiento del Sandbox de Pruebas
            </h4>
            <p className="text-xs text-red-800 leading-relaxed font-medium">
              Restaura la persistencia local del Sandbox para purgar la caché y restablecer las cuentas de prueba originales vinculadas a los contratos estándar (Grupo Bimbo, AstraZeneca, UNAM).
            </p>

            <button
              onClick={handleReset}
              disabled={!isSuperAdmin}
              className={`w-full font-bold text-xs py-2.5 rounded transition-colors flex justify-center items-center gap-1.5 ${
                isSuperAdmin
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {!isSuperAdmin && <Lock className="w-3.5 h-3.5" />}
              RESTABLECER VALORES ESTÁNDAR
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Cálculo de IVA Transaccional (16% Obligatorio):</p>
              <p className="font-medium">
                La plataforma aplica de forma incondicional un cálculo de 16% de Impuesto al Valor Agregado en todas las transacciones de cotización, previniendo discrepancias fiscales con el SAT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
