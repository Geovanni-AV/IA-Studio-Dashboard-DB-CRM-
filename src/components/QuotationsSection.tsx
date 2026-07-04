import React, { useState } from 'react';
import { CRMRecord, UserRole } from '../types';
import { RefreshCcw, ExternalLink, HardDrive, Shield, FileText, ArrowRightLeft } from 'lucide-react';

interface QuotationsSectionProps {
  records: CRMRecord[];
  exchangeRate: number;
  onShowAudit?: (action: string, details: string) => void;
}

export default function QuotationsSection({ records, exchangeRate, onShowAudit }: QuotationsSectionProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(records[0]?.id || '');
  const [targetMoneda, setTargetMoneda] = useState<'USD' | 'MXN'>('USD');

  const selectedRecord = records.find((r) => r.id === selectedRecordId) || records[0];

  const handleCurrencyChange = (newMoneda: 'USD' | 'MXN') => {
    setTargetMoneda(newMoneda);
    if (onShowAudit) {
      onShowAudit('CÓMPUTO', `Realizó conversión de divisas de cotizaciones a ${newMoneda} para análisis comparativo.`);
    }
  };

  // Price conversion computation
  const getConvertedPrice = (val: number, baseMoneda: 'USD' | 'MXN') => {
    if (baseMoneda === targetMoneda) return val;
    if (baseMoneda === 'USD' && targetMoneda === 'MXN') {
      return val * exchangeRate;
    } else {
      return val / exchangeRate;
    }
  };

  if (!selectedRecord) {
    return <div className="p-8 text-center text-slate-400">No hay cotizaciones para analizar.</div>;
  }

  // Calculate items for selected record
  const hardwareVal = selectedRecord.total_hardware_cotizacion;
  const servicesVal = selectedRecord.total_servicios_cotizacion;
  
  const convertedHardware = getConvertedPrice(hardwareVal, selectedRecord.informacion_general_moneda);
  const convertedServices = getConvertedPrice(servicesVal, selectedRecord.informacion_general_moneda);
  const convertedSubtotal = convertedHardware + convertedServices;
  const calculatedIva = 0;
  const calculatedTotal = convertedSubtotal;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-end pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Ficha de Cómputo Financiero</h1>
          <p className="text-sm text-slate-500 mt-1">
            Análisis monetario pormenorizado dividiendo suministros de hardware e instrumentación física, de servicios de armado y puesta en marcha en campo.
          </p>
        </div>
        
        {/* Toggle Currencies */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => handleCurrencyChange('MXN')}
            className={`px-3 py-1 text-xs font-bold rounded transition-all ${targetMoneda === 'MXN' ? 'bg-white shadow-sm text-[#004ddf]' : 'text-slate-500'}`}
          >
            MXN
          </button>
          <button
            onClick={() => handleCurrencyChange('USD')}
            className={`px-3 py-1 text-xs font-bold rounded transition-all ${targetMoneda === 'USD' ? 'bg-white shadow-sm text-[#004ddf]' : 'text-slate-500'}`}
          >
            USD
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Select a Quote list */}
        <div className="col-span-12 md:col-span-4 space-y-2">
          <h3 className="font-label-caps text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Seleccionar Proyecto / Folio
          </h3>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {records.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedRecordId(r.id)}
                className={`p-3 border rounded-lg cursor-pointer transition-all flex justify-between items-center ${
                  r.id === selectedRecordId
                    ? 'bg-blue-50/50 border-[#004ddf] shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-[#0b1c30]">{r.informacion_general_cliente}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[170px] truncate">
                    {r.informacion_general_proyecto}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[#004ddf] font-data-mono">
                    {r.total_general_cotizacion.toLocaleString('en-US', {
                      style: 'currency',
                      currency: r.informacion_general_moneda,
                      minimumFractionDigits: 0
                    })}
                  </p>
                  <p className="text-[9px] font-mono text-slate-400">{r.informacion_general_folio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed computation pane */}
        <div className="col-span-12 md:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs text-[#004ddf] font-bold font-mono">
                  {selectedRecord.informacion_general_folio} • {selectedRecord.informacion_general_cliente}
                </p>
                <h3 className="text-base font-bold text-[#0b1c30] mt-0.5">
                  Análisis Técnico de Cotización
                </h3>
              </div>
              <div className="bg-slate-100 p-1 rounded-md text-[10px] flex items-center gap-1 text-slate-600 font-semibold uppercase">
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#000000]" />
                Tipo de Cambio: 1 USD = {exchangeRate} MXN
              </div>
            </div>

            {/* Split Suministros vs Soporte en campo */}
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3.5 bg-blue-50/25 border border-blue-100 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-blue-100 text-[#004ddf] rounded">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0b1c30]">Partida de Suministros (Hardware)</h4>
                    <p className="text-xs text-slate-500 max-w-sm">Sensores físicos, medidores Coriolis, transmisores y controladores volumétricos redundantemente testeados.</p>
                  </div>
                </div>
                <p className="font-data-mono font-bold text-[#0b1c30] text-sm text-right">
                  {convertedHardware.toLocaleString('en-US', {
                    style: 'currency',
                    currency: targetMoneda
                  })}
                </p>
              </div>

              <div className="flex justify-between items-center p-3.5 bg-emerald-50/25 border border-emerald-100 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0b1c30]">Servicios Profesionales de Campo</h4>
                    <p className="text-xs text-slate-500 max-w-sm">Instalación física estructurada, puesta en marcha, calibración acreditada y soporte operativo en planta.</p>
                  </div>
                </div>
                <p className="font-data-mono font-bold text-[#0b1c30] text-sm text-right">
                  {convertedServices.toLocaleString('en-US', {
                    style: 'currency',
                    currency: targetMoneda
                  })}
                </p>
              </div>
            </div>

            {/* Tax Details card */}
            <div className="bg-[#0b1c30] text-white p-5 rounded-lg relative overflow-hidden shadow-md">
              <div className="absolute right-[-20px] top-[-20px] opacity-10">
                <FileText className="w-48 h-48" />
              </div>

              <div className="relative z-10 space-y-3.5">
                <div className="pb-2 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider font-label-caps text-emerald-400">
                      Ficha de Cómputo Fiscal (SAT Ley Comercial)
                    </span>
                  </div>
                  
                  {/* LOGO CORPORATIVO UNIFICADO */}
                  <div className="flex items-center gap-1.5 opacity-90">
                    <span className="text-[9px] font-mono font-bold tracking-widest text-slate-450 uppercase hidden sm:inline">Verse Tech</span>
                    {localStorage.getItem('verse_custom_logo') ? (
                      <div className="w-6 h-6 flex items-center justify-center p-0.5 bg-slate-900 rounded border border-slate-700/60 shadow-inner">
                        <img 
                          src={localStorage.getItem('verse_custom_logo') || ''} 
                          alt="Logo Oficial" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 flex items-center justify-center select-none" title="Verse technology Logo Oficial">
                        <svg viewBox="0 0 100 100" className="w-5 h-5 rounded shadow-sm overflow-hidden" xmlns="http://www.w3.org/2000/svg">
                          <rect width="100" height="100" fill="#2f67ff" />
                          <text x="52" y="52" fill="white" fontSize="68" fontWeight="800" fontFamily='"Outfit", "Inter", "Space Grotesk", sans-serif' textAnchor="middle" dominantBaseline="central">T</text>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center opacity-85">
                    <span className="font-semibold uppercase tracking-wider font-label-caps">Subtotal Acumulado Neto</span>
                    <span className="font-data-mono text-sm">
                      {convertedSubtotal.toLocaleString('en-US', { style: 'currency', currency: targetMoneda })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center opacity-85">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold uppercase tracking-wider font-label-caps">IVA Aplicable de Ley</span>
                      <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-bold">16%</span>
                    </div>
                    <span className="font-data-mono text-sm">
                      {calculatedIva.toLocaleString('en-US', { style: 'currency', currency: targetMoneda })}
                    </span>
                  </div>

                  <div className="pt-3.5 border-t border-white/20 flex justify-between items-end">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[#cbdbf5]">
                      Monto Consolidado General
                    </span>
                    <span className="font-data-mono text-2xl font-bold text-emerald-400">
                      {calculatedTotal.toLocaleString('en-US', { style: 'currency', currency: targetMoneda })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hyperlink connections to Google Drive files */}
            <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-lg flex justify-between items-center">
              <div className="text-xs">
                <p className="font-bold text-slate-800">Expediente Digital de Drive:</p>
                <p className="text-slate-500 mt-0.5">Accede al entregable formal de cotización en formato PDF.</p>
              </div>
              <a
                href={selectedRecord.informacion_general_link_cotizacion || undefined}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (onShowAudit) {
                    onShowAudit('CONSULTA', `Consolidó y visualizó en Drive cotización de ${selectedRecord.informacion_general_cliente || 'Cliente'} (Folio ${selectedRecord.informacion_general_folio || 'Sin Folio'})`);
                  }
                }}
                className="bg-[#0b1c30] text-white px-4 py-2 hover:bg-slate-800 transition-colors rounded text-xs font-bold inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                VER COTIZACIÓN Drive
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
