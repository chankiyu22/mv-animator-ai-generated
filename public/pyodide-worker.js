// Web worker for running Python code with Pyodide
// This worker loads Pyodide and handles movie generation

// Import paths and URLs
const PYODIDE_BASE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';

// Initialize Pyodide
let pyodide = null;
let isInitialized = false;

// Handle messages from the main thread
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  try {
    if (type === 'init') {
      await initPyodide();
      self.postMessage({ type: 'initialized' });
    } else if (type === 'generate') {
      if (!isInitialized) {
        await initPyodide();
      }
      const result = await generateMovie(data);
      self.postMessage({ type: 'complete', result });
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};

// Initialize Pyodide
async function initPyodide() {
  if (isInitialized) return;
  
  self.importScripts(`${PYODIDE_BASE_URL}pyodide.js`);
  pyodide = await loadPyodide({
    indexURL: PYODIDE_BASE_URL,
  });
  
  // Install required packages
  await pyodide.loadPackagesFromImports(`
    import numpy
    import io
    from PIL import Image
  `);
  
  // Load custom Python code for movie generation
  await pyodide.runPythonAsync(`
    import numpy as np
    import io
    from PIL import Image
    import base64
    import js
    
    def create_gif(frames, fps, quality=80, width=None, height=None):
        """Create a GIF from a list of image data URLs."""
        pil_frames = []
        
        for frame_data in frames:
            # Skip the data URL prefix and decode base64
            img_data = frame_data.split(',')[1]
            img_bytes = base64.b64decode(img_data)
            
            # Open the image with PIL
            img = Image.open(io.BytesIO(img_bytes))
            
            # Resize if dimensions are provided
            if width and height:
                img = img.resize((width, height), Image.LANCZOS)
            
            pil_frames.append(img)
        
        # Calculate duration based on FPS
        duration = int(1000 / fps)
        
        # Create output buffer
        output = io.BytesIO()
        
        # Save as GIF
        pil_frames[0].save(
            output,
            format='GIF',
            append_images=pil_frames[1:],
            save_all=True,
            duration=duration,
            loop=0,
            optimize=True,
            quality=100-quality  # PIL uses 1-100 where 1 is best
        )
        
        # Get binary data
        gif_data = output.getvalue()
        
        # Convert to base64 for returning to JavaScript
        return base64.b64encode(gif_data).decode('utf-8')
    
    def create_png_sequence(frames, width=None, height=None, quality=80):
        """Create a ZIP file containing PNG frames."""
        import zipfile
        
        # Create a ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            for i, frame_data in enumerate(frames):
                # Skip the data URL prefix and decode base64
                img_data = frame_data.split(',')[1]
                img_bytes = base64.b64decode(img_data)
                
                # Open the image with PIL
                img = Image.open(io.BytesIO(img_bytes))
                
                # Resize if dimensions are provided
                if width and height:
                    img = img.resize((width, height), Image.LANCZOS)
                
                # Save as PNG to a buffer
                png_buffer = io.BytesIO()
                img.save(png_buffer, format='PNG', quality=quality)
                
                # Add to ZIP file
                filename = f"frame_{i:04d}.png"
                zip_file.writestr(filename, png_buffer.getvalue())
        
        # Get binary data
        zip_data = zip_buffer.getvalue()
        
        # Convert to base64 for returning to JavaScript
        return base64.b64encode(zip_data).decode('utf-8')
    
    def create_video(frames, fps, format='mp4', width=None, height=None, quality=80, include_audio=False, audio_data=None):
        """
        Create a video from frames.
        Note: This is a placeholder. Full video generation would require additional libraries.
        For now, we'll return a message indicating this isn't fully implemented.
        """
        return {
            "error": "Full video generation requires additional libraries not available in Pyodide. Please use GIF or PNG sequence export."
        }
  `);
  
  isInitialized = true;
}

// Generate movie based on options
async function generateMovie(options) {
  const { 
    format, 
    frames, 
    fps, 
    quality, 
    resolution, 
    includeAudio, 
    useEntireSoundtrack,
    audioData 
  } = options;
  
  // Filter out frames with no images
  const framesToExport = frames.filter(frame => frame.image);
  
  if (framesToExport.length === 0) {
    throw new Error('No frames with images to export');
  }
  
  // Extract frame images
  const frameImages = framesToExport.map(frame => frame.image);
  
  // Call appropriate Python function based on format
  let result;
  
  if (format === 'gif') {
    // Generate GIF
    result = await pyodide.runPythonAsync(`
      create_gif(
        js.to_py(${JSON.stringify(frameImages)}),
        ${fps},
        ${quality},
        ${resolution.width},
        ${resolution.height}
      )
    `);
    return {
      data: result,
      mimeType: 'image/gif',
      extension: 'gif'
    };
  } else if (format === 'png') {
    // Generate PNG sequence
    result = await pyodide.runPythonAsync(`
      create_png_sequence(
        js.to_py(${JSON.stringify(frameImages)}),
        ${resolution.width},
        ${resolution.height},
        ${quality}
      )
    `);
    return {
      data: result,
      mimeType: 'application/zip',
      extension: 'zip'
    };
  } else if (format === 'mp4' || format === 'webm') {
    // For video formats, we'll return an error message for now
    // as full video generation requires additional libraries
    result = await pyodide.runPythonAsync(`
      create_video(
        js.to_py(${JSON.stringify(frameImages)}),
        ${fps},
        "${format}",
        ${resolution.width},
        ${resolution.height},
        ${quality},
        ${includeAudio},
        None  # Audio data would go here
      )
    `);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return {
      data: result,
      mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
      extension: format
    };
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
} 
