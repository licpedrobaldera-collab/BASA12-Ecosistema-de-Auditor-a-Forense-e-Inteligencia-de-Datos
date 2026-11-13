import React, { useState } from 'react';
import { STREAMLIT_BUG_DIAGNOSIS, FIXED_APP_PY, FIXED_RUN_BAT } from '../utils/fixedStreamlitCode';
import { AlertTriangle, CheckCircle, Download, Copy, Check, Terminal, FileCode, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const StreamlitFixModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'diagnostico' | 'app_py' | 'bat'>('diagnostico');
  const [copiedApp, setCopiedApp] = useState(false);
  const [copiedBat, setCopiedBat] = useState(false);

  if (!isOpen) return null;

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, type: 'app' | 'bat') => {
    navigator.clipboard.writeText(text);
    if (type === 'app') {
      setCopiedApp(true);
      setTimeout(() => setCopiedApp(false), 2000);
    } else {
      setCopiedBat(true);
      setTimeout(() => setCopiedBat(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              🛠️
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Solución al Error de Streamlit Local</h2>
              <p className="text-xs text-slate-400">Diagnóstico pericial y archivos reparados listos para descargar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('diagnostico')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === 'diagnostico'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            ¿Por qué se congeló tu pantalla?
          </button>
          <button
            onClick={() => setActiveTab('app_py')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === 'app_py'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-emerald-400" />
            app.py Reparado (100% Funcional)
          </button>
          <button
            onClick={() => setActiveTab('bat')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === 'bat'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4 text-sky-400" />
            iniciar_sistema.bat
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'diagnostico' && (
            <div className="space-y-5">
              <div className="bg-amber-950/40 border border-amber-800/50 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-200">Causa Raíz Identificada en tu Captura de Pantalla</h3>
                  <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                    Al inspeccionar tu código, en la línea donde se guardan las credenciales:
                    <br />
                    <code className="bg-slate-950 px-2 py-0.5 rounded text-amber-300 font-mono text-xs">
                      if usuario_activo not in config_db: config_db[usuario_activo] = &#123;&#125;
                    </code>
                    <br />
                    El archivo fue cortado y se pegaron comandos del archivo Batch de Windows (
                    <code className="bg-slate-950 px-2 py-0.5 rounded text-red-400 font-mono text-xs">@echo off</code>
                    , <code className="bg-slate-950 px-2 py-0.5 rounded text-red-400 font-mono text-xs">title ...</code>)
                    dentro del archivo Python.
                  </p>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    Python colapsó inmediatamente con un <strong>SyntaxError</strong> justo antes de llegar a
                    <code className="bg-slate-950 px-2 py-0.5 rounded text-cyan-300 font-mono text-xs">
                      st.header(&quot;📂 Gestión y Procesamiento de Evidencias&quot;)
                    </code>
                    . Por eso Streamlit solo mostraba la barra lateral y el título principal.
                  </p>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5">
                <h4 className="font-semibold text-white flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Pasos de Solución en 1 Minuto:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                  {STREAMLIT_BUG_DIAGNOSIS.pasosSolucion.map((paso, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <span className="text-slate-100 font-medium">{paso}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => downloadFile('app.py', FIXED_APP_PY, 'text/x-python')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar app.py Reparado
                </button>
                <button
                  onClick={() => downloadFile('iniciar_sistema.bat', FIXED_RUN_BAT, 'application/x-bat')}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm shadow-lg shadow-sky-950/40 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar iniciar_sistema.bat
                </button>
              </div>
            </div>
          )}

          {activeTab === 'app_py' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Código completo verificado y lineal (sin fallas de st.columns ni caracteres corruptos)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(FIXED_APP_PY, 'app')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedApp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedApp ? '¡Copiado!' : 'Copiar Código'}
                  </button>
                  <button
                    onClick={() => downloadFile('app.py', FIXED_APP_PY, 'text/x-python')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar app.py
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-[50vh] leading-relaxed">
                {FIXED_APP_PY}
              </pre>
            </div>
          )}

          {activeTab === 'bat' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Archivo Batch para Windows que instala dependencias y corre en el puerto 8502
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(FIXED_RUN_BAT, 'bat')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedBat ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedBat ? '¡Copiado!' : 'Copiar Script'}
                  </button>
                  <button
                    onClick={() => downloadFile('iniciar_sistema.bat', FIXED_RUN_BAT, 'application/x-bat')}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar .bat
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-[50vh] leading-relaxed">
                {FIXED_RUN_BAT}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs text-slate-400">
          <span>* Puedes utilizar esta plataforma web directamente sin necesidad de correr Streamlit localmente.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs transition-colors cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
