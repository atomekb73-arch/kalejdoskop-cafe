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

export function handlePdfDownload(customFileName) {
  const base64Data = window.currentPdfBase64 || window.lastLoadedPdfBase64;
  const fileName = customFileName || window.currentPdfFileName || 'Publikacja_SKN.pdf';

  if (!base64Data && !window.currentPdfBytes) {
    console.error("Brak danych pliku Base64 w pamięci.");
    return;
  }

  try {
    let bytes = null;
    if (window.currentPdfBytes instanceof Uint8Array) {
      bytes = window.currentPdfBytes;
    } else if (base64Data) {
      const cleanBase64 = String(base64Data).replace(/^data:.*?;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '').trim();
      const binaryString = atob(cleanBase64);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    }

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } catch (err) {
    console.error("Błąd podczas konwersji do pobrania:", err);
  }
}

export default {
  renderPdfPage,
  handlePdfDownload
};
