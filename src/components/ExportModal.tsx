import { useState, useRef, useEffect } from 'react';
// Import the libraries directly to avoid type errors
import JSZip from 'jszip';
// We're using a declaration file for gif.js

interface FrameData {
  id: number;
  time: number;
  image: string | null;
}

interface ExportModalProps {
  frames: FrameData[];
  fps: number;
  audioFile: File | null;
  onClose: () => void;
  isOpen: boolean;
}

type ExportFormat = 'gif' | 'mp4' | 'png' | 'webm';

interface ExportOptions {
  format: ExportFormat;
  quality: number;
  includeAudio: boolean;
  useEntireSoundtrack: boolean;
  resolution: {
    width: number;
    height: number;
  };
}

const ExportModal = ({ frames, fps, audioFile, onClose, isOpen }: ExportModalProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'gif',
    quality: 80,
    includeAudio: true,
    useEntireSoundtrack: false,
    resolution: {
      width: 640,
      height: 480
    }
  });
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && !isExporting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, isExporting]);

  // Handle format change
  const handleFormatChange = (format: ExportFormat) => {
    setExportOptions({
      ...exportOptions,
      format,
      // Disable audio for GIF and PNG
      includeAudio: format === 'mp4' || format === 'webm' ? exportOptions.includeAudio : false
    });
  };

  // Handle quality change
  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExportOptions({
      ...exportOptions,
      quality: parseInt(e.target.value)
    });
  };

  // Handle audio inclusion change
  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExportOptions({
      ...exportOptions,
      includeAudio: e.target.checked
    });
  };

  // Handle entire soundtrack option change
  const handleEntireSoundtrackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExportOptions({
      ...exportOptions,
      useEntireSoundtrack: e.target.checked
    });
  };

  // Handle resolution change
  const handleResolutionChange = (dimension: 'width' | 'height', value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      setExportOptions({
        ...exportOptions,
        resolution: {
          ...exportOptions.resolution,
          [dimension]: numValue
        }
      });
    }
  };

  // Export animation based on selected format
  const handleExport = async () => {
    if (frames.length === 0 || frames.every(frame => !frame.image)) {
      alert('No frames to export. Please add images to your frames first.');
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setExportStatus('Preparing export...');

    try {
      switch (exportOptions.format) {
        case 'gif':
          setExportStatus('Generating GIF...');
          await exportAsGif();
          break;
        case 'mp4':
          setExportStatus('Preparing video export...');
          await exportAsVideo('mp4');
          break;
        case 'webm':
          setExportStatus('Preparing video export...');
          await exportAsVideo('webm');
          break;
        case 'png':
          setExportStatus('Creating PNG sequence...');
          exportAsPngSequence();
          break;
        default:
          throw new Error(`Unsupported format: ${exportOptions.format}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setProgress(100);
      setExportStatus('Export complete!');
      // Reset status after a delay
      setTimeout(() => {
        setExportStatus('');
      }, 3000);
    }
  };

  // Export as GIF
  const exportAsGif = async () => {
    try {
      // Dynamically import the GIF.js library
      const { default: GIF } = await import('gif.js');
      
      // Filter out frames with no images
      const framesToExport = frames.filter(frame => frame.image);
      
      if (framesToExport.length === 0) {
        throw new Error('No frames with images to export');
      }

      return new Promise<void>((resolve, reject) => {
        // Create a new GIF
        const gif = new GIF({
          workers: 2,
          quality: Math.max(1, Math.min(30, 31 - Math.floor(exportOptions.quality / 3.33))), // Convert 0-100 to 30-1 (lower is better in gif.js)
          width: exportOptions.resolution.width,
          height: exportOptions.resolution.height,
          workerScript: '/gif.worker.js' // Make sure this file is in your public folder
        });

        // Create temporary images to add to the GIF
        let loadedImages = 0;
        const totalImages = framesToExport.length;

        framesToExport.forEach((frame) => {
          const img = new Image();
          img.onload = () => {
            // Create a canvas to resize the image if needed
            const canvas = document.createElement('canvas');
            canvas.width = exportOptions.resolution.width;
            canvas.height = exportOptions.resolution.height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // Draw the image with proper scaling
              ctx.drawImage(img, 0, 0, exportOptions.resolution.width, exportOptions.resolution.height);
              
              // Add the frame to the GIF
              gif.addFrame(canvas, { delay: 1000 / fps, copy: true });
              
              loadedImages++;
              setProgress(Math.floor((loadedImages / totalImages) * 50)); // First 50% is loading images
              
              // When all images are loaded, render the GIF
              if (loadedImages === totalImages) {
                gif.on('progress', (p: number) => {
                  setProgress(50 + Math.floor(p * 50)); // Last 50% is rendering
                });
                
                gif.on('finished', (blob: Blob) => {
                  // Create a download link
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `animation-${Date.now()}.gif`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                  resolve();
                });
                
                gif.render();
              }
            } else {
              reject(new Error('Could not get canvas context'));
            }
          };
          
          img.onerror = () => {
            reject(new Error(`Failed to load image for frame ${frame.id}`));
          };
          
          img.src = frame.image!;
        });
      });
    } catch (error) {
      console.error('GIF export failed:', error);
      throw error;
    }
  };

  // Export as video (MP4 or WebM)
  const exportAsVideo = async (format: 'mp4' | 'webm') => {
    try {
      // Filter out frames with no images
      const framesToExport = frames.filter(frame => frame.image);
      
      if (framesToExport.length === 0) {
        throw new Error('No frames with images to export');
      }

      setExportStatus('Setting up canvas and media recorder...');
      
      // Create a canvas for rendering frames
      const canvas = document.createElement('canvas');
      canvas.width = exportOptions.resolution.width;
      canvas.height = exportOptions.resolution.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set up MediaRecorder with canvas stream
      const stream = canvas.captureStream(fps);
      
      // Add audio track if needed
      let audioContext: AudioContext | null = null;
      let audioSource: AudioBufferSourceNode | null = null;
      
      if (exportOptions.includeAudio && audioFile) {
        setExportStatus('Processing audio...');
        audioContext = new AudioContext();
        const audioBuffer = await audioFile.arrayBuffer();
        audioSource = audioContext.createBufferSource();
        audioSource.buffer = await audioContext.decodeAudioData(audioBuffer);
        const audioDestination = audioContext.createMediaStreamDestination();
        audioSource.connect(audioDestination);
        
        // Add audio tracks to the stream
        audioDestination.stream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
      }

      setExportStatus('Initializing video recorder...');
      
      // Set up MediaRecorder with appropriate MIME type
      const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: exportOptions.quality * 100000 // Scale quality (0-100) to bitrate
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        setExportStatus('Finalizing video...');
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `animation-${Date.now()}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setProgress(100);
        setExportStatus('Video export complete!');
      };

      // Start recording
      recorder.start();
      setExportStatus('Recording video frames...');

      // Calculate total duration based on export options
      let totalDuration: number;
      
      if (exportOptions.useEntireSoundtrack && audioSource && audioSource.buffer) {
        // Use the entire audio duration
        totalDuration = audioSource.buffer.duration * 1000; // Convert to milliseconds
      } else {
        // Use only the duration of the animation frames
        totalDuration = (framesToExport[framesToExport.length - 1].time - framesToExport[0].time) * 1000;
      }

      // Start audio playback if needed
      if (audioSource) {
        audioSource.start();
      }

      // Draw each frame at the appropriate time
      let frameIndex = 0;
      const frameDuration = 1000 / fps;
      const startTime = performance.now();
      
      const drawNextFrame = async () => {
        if (frameIndex >= framesToExport.length) {
          // If using entire soundtrack, wait until the audio finishes before stopping
          if (exportOptions.useEntireSoundtrack && audioSource && audioSource.buffer) {
            const elapsed = performance.now() - startTime;
            const remainingTime = Math.max(0, totalDuration - elapsed);
            
            if (remainingTime > 0) {
              // Keep the last frame visible until audio finishes
              setExportStatus(`Waiting for audio to complete (${Math.ceil(remainingTime / 1000)}s remaining)...`);
              setTimeout(() => {
                setExportStatus('Finalizing video...');
                recorder.stop();
              }, remainingTime);
            } else {
              setExportStatus('Finalizing video...');
              recorder.stop();
            }
          } else {
            setExportStatus('Finalizing video...');
            recorder.stop();
          }
          return;
        }

        const frame = framesToExport[frameIndex];
        const img = new Image();
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
          };
          img.onerror = () => reject(new Error(`Failed to load image for frame ${frame.id}`));
          img.src = frame.image!;
        });

        // Update progress
        const progressValue = exportOptions.useEntireSoundtrack && audioSource && audioSource.buffer
          ? Math.floor(((performance.now() - startTime) / totalDuration) * 100)
          : Math.floor((frameIndex / framesToExport.length) * 100);
        
        setProgress(Math.min(progressValue, 99)); // Cap at 99% until complete
        
        // Update status with frame information
        setExportStatus(`Processing frame ${frameIndex + 1}/${framesToExport.length} (${progressValue}%)...`);
        
        frameIndex++;
        
        // Schedule next frame
        const elapsed = performance.now() - startTime;
        const targetTime = frameIndex * frameDuration;
        const delay = Math.max(0, targetTime - elapsed);
        
        setTimeout(drawNextFrame, delay);
      };

      // Start drawing frames
      drawNextFrame();
    } catch (error) {
      console.error('Video export failed:', error);
      throw error;
    }
  };

  // Export as PNG sequence
  const exportAsPngSequence = () => {
    try {
      // Filter out frames with no images
      const framesToExport = frames.filter(frame => frame.image);
      
      if (framesToExport.length === 0) {
        throw new Error('No frames with images to export');
      }

      const zip = new JSZip();
      let processedFrames = 0;

      // Process each frame
      framesToExport.forEach((frame) => {
        const img = new Image();
        img.onload = () => {
          // Create a canvas to resize the image if needed
          const canvas = document.createElement('canvas');
          canvas.width = exportOptions.resolution.width;
          canvas.height = exportOptions.resolution.height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Draw the image with proper scaling
            ctx.drawImage(img, 0, 0, exportOptions.resolution.width, exportOptions.resolution.height);
            
            // Convert to PNG and add to zip
            canvas.toBlob((blob) => {
              if (blob) {
                // Add the PNG to the zip file
                const fileName = `frame_${String(frame.id).padStart(4, '0')}.png`;
                zip.file(fileName, blob);
                
                processedFrames++;
                setProgress(Math.floor((processedFrames / framesToExport.length) * 100));
                
                // When all frames are processed, generate the zip file
                if (processedFrames === framesToExport.length) {
                  zip.generateAsync({ type: 'blob' }).then((zipBlob: Blob) => {
                    // Create a download link
                    const url = URL.createObjectURL(zipBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `animation-frames-${Date.now()}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  });
                }
              }
            }, 'image/png', exportOptions.quality / 100);
          }
        };
        
        img.src = frame.image!;
      });
    } catch (error) {
      console.error('Failed to create ZIP file for PNG sequence:', error);
      throw new Error('Failed to create ZIP file for PNG sequence');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="export-modal" ref={modalRef}>
        <div className="modal-header">
          <h2>Export Animation</h2>
          <button className="close-button" onClick={onClose} disabled={isExporting}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="export-options">
            <div className="option-group">
              <h3>Format</h3>
              <div className="format-options">
                <button 
                  className={`format-button ${exportOptions.format === 'gif' ? 'selected' : ''}`}
                  onClick={() => handleFormatChange('gif')}
                  disabled={isExporting}
                >
                  GIF
                </button>
                <button 
                  className={`format-button ${exportOptions.format === 'mp4' ? 'selected' : ''}`}
                  onClick={() => handleFormatChange('mp4')}
                  disabled={isExporting}
                >
                  MP4
                </button>
                <button 
                  className={`format-button ${exportOptions.format === 'webm' ? 'selected' : ''}`}
                  onClick={() => handleFormatChange('webm')}
                  disabled={isExporting}
                >
                  WebM
                </button>
                <button 
                  className={`format-button ${exportOptions.format === 'png' ? 'selected' : ''}`}
                  onClick={() => handleFormatChange('png')}
                  disabled={isExporting}
                >
                  PNG Sequence
                </button>
              </div>
            </div>
            
            <div className="option-group">
              <h3>Quality</h3>
              <div className="quality-slider">
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={exportOptions.quality} 
                  onChange={handleQualityChange}
                  disabled={isExporting}
                />
                <span>{exportOptions.quality}%</span>
              </div>
            </div>
            
            <div className="option-group">
              <h3>Resolution</h3>
              <div className="resolution-inputs">
                <div className="resolution-input">
                  <label>Width:</label>
                  <input 
                    type="number" 
                    value={exportOptions.resolution.width} 
                    onChange={(e) => handleResolutionChange('width', e.target.value)}
                    min="1"
                    disabled={isExporting}
                  />
                </div>
                <div className="resolution-input">
                  <label>Height:</label>
                  <input 
                    type="number" 
                    value={exportOptions.resolution.height} 
                    onChange={(e) => handleResolutionChange('height', e.target.value)}
                    min="1"
                    disabled={isExporting}
                  />
                </div>
              </div>
            </div>
            
            {(exportOptions.format === 'mp4' || exportOptions.format === 'webm') && (
              <div className="option-group">
                <h3>Audio</h3>
                <div className="audio-option">
                  <input 
                    type="checkbox" 
                    id="include-audio" 
                    checked={exportOptions.includeAudio}
                    onChange={handleAudioChange}
                    disabled={isExporting || !audioFile}
                  />
                  <label htmlFor="include-audio">Include audio</label>
                  {!audioFile && <p className="note">(No audio file available)</p>}
                </div>
                
                {exportOptions.includeAudio && audioFile && (
                  <div className="audio-option">
                    <input 
                      type="checkbox" 
                      id="use-entire-soundtrack" 
                      checked={exportOptions.useEntireSoundtrack}
                      onChange={handleEntireSoundtrackChange}
                      disabled={isExporting || !exportOptions.includeAudio}
                    />
                    <label htmlFor="use-entire-soundtrack">Use entire soundtrack</label>
                    <p className="note">(Extends video to match full audio length)</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {isExporting ? (
            <div className="export-progress">
              <h3>Exporting {exportOptions.format.toUpperCase()}</h3>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="progress-percentage">{progress}%</p>
              {exportStatus && <p className="export-status">{exportStatus}</p>}
              <p>Please wait while your animation is being exported...</p>
            </div>
          ) : (
            <div className="export-summary">
              <p>
                <strong>Summary:</strong> Exporting {frames.filter(f => f.image).length} frames as {exportOptions.format.toUpperCase()} 
                at {exportOptions.resolution.width}x{exportOptions.resolution.height} with {exportOptions.quality}% quality
                {(exportOptions.format === 'mp4' || exportOptions.format === 'webm') && 
                  ` ${exportOptions.includeAudio && audioFile ? 'with' : 'without'} audio`}
                {(exportOptions.format === 'mp4' || exportOptions.format === 'webm') && 
                  exportOptions.includeAudio && exportOptions.useEntireSoundtrack && audioFile && 
                  ` (using entire soundtrack)`}
              </p>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button 
            className="export-button" 
            onClick={handleExport}
            disabled={isExporting || frames.filter(f => f.image).length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal; 
