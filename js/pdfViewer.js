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

export async function downloadCurrentPdfFile(customFileName) {
  try {
    let pdfBytes = null;

    if (window.pdfDoc && typeof window.pdfDoc.getData === 'function') {
      pdfBytes = await window.pdfDoc.getData();
    } else if (window.currentPdfBytes instanceof Uint8Array && window.currentPdfBytes.length > 0) {
      pdfBytes = window.currentPdfBytes;
    } else if (window.currentPdfBase64 || window.lastLoadedPdfBase64) {
      const raw = window.currentPdfBase64 || window.lastLoadedPdfBase64;
      const cleanBase64 = String(raw).replace(/^data:.*?;base64,/, '').trim();
      const binaryString = atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      pdfBytes = bytes;
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error("Pusty bufor dokumentu.");
    }

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const fileName = customFileName || window.currentPdfFileName || 'Publikacja_SKN.pdf';
    const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 200);

  } catch (err) {
    console.error("Błąd pobierania:", err);
  }
}

export default {
  renderPdfPage,
  handlePdfDownload: downloadCurrentPdfFile,
  downloadCurrentPdfFile
};
