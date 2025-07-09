import React, { useRef } from 'react';
import heic2any from 'heic2any';

const ImageUploader = ({ onImageSelected, onLoading }) => {
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      // Convert HEIC to JPEG/PNG
      try {
        if (onLoading) onLoading(true);
        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
        const reader = new FileReader();
        reader.onload = (event) => {
          if (onImageSelected) onImageSelected(event.target.result);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (onLoading) onLoading(false);
        };
        reader.readAsDataURL(convertedBlob);
      } catch {
        alert('Failed to convert HEIC image. Please try a different image.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onLoading) onLoading(false);
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (onImageSelected) onImageSelected(event.target.result);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onLoading) onLoading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Responsive UI scaling
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 700;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <input
        type="file"
        accept="image/*,.heic"
        ref={fileInputRef}
        onChange={handleFileChange}
        onClick={e => { e.target.value = ''; }}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        style={{
          background: 'linear-gradient(90deg, #ffecb3 0%, #ffd54f 100%)',
          color: '#333',
          border: '2px solid #ffb300',
          borderRadius: 16,
          padding: isMobile ? '10px 18px' : '18px 40px',
          fontSize: isMobile ? 16 : 24,
          fontWeight: 700,
          boxShadow: '0 4px 16px rgba(255,193,7,0.15)',
          cursor: 'pointer',
          margin: isMobile ? '8px 0' : '12px 0',
          transition: 'background 0.2s, box-shadow 0.2s',
          outline: 'none',
          letterSpacing: 1,
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 6 : 12
        }}
        aria-label="Upload Image"
      >
        <span role="img" aria-label="upload" style={{ fontSize: isMobile ? 20 : 28 }}>📤</span>
        + Kleurplaat
      </button>
    </div>
  );
};

export default ImageUploader; 