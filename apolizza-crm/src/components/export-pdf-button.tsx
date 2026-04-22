"use client";

export function ExportPDFButton({ cotacaoName, cotacaoId }: { cotacaoName: string; cotacaoId: string }) {
  async function handleExportPDF() {
    const mainEl = document.querySelector("[data-pdf-target]");
    if (!mainEl) return;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const canvas = await html2canvas(mainEl as HTMLElement, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 20;
    const imgH = (canvas.height * imgW) / canvas.width;
    if (imgH <= pageH - 20) {
      pdf.addImage(imgData, "PNG", 10, 10, imgW, imgH);
    } else {
      let srcY = 0;
      const pageImgH = pageH - 20;
      while (srcY < canvas.height) {
        const sliceH = Math.min((pageImgH / imgW) * canvas.width, canvas.height - srcY);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceImg = sliceCanvas.toDataURL("image/png");
        const drawH = (sliceH * imgW) / canvas.width;
        if (srcY > 0) pdf.addPage();
        pdf.addImage(sliceImg, "PNG", 10, 10, imgW, drawH);
        srcY += sliceH;
      }
    }
    const safeName = cotacaoName.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 30);
    pdf.save(`cotacao-${safeName}-${cotacaoId.substring(0, 8)}.pdf`);
  }

  return (
    <button
      onClick={handleExportPDF}
      className="px-4 py-2 text-slate-600 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      PDF
    </button>
  );
}
