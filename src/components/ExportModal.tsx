import { useState, useRef, useEffect } from 'react';
import pythonExportService, { ExportOptions as PythonExportOptions } from '../services/PythonExportService';
import { FrameData } from '../types/FrameData';

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
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);
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

  // Initialize Pyodide when the modal is opened
  useEffect(() => {
    if (isOpen) {
      // Start initializing Pyodide in the background
      setIsPyodideLoading(true);
      pythonExportService.ensureInitialized()
        .then(() => {
          setIsPyodideLoading(false);
        })
        .catch(error => {
          console.error('Failed to initialize Pyodide:', error);
          setIsPyodideLoading(false);
          alert('Failed to initialize Python environment. Export functionality may be limited.');
        });
    }
  }, [isOpen]);

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

    try {
      // Convert our export options to the format expected by the Python export service
      const pythonOptions: PythonExportOptions = {
        format: exportOptions.format,
        quality: exportOptions.quality,
        includeAudio: exportOptions.includeAudio,
        useEntireSoundtrack: exportOptions.useEntireSoundtrack,
        resolution: exportOptions.resolution
      };

      // Generate the movie using the Python export service
      const result = await pythonExportService.generateMovie(
        frames,
        fps,
        pythonOptions,
        audioFile
      );

      // Download the result
      pythonExportService.downloadResult(result);
      
      setProgress(100);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
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
          {isPyodideLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading Python environment...</p>
              <p className="note">This may take a moment on first use.</p>
            </div>
          ) : (
            <>
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
                  {(exportOptions.format === 'mp4' || exportOptions.format === 'webm') && (
                    <p className="note">
                      Note: Video export is limited in the browser. For best results, use GIF or PNG Sequence.
                    </p>
                  )}
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
              
              {isExporting && (
                <div className="export-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p>{progress}% complete</p>
                  <p className="note">
                    Processing with Python... This may take a moment as we're using Pyodide to run Python in your browser.
                  </p>
                </div>
              )}
              
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
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isExporting || isPyodideLoading}
          >
            Cancel
          </button>
          <button 
            className="export-button" 
            onClick={handleExport}
            disabled={isExporting || isPyodideLoading || frames.filter(f => f.image).length === 0}
          >
            {isExporting ? 'Exporting...' : isPyodideLoading ? 'Loading...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal; 
