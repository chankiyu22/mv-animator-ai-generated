import { FrameData } from '../types/FrameData';

export type ExportFormat = 'gif' | 'mp4' | 'png' | 'webm';

export interface ExportOptions {
  format: ExportFormat;
  quality: number;
  includeAudio: boolean;
  useEntireSoundtrack: boolean;
  resolution: {
    width: number;
    height: number;
  };
}

export interface ExportResult {
  data: string;
  mimeType: string;
  extension: string;
}

class PythonExportService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined' || !window.Worker) {
      console.error('Web Workers are not supported in this environment');
      return;
    }

    try {
      this.worker = new Worker('/pyodide-worker.js');
      
      // Set up the initialization promise
      this.initPromise = new Promise((resolve, reject) => {
        if (!this.worker) {
          reject(new Error('Worker failed to initialize'));
          return;
        }

        const messageHandler = (event: MessageEvent) => {
          const { type, error } = event.data;
          
          if (type === 'initialized') {
            this.isInitialized = true;
            resolve();
            this.worker?.removeEventListener('message', messageHandler);
          } else if (type === 'error' && !this.isInitialized) {
            reject(new Error(error || 'Failed to initialize Pyodide'));
            this.worker?.removeEventListener('message', messageHandler);
          }
        };

        this.worker.addEventListener('message', messageHandler);
        this.worker.postMessage({ type: 'init' });
      });
    } catch (error) {
      console.error('Failed to create web worker:', error);
    }
  }

  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.initPromise) {
      this.initWorker();
      if (!this.initPromise) {
        throw new Error('Failed to initialize worker');
      }
    }
    
    return this.initPromise;
  }

  public async generateMovie(
    frames: FrameData[],
    fps: number,
    options: ExportOptions,
    audioFile: File | null
  ): Promise<ExportResult> {
    await this.ensureInitialized();
    
    if (!this.worker) {
      throw new Error('Web worker is not available');
    }

    // Convert audio file to base64 if needed
    let audioData = null;
    if (options.includeAudio && audioFile && (options.format === 'mp4' || options.format === 'webm')) {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        audioData = `data:${audioFile.type};base64,${base64}`;
      } catch (error) {
        console.error('Failed to process audio file:', error);
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Web worker is not available'));
        return;
      }

      const messageHandler = (event: MessageEvent) => {
        const { type, result, error } = event.data;
        
        if (type === 'complete') {
          resolve(result);
          this.worker?.removeEventListener('message', messageHandler);
        } else if (type === 'error') {
          reject(new Error(error || 'Failed to generate movie'));
          this.worker?.removeEventListener('message', messageHandler);
        }
      };

      this.worker.addEventListener('message', messageHandler);
      
      this.worker.postMessage({
        type: 'generate',
        data: {
          format: options.format,
          frames,
          fps,
          quality: options.quality,
          resolution: options.resolution,
          includeAudio: options.includeAudio,
          useEntireSoundtrack: options.useEntireSoundtrack,
          audioData
        }
      });
    });
  }

  public downloadResult(result: ExportResult): void {
    // Convert base64 data to a Blob
    const byteCharacters = atob(result.data);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: result.mimeType });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `animation-${Date.now()}.${result.extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

// Create a singleton instance
const pythonExportService = new PythonExportService();

export default pythonExportService; 
