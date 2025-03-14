import { useState, useEffect, useRef } from 'react';
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

const AnimationPlayer = ({ audioFile }: AnimationPlayerProps) => {
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioUrl = useRef<string>('');
  const framesContainerRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const FPS = 24;

  // Initialize WaveSurfer
  useEffect(() => {
    if (waveformRef.current && audioFile) {
      // Create audio URL
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
      
      // Load audio file
      wavesurfer.load(audioUrl.current);
      
      // Set up event listeners
      wavesurfer.on('ready', () => {
        setDuration(wavesurfer.getDuration());
        generateFrames(wavesurfer.getDuration());
      });
      
      wavesurfer.on('play', () => setIsPlaying(true));
      wavesurfer.on('pause', () => setIsPlaying(false));
      wavesurfer.on('finish', () => setIsPlaying(false));
      
      // Track current time for animation preview
      wavesurfer.on('audioprocess', (time) => {
        setCurrentTime(time);
      });
      
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
      
      // @ts-expect-error - WaveSurfer types might not include all events
      wavesurfer.on('seek', updateOnSeek);
      
      // Add click handler for waveform to update frame when clicked
      wavesurfer.on('interaction', () => {
        if (!isPlaying) {
          updateOnSeek();
        }
      });
      
      // Clean up on unmount
      return () => {
        wavesurfer.destroy();
        URL.revokeObjectURL(audioUrl.current);
      };
    }
  }, [audioFile, FPS, frames.length, isPlaying]);

  // Generate frames based on audio duration and FPS
  const generateFrames = (audioDuration: number) => {
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
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  // Handle stop (go to start)
  const handleStop = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.stop();
      setSelectedFrame(0);
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
  const handleImageUpload = (image: string) => {
    if (selectedFrame !== null) {
      setFrames(frames.map(frame => 
        frame.id === selectedFrame ? { ...frame, image } : frame
      ));
    }
  };

  // Start playback from selected frame
  const playFromSelectedFrame = () => {
    if (wavesurferRef.current && selectedFrame !== null) {
      const frameTime = frames[selectedFrame].time;
      wavesurferRef.current.seekTo(frameTime / duration);
      wavesurferRef.current.play();
    }
  };

  // Update selected frame when current time changes during playback
  useEffect(() => {
    if (isPlaying) {
      const frameIndex = Math.floor(currentTime * FPS);
      if (frameIndex >= 0 && frameIndex < frames.length) {
        setSelectedFrame(frameIndex);
      }
    }
  }, [currentTime, isPlaying, FPS, frames.length]);

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
        
        // Smooth scroll to the position
        container.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedFrame]);

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
      
      <div className="frames-container" ref={framesContainerRef}>
        {frames.map((frame, index) => (
          <div
            key={frame.id}
            ref={el => { frameRefs.current[index] = el; }}
            className={`frame ${selectedFrame === frame.id ? 'selected' : ''}`}
            onClick={() => handleFrameClick(frame.id)}
          >
            {frame.image ? (
              <img src={frame.image} alt={`Frame ${frame.id}`} className="frame-image" />
            ) : (
              <span>{frame.id}</span>
            )}
          </div>
        ))}
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
            onImageUpload={handleImageUpload} 
          />
        )
      )}
    </div>
  );
};

export default AnimationPlayer; 
