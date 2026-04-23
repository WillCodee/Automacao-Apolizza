"use client";

export function ExportPDFButton({ cotacaoName, cotacaoId }: { cotacaoName: string; cotacaoId: string }) {
  void cotacaoName;
  void cotacaoId;

  function handlePrint() {
    window.print();
  }

  return (
    <button
      onClick={handlePrint}
      className="px-4 py-2 text-slate-600 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2 print:hidden"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      PDF
    </button>
  );
}
