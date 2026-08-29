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

export default {
  renderPdfPage
};
