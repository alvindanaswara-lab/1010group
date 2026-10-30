import React, { useEffect } from 'react';
import { CheckCircle2, Check, ArrowUp, FileText } from 'lucide-react';

export interface SuccessDetail {
  label: string;
  value: string | number;
}

interface SuccessSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  details?: SuccessDetail[];
  buttonText?: string;
  onExportPDF?: () => void;
  exportPDFText?: string;
}

export const SuccessSubmitModal: React.FC<SuccessSubmitModalProps> = ({
  isOpen,
  onClose,
  title = 'Data Telah Berhasil Di-input!',
  message = 'Data formulir telah berhasil diproses dan disimpan ke dalam sistem.',
  details,
  buttonText = 'Tutup & Lanjutkan',
  onExportPDF,
  exportPDFText = 'Export to PDF (Surat Jalan)',
}) => {
  // Prevent background scrolling when open and support Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-emerald-100 p-6 text-center transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Animated Check Icon */}
        <div className="relative mx-auto mb-4 w-16 h-16">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center ring-8 ring-emerald-50 shadow-inner">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-sm">
            <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
          </span>
        </div>

        {/* Title */}
        <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
          {title}
        </h3>

        {/* Message */}
        <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
          {message}
        </p>

        {/* Details card if provided */}
        {details && details.length > 0 && (
          <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left space-y-1.5 text-xs divide-y divide-slate-100">
            {details.map((d, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-start gap-2 ${idx > 0 ? 'pt-1.5' : ''}`}
              >
                <span className="text-slate-500 font-medium whitespace-nowrap">{d.label}:</span>
                <span className="font-bold text-slate-800 text-right break-words">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status notice */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-100">
          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
          <span>Formulir telah dibersihkan dan layar kembali ke atas</span>
        </div>

        {/* Optional Export to PDF Action Button */}
        {onExportPDF && (
          <button
            type="button"
            onClick={onExportPDF}
            className="w-full mt-4 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4 stroke-[2.5]" />
            {exportPDFText}
          </button>
        )}

        {/* Close / Action Button */}
        <button
          type="button"
          onClick={onClose}
          className={`w-full ${onExportPDF ? 'mt-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800' : 'mt-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-600/20'} py-2.5 px-4 font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer`}
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          {buttonText}
        </button>
      </div>
    </div>
  );
};

