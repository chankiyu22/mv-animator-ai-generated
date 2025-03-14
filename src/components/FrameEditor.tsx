import { useState, useRef, ChangeEvent } from 'react';
import { parseGIF, decompressFrames } from 'gifuct-js';

interface FrameData {
  id: number;
  time: number;
  image: string | null;
}

interface FrameEditorProps {
  frame: FrameData;
  onImageUpload: (image: string) => void;
  onGifProcessed?: (frames: string[], startFrameId: number, frameDelays: number[]) => void;
}

const FrameEditor = ({ frame, onImageUpload, onGifProcessed }: FrameEditorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingGif, setIsProcessingGif] = useState(false);
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
      if (file.type === 'image/gif' && onGifProcessed) {
        processGif(file);
      } else if (file.type.startsWith('image/')) {
        handleImageFile(file);
      } else {
        alert('Please upload an image file');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'image/gif' && onGifProcessed) {
        processGif(file);
      } else if (file.type.startsWith('image/')) {
        handleImageFile(file);
      } else {
        alert('Please upload an image file');
      }
    }
  };

  const processGif = async (file: File) => {
    if (!onGifProcessed) return;
    
    setIsProcessingGif(true);
    
    try {
      // Read the file as ArrayBuffer
      const buffer = await file.arrayBuffer();
      
      // Parse the GIF
      const gif = parseGIF(new Uint8Array(buffer));
      const frames = decompressFrames(gif, true);
      
      // Extract frame delays (in 1/100th of a second)
      const frameDelays = frames.map(frame => frame.delay);
      
      // Create canvas to render frames
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas dimensions to match the GIF dimensions
      canvas.width = frames[0].dims.width;
      canvas.height = frames[0].dims.height;
      
      // Process each frame
      const frameImages: string[] = [];
      
      // For GIFs, we need to handle disposal methods and frame composition
      let previousImageData: ImageData | null = null;
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        // Handle disposal method
        if (i > 0) {
          const prevFrame = frames[i - 1];
          
          // Disposal method:
          // 0 - No disposal specified
          // 1 - Do not dispose (leave as is)
          // 2 - Restore to background color
          // 3 - Restore to previous state
          
          if (prevFrame.disposalType === 2) {
            // Clear the canvas to transparent
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          } else if (prevFrame.disposalType === 3 && previousImageData) {
            // Restore to previous state
            ctx.putImageData(previousImageData, 0, 0);
          }
        } else {
          // First frame, clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Save the current state before drawing the new frame
        previousImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Create ImageData from the frame's pixels
        const imageData = new ImageData(
          new Uint8ClampedArray(frame.patch),
          frame.dims.width,
          frame.dims.height
        );
        
        // Draw the frame at its position
        ctx.putImageData(imageData, frame.dims.left, frame.dims.top);
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        frameImages.push(dataUrl);
      }
      
      // Set the first frame as the current frame's image
      if (frameImages.length > 0) {
        onImageUpload(frameImages[0]);
      }
      
      // Pass the frames, starting frame ID, and frame delays to be processed
      onGifProcessed(frameImages, frame.id, frameDelays);
      
    } catch (error) {
      console.error('Error processing GIF:', error);
      alert('Error processing GIF. Please try another file.');
    } finally {
      setIsProcessingGif(false);
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
          <p className="gif-support">GIF files will automatically fill subsequent frames with proper timing</p>
          {isProcessingGif && <p>Processing GIF... This may take a moment.</p>}
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
