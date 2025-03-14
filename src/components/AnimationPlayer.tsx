import { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import FrameEditor from './FrameEditor';
import AnimationPreview from './AnimationPreview';

interface AnimationPlayerProps {
  audioFile: File;
}

interface FrameData {
  id: number;
  time: number;
  image: string | null;
}

interface GifInfo {
  frames: string[];
  totalDuration: number; // Total duration in seconds
}

const AnimationPlayer = ({ audioFile }: AnimationPlayerProps) => {
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isWaveformReady, setIsWaveformReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [lastSelectedFrame, setLastSelectedFrame] = useState<number | null>(null);
  const [visibleFrames, setVisibleFrames] = useState<{ start: number; end: number }>({ start: 0, end: 50 });
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioUrl = useRef<string>('');
  const framesContainerRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const FPS = 24;
  const FRAME_WIDTH = 24; // Width of a frame including gap (20px + 2px gap + 2px border)
  const BUFFER_SIZE = 20; // Number of extra frames to render on each side

  // Generate frames based on audio duration and FPS
  const generateFrames = useCallback((audioDuration: number) => {
    // Only generate frames if they don't exist yet
    if (frames.length === 0) {
      const totalFrames = Math.ceil(audioDuration * FPS);
      const newFrames: FrameData[] = [];
      
      for (let i = 0; i < totalFrames; i++) {
        newFrames.push({
          id: i,
          time: i / FPS,
          image: null,
        });
      }
      
      setFrames(newFrames);
      // Reset frame refs array to match the new number of frames
      frameRefs.current = Array(totalFrames).fill(null);
    }
  }, [frames.length, FPS]);

  // Initialize and set up WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !audioFile) return;
    
    // Reset state when audio file changes
    setIsWaveformReady(false);
    
    // Clean up previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    
    // Create audio URL
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
    }
    audioUrl.current = URL.createObjectURL(audioFile);
    
    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4F4A85',
      progressColor: '#383351',
      cursorColor: '#646cff',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 1,
      height: 100,
      barGap: 2,
    });
    
    wavesurferRef.current = wavesurfer;
    
    // Set up event listeners
    const handleReady = () => {
      setDuration(wavesurfer.getDuration());
      generateFrames(wavesurfer.getDuration());
      setIsWaveformReady(true);
      console.log('Waveform is ready');
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleFinish = () => setIsPlaying(false);
    
    // Track current time for animation preview
    const handleAudioProcess = (time: number) => {
      setCurrentTime(time);
      
      // Update selected frame during playback
      const frameIndex = Math.floor(time * FPS);
      if (frameIndex >= 0 && frameIndex < frames.length) {
        setSelectedFrame(frameIndex);
      }
    };
    
    // Update current time and selected frame when seeking
    const updateOnSeek = () => {
      if (wavesurferRef.current) {
        const newTime = wavesurferRef.current.getCurrentTime();
        setCurrentTime(newTime);
        
        // Update selected frame based on the new time position
        const frameIndex = Math.floor(newTime * FPS);
        if (frameIndex >= 0 && frameIndex < frames.length) {
          setSelectedFrame(frameIndex);
        }
      }
    };
    
    // Add click handler for waveform to update frame when clicked
    const handleInteraction = () => {
      updateOnSeek();
    };
    
    wavesurfer.on('ready', handleReady);
    wavesurfer.on('play', handlePlay);
    wavesurfer.on('pause', handlePause);
    wavesurfer.on('finish', handleFinish);
    wavesurfer.on('audioprocess', handleAudioProcess);
    // @ts-expect-error - WaveSurfer types might not include all events
    wavesurfer.on('seek', updateOnSeek);
    wavesurfer.on('interaction', handleInteraction);
    
    // Load audio file
    wavesurfer.load(audioUrl.current);
    
    // Clean up on unmount or when audioFile changes
    return () => {
      wavesurfer.un('ready', handleReady);
      wavesurfer.un('play', handlePlay);
      wavesurfer.un('pause', handlePause);
      wavesurfer.un('finish', handleFinish);
      wavesurfer.un('audioprocess', handleAudioProcess);
      // @ts-expect-error - WaveSurfer types might not include all events
      wavesurfer.un('seek', updateOnSeek);
      wavesurfer.un('interaction', handleInteraction);
      wavesurfer.destroy();
      URL.revokeObjectURL(audioUrl.current);
    };
  }, [audioFile, FPS, frames.length, generateFrames]);

  // Handle play/pause
  const togglePlayPause = () => {
    if (wavesurferRef.current && isWaveformReady) {
      console.log('Toggling play/pause');
      
      // Store the selected frame before playing
      if (!isPlaying && selectedFrame !== null) {
        setLastSelectedFrame(selectedFrame);
      }
      
      // Directly use playPause without trying to access audio context
      // WaveSurfer handles this internally
      wavesurferRef.current.playPause();
    } else {
      console.log('Waveform not ready yet');
    }
  };

  // Handle stop (go to start)
  const handleStop = () => {
    if (wavesurferRef.current) {
      // Remember the current selected frame before stopping
      if (selectedFrame !== null) {
        setLastSelectedFrame(selectedFrame);
      }
      
      // Stop the playback
      wavesurferRef.current.stop();
      
      // If we have a last selected frame, restore it after a short delay
      // to allow the waveform to update
      if (lastSelectedFrame !== null) {
        setTimeout(() => {
          setSelectedFrame(lastSelectedFrame);
          if (wavesurferRef.current) {
            const frameTime = frames[lastSelectedFrame].time;
            wavesurferRef.current.seekTo(frameTime / duration);
          }
        }, 50);
      } else {
        // Default to first frame if no last selected frame
        setSelectedFrame(0);
      }
    }
  };

  // Handle frame selection
  const handleFrameClick = (frameId: number) => {
    setSelectedFrame(frameId);
    if (wavesurferRef.current) {
      const frameTime = frames[frameId].time;
      wavesurferRef.current.seekTo(frameTime / duration);
    }
  };

  // Handle image upload for a frame
  const handleImageUpload = (image: string, frameId: number = selectedFrame!) => {
    if (frameId !== null && frameId >= 0 && frameId < frames.length) {
      setFrames(frames.map(frame => 
        frame.id === frameId ? { ...frame, image } : frame
      ));
    }
  };

  // Handle frame drag over
  const handleFrameDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  };

  // Handle frame drag leave
  const handleFrameDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  };

  // Handle frame drop
  const handleFrameDrop = (e: React.DragEvent<HTMLDivElement>, frameId: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      
      if (file.type === 'image/gif') {
        // Process GIF directly on the frame
        processGifForFrame(file, frameId);
      } else if (file.type.startsWith('image/')) {
        // Process regular image
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target && typeof e.target.result === 'string') {
            handleImageUpload(e.target.result, frameId);
          }
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload an image file');
      }
    }
  };

  // Process GIF for direct frame drop
  const processGifForFrame = async (file: File, frameId: number) => {
    try {
      // Import dynamically to avoid issues
      const { parseGIF, decompressFrames } = await import('gifuct-js');
      
      // Read the file as ArrayBuffer
      const buffer = await file.arrayBuffer();
      
      // Parse the GIF
      const gif = parseGIF(new Uint8Array(buffer));
      const frames = decompressFrames(gif, true);
      
      // Calculate total duration in seconds
      // GIF delays are in milliseconds
      const totalDurationMs = frames.reduce((sum, frame) => sum + frame.delay, 0);
      const totalDuration = totalDurationMs / 1000; // Convert milliseconds to seconds
      
      console.log(`GIF info: ${frames.length} frames, total duration: ${totalDuration}s`);
      
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
        handleImageUpload(frameImages[0], frameId);
      }
      
      // Process the GIF for subsequent frames
      handleGifProcessed({
        frames: frameImages,
        totalDuration
      }, frameId);
      
    } catch (error) {
      console.error('Error processing GIF:', error);
      alert('Error processing GIF. Please try another file.');
    }
  };

  // Handle GIF processing and align its length with the audio timeline
  const handleGifProcessed = (gifInfo: GifInfo, startFrameId: number) => {
    // Create a copy of the current frames
    const updatedFrames = [...frames];
    
    // Calculate how many audio frames the GIF should span
    const audioFramesForGif = Math.ceil(gifInfo.totalDuration * FPS);
    
    console.log(`Mapping GIF (${gifInfo.frames.length} frames, ${gifInfo.totalDuration.toFixed(2)}s) to ${audioFramesForGif} audio frames`);
    
    // Determine the end frame ID (capped by the total number of frames)
    const endFrameId = Math.min(startFrameId + audioFramesForGif, frames.length);
    
    // Calculate how many audio frames we actually have available
    const availableFrames = endFrameId - startFrameId;
    
    // Distribute GIF frames evenly across the available audio frames
    for (let i = 0; i < availableFrames; i++) {
      // Calculate which GIF frame to use based on the relative position
      const gifFrameIndex = Math.min(
        Math.floor((i / availableFrames) * gifInfo.frames.length),
        gifInfo.frames.length - 1
      );
      
      // Apply the GIF frame to the corresponding audio frame
      const frameIndex = startFrameId + i;
      updatedFrames[frameIndex] = {
        ...updatedFrames[frameIndex],
        image: gifInfo.frames[gifFrameIndex]
      };
    }
    
    // Update frames state
    setFrames(updatedFrames);
  };

  // Start playback from selected frame
  const playFromSelectedFrame = () => {
    if (wavesurferRef.current && selectedFrame !== null && isWaveformReady) {
      // Store the selected frame before playing
      setLastSelectedFrame(selectedFrame);
      
      const frameTime = frames[selectedFrame].time;
      wavesurferRef.current.seekTo(frameTime / duration);
      wavesurferRef.current.play();
    }
  };

  // Add a direct click handler for the waveform container
  const handleWaveformClick = () => {
    if (wavesurferRef.current && !isPlaying) {
      const newTime = wavesurferRef.current.getCurrentTime();
      const frameIndex = Math.floor(newTime * FPS);
      if (frameIndex >= 0 && frameIndex < frames.length) {
        setSelectedFrame(frameIndex);
      }
    }
  };

  // Handle scroll event to update visible frames
  const handleScroll = useCallback(() => {
    if (!framesContainerRef.current) return;
    
    const container = framesContainerRef.current;
    const scrollPosition = container.scrollLeft;
    const containerWidth = container.clientWidth;
    
    // Calculate which frames are visible
    const startFrame = Math.max(0, Math.floor(scrollPosition / FRAME_WIDTH) - BUFFER_SIZE);
    const endFrame = Math.min(
      frames.length - 1, 
      Math.ceil((scrollPosition + containerWidth) / FRAME_WIDTH) + BUFFER_SIZE
    );
    
    setVisibleFrames({ start: startFrame, end: endFrame });
  }, [frames.length]);

  // Add scroll event listener
  useEffect(() => {
    const container = framesContainerRef.current;
    if (container && frames.length > 0) {
      container.addEventListener('scroll', handleScroll);
      // Initial calculation of visible frames
      handleScroll();
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [frames.length, handleScroll]);

  // Recalculate visible frames when window is resized
  useEffect(() => {
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('resize', handleScroll);
    };
  }, [handleScroll]);

  // Handle mouse down for drag scrolling
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!framesContainerRef.current) return;
    
    setIsDragging(true);
    setStartX(e.pageX - framesContainerRef.current.offsetLeft);
    setScrollLeft(framesContainerRef.current.scrollLeft);
  };

  // Handle mouse leave and mouse up to stop dragging
  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  // Handle mouse move for drag scrolling
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !framesContainerRef.current) return;
    
    // Prevent default to avoid text selection during drag
    e.preventDefault();
    
    const x = e.pageX - framesContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    framesContainerRef.current.scrollLeft = scrollLeft - walk;
    
    // Update visible frames during dragging
    handleScroll();
  };

  // Update spotlight position when window is resized
  useEffect(() => {
    if (isPlaying && selectedFrame !== null && framesContainerRef.current && frameRefs.current[selectedFrame]) {
      const container = framesContainerRef.current;
      
      const updateSpotlightPosition = () => {
        const selectedElement = frameRefs.current[selectedFrame];
        
        if (container && selectedElement) {
          // Get the element's position relative to the viewport
          const elementRect = selectedElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Calculate the horizontal position for the spotlight
          const viewportX = elementRect.left + (elementRect.width / 2);
          const relativeX = (viewportX / window.innerWidth) * 100;
          
          // Set the spotlight position and dimensions
          container.style.setProperty('--spotlight-x', `${relativeX}%`);
          container.style.setProperty('--spotlight-top', `${containerRect.top}px`);
          container.style.setProperty('--spotlight-height', `${containerRect.height}px`);
        }
      };
      
      // Update position initially
      updateSpotlightPosition();
      
      // Add event listeners for resize and scroll
      window.addEventListener('resize', updateSpotlightPosition);
      container.addEventListener('scroll', updateSpotlightPosition);
      
      // Clean up
      return () => {
        window.removeEventListener('resize', updateSpotlightPosition);
        container.removeEventListener('scroll', updateSpotlightPosition);
      };
    }
  }, [isPlaying, selectedFrame]);

  // Scroll to selected frame when it changes
  useEffect(() => {
    if (selectedFrame !== null && framesContainerRef.current && frameRefs.current[selectedFrame]) {
      const container = framesContainerRef.current;
      const selectedElement = frameRefs.current[selectedFrame];
      
      if (selectedElement) {
        // Calculate the scroll position to center the selected frame
        const containerWidth = container.clientWidth;
        const elementLeft = selectedElement.offsetLeft;
        const elementWidth = selectedElement.clientWidth;
        
        // Center the element in the container
        const scrollPosition = elementLeft - (containerWidth / 2) + (elementWidth / 2);
        
        // Always use auto during playback to avoid lag
        container.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'auto'
        });
        
        // Update spotlight position for the filter effect
        if (isPlaying) {
          // Get the element's position relative to the viewport
          const elementRect = selectedElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Calculate the horizontal position for the spotlight
          const viewportX = elementRect.left + (elementRect.width / 2);
          const relativeX = (viewportX / window.innerWidth) * 100;
          
          // Set the spotlight position and dimensions
          container.style.setProperty('--spotlight-x', `${relativeX}%`);
          container.style.setProperty('--spotlight-top', `${containerRect.top}px`);
          container.style.setProperty('--spotlight-height', `${containerRect.height}px`);
        }
      }
    }
  }, [selectedFrame, isPlaying]);

  // Add padding to the frames container for better centering of first and last frames
  useEffect(() => {
    if (framesContainerRef.current && frames.length > 0) {
      const updatePadding = () => {
        if (!framesContainerRef.current) return;
        
        // Get the container width
        const containerWidth = framesContainerRef.current.clientWidth;
        
        // Set padding to half the container width to allow first and last frames to be centered
        const paddingElement = document.createElement('div');
        paddingElement.className = 'frames-padding';
        paddingElement.style.minWidth = `${containerWidth / 2 - 10}px`; // Subtract half frame width
        paddingElement.style.width = `${containerWidth / 2 - 10}px`;
        paddingElement.style.height = '1px';
        paddingElement.style.display = 'block';
        
        // Add padding elements to the beginning and end of the container
        const firstChild = framesContainerRef.current.firstChild;
        const paddingStart = paddingElement.cloneNode(true);
        const paddingEnd = paddingElement.cloneNode(true);
        
        // Remove existing padding elements if they exist
        const existingPadding = framesContainerRef.current.querySelectorAll('.frames-padding');
        existingPadding.forEach(el => el.remove());
        
        // Add new padding elements
        framesContainerRef.current.insertBefore(paddingStart, firstChild);
        framesContainerRef.current.appendChild(paddingEnd);
      };
      
      // Initial update
      updatePadding();
      
      // Update padding when window is resized
      window.addEventListener('resize', updatePadding);
      
      // Clean up
      return () => {
        window.removeEventListener('resize', updatePadding);
      };
    }
  }, [frames.length]);

  // Create a placeholder for frames that are not visible
  const renderFramePlaceholder = (frameCount: number) => {
    if (frameCount <= 0) return null;
    return (
      <div 
        className="frames-placeholder" 
        style={{ 
          minWidth: `${frameCount * FRAME_WIDTH}px`, 
          width: `${frameCount * FRAME_WIDTH}px`,
          height: '40px'
        }}
      />
    );
  };

  return (
    <div className="player-container">
      <div className="controls">
        <button onClick={togglePlayPause}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={handleStop}>Stop</button>
        {selectedFrame !== null && !isPlaying && (
          <button onClick={playFromSelectedFrame}>
            Play from Selected Frame
          </button>
        )}
      </div>
      
      <div 
        className={`frames-container ${isPlaying ? 'playing' : ''}`}
        ref={framesContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Padding for first and last frames will be handled by updatePadding useEffect */}
        
        {/* Placeholder for frames before the visible range */}
        {visibleFrames.start > 0 && renderFramePlaceholder(visibleFrames.start)}
        
        {/* Only render frames that are visible */}
        {frames.slice(visibleFrames.start, visibleFrames.end + 1).map((frame) => (
          <div
            key={frame.id}
            ref={el => { frameRefs.current[frame.id] = el; }}
            className={`frame ${selectedFrame === frame.id ? 'selected' : ''}`}
            onClick={() => handleFrameClick(frame.id)}
            title={`Frame ${frame.id} (${frame.time.toFixed(2)}s)`}
            onDragOver={handleFrameDragOver}
            onDragLeave={handleFrameDragLeave}
            onDrop={(e) => handleFrameDrop(e, frame.id)}
            style={{ position: 'relative' }}
            data-frame-id={frame.id}
          >
            {frame.image ? (
              <img src={frame.image} alt={`Frame ${frame.id}`} className="frame-image" />
            ) : (
              <div className="empty-frame"></div>
            )}
          </div>
        ))}
        
        {/* Placeholder for frames after the visible range */}
        {visibleFrames.end < frames.length - 1 && renderFramePlaceholder(frames.length - 1 - visibleFrames.end)}
      </div>
      
      <div 
        className="waveform-container" 
        ref={waveformRef}
        onClick={handleWaveformClick}
      ></div>
      
      {isPlaying ? (
        <AnimationPreview frames={frames} currentTime={currentTime} />
      ) : (
        selectedFrame !== null && (
          <FrameEditor 
            frame={frames[selectedFrame]} 
            onImageUpload={(image) => handleImageUpload(image)}
            onGifProcessed={handleGifProcessed}
          />
        )
      )}
    </div>
  );
};

export default AnimationPlayer; 
