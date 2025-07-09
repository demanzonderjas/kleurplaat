import React, { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import SceneCanvas from './components/SceneCanvas';
import './App.css';

function App() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [processedImages, setProcessedImages] = useState([]);

  // Add new processed image to the array
  const handleProcessed = useCallback(
    (dataUrl) => {
      if (dataUrl && !processedImages.includes(dataUrl)) {
        setProcessedImages((prev) => [...prev, dataUrl]);
      }
    },
    [processedImages]
  );

  // When a new image is uploaded, process it
  const handleImageSelected = (img) => {
    setUploadedImage(img); // triggers processing in SceneCanvas
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <ImageUploader onImageSelected={handleImageSelected} />
      </div>
      <SceneCanvas images={processedImages} fillScreen onProcessed={handleProcessed} uploadedImage={uploadedImage} />
    </div>
  );
}

export default App;
