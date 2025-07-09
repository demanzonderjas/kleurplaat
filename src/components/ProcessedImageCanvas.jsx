import React, { useEffect, useRef } from 'react';

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  // h is not used, so we don't need to calculate it
  return [s, v];
}

const ProcessedImageCanvas = ({ image, onProcessed }) => {
  const canvasRef = useRef();

  useEffect(() => {
    if (!image) return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        // Remove white background
        if (r > 220 && g > 220 && b > 220) {
          data[i+3] = 0;
          continue;
        }
        // Remove black outlines
        if (r < 40 && g < 40 && b < 40) {
          data[i+3] = 0;
          continue;
        }
        // Remove low-saturation (gray) pixels
        const [s, v] = rgbToHsv(r, g, b);
        if (s < 0.18 && v < 0.85) {
          data[i+3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      if (onProcessed) onProcessed(canvas.toDataURL());
    };
    img.src = image;
    // eslint-disable-next-line
  }, [image]); // Only re-run when image changes

  return <canvas ref={canvasRef} style={{ maxWidth: 300, marginTop: 10 }} />;
};

export default ProcessedImageCanvas; 