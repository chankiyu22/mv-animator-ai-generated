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
      
      try {
        const result = await generateMovie(data);
        
        // Ensure result is serializable by converting to string if needed
        const serializableResult = {
          data: typeof result.data === 'string' ? result.data : String(result.data),
          mimeType: result.mimeType,
          extension: result.extension
        };
        
        console.log("Sending result to main thread:", 
          {
            type: typeof serializableResult.data,
            length: serializableResult.data.length,
            mimeType: serializableResult.mimeType,
            extension: serializableResult.extension
          }
        );
        
        self.postMessage({ type: 'complete', result: serializableResult });
      } catch (error) {
        console.error("Error in generate:", error);
        self.postMessage({ 
          type: 'error', 
          error: `Export failed: ${error.message || 'Unknown error'}`
        });
      }
    }
  } catch (error) {
    console.error("Top-level error:", error);
    self.postMessage({ 
      type: 'error', 
      error: `Worker error: ${error.message || 'Unknown error'}`
    });
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
  
  console.log(`Generating ${format} with ${frames.length} frames at ${fps} FPS`);
  
  // Filter out frames with no images
  const framesToExport = frames.filter(frame => frame.image);
  
  if (framesToExport.length === 0) {
    throw new Error('No frames with images to export');
  }
  
  // Extract frame images
  const frameImages = framesToExport.map(frame => frame.image);
  console.log(`Processing ${frameImages.length} frames with images`);
  
  // Call appropriate Python function based on format
  let result;
  
  if (format === 'gif') {
    // Generate GIF
    try {
      // Stringify and escape the frame images
      const frameImagesJson = JSON.stringify(frameImages);
      console.log(`JSON stringified frames, length: ${frameImagesJson.length}`);
      
      // Run Python code to generate GIF
      result = await pyodide.runPythonAsync(`
        try:
            frameImages = js.JSON.parse('${frameImagesJson.replace(/'/g, "\\'")}')
            result = create_gif(
                frameImages,
                ${fps},
                ${quality},
                ${resolution.width},
                ${resolution.height}
            )
            result  # Return the result
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            js.console.error(f"Python error: {str(e)}\\n{error_details}")
            raise
      `);
      
      console.log("GIF generation successful, result type:", typeof result);
      
      return {
        data: result,
        mimeType: 'image/gif',
        extension: 'gif'
      };
    } catch (error) {
      console.error("GIF generation error:", error);
      throw new Error(`GIF generation failed: ${error.message}`);
    }
  } else if (format === 'png') {
    // Generate PNG sequence
    try {
      // Stringify and escape the frame images
      const frameImagesJson = JSON.stringify(frameImages);
      console.log(`JSON stringified frames, length: ${frameImagesJson.length}`);
      
      // Run Python code to generate PNG sequence
      result = await pyodide.runPythonAsync(`
        try:
            frameImages = js.JSON.parse('${frameImagesJson.replace(/'/g, "\\'")}')
            result = create_png_sequence(
                frameImages,
                ${resolution.width},
                ${resolution.height},
                ${quality}
            )
            result  # Return the result
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            js.console.error(f"Python error: {str(e)}\\n{error_details}")
            raise
      `);
      
      console.log("PNG sequence generation successful, result type:", typeof result);
      
      return {
        data: result,
        mimeType: 'application/zip',
        extension: 'zip'
      };
    } catch (error) {
      console.error("PNG sequence generation error:", error);
      throw new Error(`PNG sequence generation failed: ${error.message}`);
    }
  } else if (format === 'mp4' || format === 'webm') {
    // For video formats, we'll return an error message for now
    try {
      // Stringify and escape the frame images
      const frameImagesJson = JSON.stringify(frameImages);
      console.log(`JSON stringified frames, length: ${frameImagesJson.length}`);
      
      // Run Python code to generate video
      result = await pyodide.runPythonAsync(`
        try:
            frameImages = js.JSON.parse('${frameImagesJson.replace(/'/g, "\\'")}')
            result = create_video(
                frameImages,
                ${fps},
                "${format}",
                ${resolution.width},
                ${resolution.height},
                ${quality},
                ${includeAudio ? "True" : "False"},
                None  # Audio data would go here
            )
            # Convert Python dict to JavaScript object
            import json
            if isinstance(result, dict):
                js.console.log("Result is a dictionary:", result)
                result_json = json.dumps(result)
                js.console.log("Result as JSON:", result_json)
                return result_json
            else:
                result  # Return the result directly
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            js.console.error(f"Python error: {str(e)}\\n{error_details}")
            raise
      `);
      
      console.log("Video generation raw result:", result);
      
      // Parse the result if it's a JSON string
      let parsedResult = result;
      if (typeof result === 'string') {
        try {
          parsedResult = JSON.parse(result);
          console.log("Parsed result:", parsedResult);
        } catch (e) {
          console.log("Result is not JSON, using as is");
        }
      }
      
      // Check if result exists and has an error property
      if (parsedResult && typeof parsedResult === 'object' && parsedResult.error) {
        throw new Error(parsedResult.error);
      }
      
      // If we got here but result is not valid, throw a generic error
      if (!parsedResult) {
        throw new Error("Video generation failed: No result returned from Python");
      }
      
      return {
        data: typeof parsedResult === 'string' ? parsedResult : JSON.stringify(parsedResult),
        mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
        extension: format
      };
    } catch (error) {
      console.error("Video generation error:", error);
      throw new Error(`Video generation failed: ${error.message}`);
    }
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
} 
