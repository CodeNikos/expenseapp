import { useMemo, useRef, useState } from 'react';

function dataUrlToBlob(dataUrl) {
  const [header, content] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

export function useCamera() {
  const webcamRef = useRef(null);
  const [error, setError] = useState('');

  const videoConstraints = useMemo(
    () => ({
      facingMode: { ideal: 'environment' },
    }),
    [],
  );

  function capture() {
    try {
      const screenshot = webcamRef.current?.getScreenshot();

      if (!screenshot) {
        setError('No se pudo capturar la imagen de la camara.');
        return null;
      }

      const blob = dataUrlToBlob(screenshot);
      const file = new File([blob], `receipt-${Date.now()}.jpg`, {
        type: blob.type,
      });

      setError('');

      return {
        file,
        previewUrl: screenshot,
      };
    } catch (captureError) {
      setError('No fue posible acceder a la camara.');
      return null;
    }
  }

  return {
    capture,
    error,
    setError,
    videoConstraints,
    webcamRef,
  };
}
