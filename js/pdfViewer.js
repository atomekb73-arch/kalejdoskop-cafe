/**
 * Kalejdoskop Café - Dedykowany Moduł Czytnika PDF (HiDPI / Sharp Canvas Rendering)
 * Studenckie Koło Naukowe Seksuologii
 */

export async function renderPdfPage(pdfDoc, pageNumber, canvas, scale = 1.25) {
  if (!pdfDoc || !canvas) return;
  const page = await pdfDoc.getPage(pageNumber);
  const ctx = canvas.getContext('2d', { alpha: false });

  // 1. Obliczenie współczynnika gęstości ekranu (HiDPI / Retina)
  const pixelRatio = window.devicePixelRatio || 1;
  const zoom = scale || 1.25;

  // 2. Viewport bazowy dla stylów CSS oraz powiększony dla bufora Canvas
  const viewport = page.getViewport({ scale: zoom });
  
  // 3. Rozdzielczość bufora graficznego (Canvas wewnętrzny - ostrość)
  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);

  // 4. Wymiary wyświetlania w CSS (dopasowanie do widoku)
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  canvas.style.maxWidth = 'none';

  // 5. Kontekst renderowania z transformacją skali
  const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null;

  const renderContext = {
    canvasContext: ctx,
    transform: transform,
    viewport: viewport
  };

  // Czyszczenie tła na biało
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render(renderContext).promise;
}

export async function downloadWatermarkedPdf(customFileName) {
  try {
    let pdfBytes = null;

    if (window.pdfDoc && typeof window.pdfDoc.getData === 'function') {
      pdfBytes = await window.pdfDoc.getData();
    } else if (window.currentPdfBytes instanceof Uint8Array && window.currentPdfBytes.length > 0) {
      pdfBytes = window.currentPdfBytes;
    } else if (window.currentPdfBase64 || window.lastLoadedPdfBase64) {
      const raw = window.currentPdfBase64 || window.lastLoadedPdfBase64;
      const cleanBase64 = String(raw).replace(/^data:.*?;base64,/, '').trim();
      pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error("Pusty bufor dokumentu.");
    }

    const pdfLibInstance = window.PDFLib || (typeof PDFLib !== 'undefined' ? PDFLib : null);

    if (pdfLibInstance && pdfLibInstance.PDFDocument) {
      const { PDFDocument, rgb, degrees, StandardFonts } = pdfLibInstance;
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const userEmail = (window.currentUser && (window.currentUser.email || window.currentUser.name)) || "Członek SKN";
      const downloadDate = new Date().toISOString().split('T')[0];

      for (const page of pages) {
        const { width, height } = page.getSize();

        // 1. Duży diagonalny znak wodny na środku (45 stopni)
        const watermarkText = 'Inteligentna Biblioteka SKN Seksuologii';
        const fontSize = Math.max(14, Math.min(24, width / 25));
        page.drawText(watermarkText, {
          x: width / 6,
          y: height / 3,
          size: fontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.15,
          rotate: degrees(45),
        });

        // 2. Dyskretna stopka ewidencyjna na dole strony
        const auditText = `SKN Seksuologii WSKZ • Egzemplarz autoryzowany: ${userEmail} • Data: ${downloadDate}`;
        page.drawText(auditText, {
          x: 40,
          y: 20,
          size: 9,
          font: regularFont,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.5,
        });
      }

      const modifiedPdfBytes = await pdfDoc.save();
      triggerFileSave(modifiedPdfBytes, customFileName || window.currentPdfFileName || "Publikacja_SKN.pdf");
    } else {
      triggerFileSave(pdfBytes, customFileName || window.currentPdfFileName || "Publikacja_SKN.pdf");
    }
  } catch (err) {
    console.error("Błąd nakładania znaku wodnego:", err);
  }
}

function triggerFileSave(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = fileName || "Publikacja_SKN.pdf";
  link.download = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 300);
}

export default {
  renderPdfPage,
  downloadWatermarkedPdf,
  downloadCurrentPdfFile: downloadWatermarkedPdf,
  handlePdfDownload: downloadWatermarkedPdf
};
