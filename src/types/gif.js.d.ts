declare module 'gif.js' {
  interface GifOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    repeat?: number;
    transparent?: string;
    background?: string;
    comment?: string;
    debug?: boolean;
    dither?: boolean | string;
    globalPalette?: boolean;
  }

  interface GifFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
    transparent?: boolean;
  }

  export default class GIF {
    constructor(options: GifOptions);
    addFrame(element: HTMLCanvasElement | HTMLImageElement, options?: GifFrameOptions): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    render(): void;
  }
} 
