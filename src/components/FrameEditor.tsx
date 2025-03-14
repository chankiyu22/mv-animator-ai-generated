import { useState, useRef, ChangeEvent } from 'react';

interface FrameData {
  id: number;
  time: number;
  image: string | null;
}

interface FrameEditorProps {
  frame: FrameData;
  onImageUpload: (image: string) => void;
}

const FrameEditor = ({ frame, onImageUpload }: FrameEditorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleImageFile(file);
      } else {
        alert('Please upload an image file');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        handleImageFile(file);
      } else {
        alert('Please upload an image file');
      }
    }
  };

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === 'string') {
        onImageUpload(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    if (!frame.image && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveImage = () => {
    onImageUpload('');
  };

  return (
    <div className="frame-editor">
      <h3>Frame {frame.id} Editor</h3>
      <p>Time: {frame.time.toFixed(2)}s</p>
      
      {frame.image ? (
        <div className="image-preview">
          <img 
            src={frame.image} 
            alt={`Frame ${frame.id}`} 
            style={{ maxWidth: '100%', maxHeight: '300px' }} 
          />
          <div className="image-actions">
            <button onClick={handleRemoveImage}>Remove Image</button>
            <button onClick={() => fileInputRef.current?.click()}>Replace Image</button>
          </div>
        </div>
      ) : (
        <div 
          className={`uploader-container ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          style={{ height: '200px' }}
        >
          <p>Drag and drop an image here, or click to select an image</p>
        </div>
      )}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />
    </div>
  );
};

export default FrameEditor; 
