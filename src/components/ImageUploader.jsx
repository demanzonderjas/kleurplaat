import React, { useRef } from 'react';
import heic2any from 'heic2any';

const ImageUploader = ({ onImageSelected }) => {
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      // Convert HEIC to JPEG/PNG
      try {
        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
        const reader = new FileReader();
        reader.onload = (event) => {
          if (onImageSelected) onImageSelected(event.target.result);
          if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsDataURL(convertedBlob);
      } catch {
        alert('Failed to convert HEIC image. Please try a different image.');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (onImageSelected) onImageSelected(event.target.result);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*,.heic"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      {/* No preview image shown */}
    </div>
  );
};

export default ImageUploader; 