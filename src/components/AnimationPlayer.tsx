import { useState, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import FrameEditor from './FrameEditor';

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
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioUrl = useRef<string>('');
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
      
      // Clean up on unmount
      return () => {
        wavesurfer.destroy();
        URL.revokeObjectURL(audioUrl.current);
      };
    }
  }, [audioFile]);

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

  return (
    <div className="player-container">
      <div className="controls">
        <button onClick={togglePlayPause}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={handleStop}>Stop</button>
        {selectedFrame !== null && (
          <button onClick={playFromSelectedFrame}>
            Play from Selected Frame
          </button>
        )}
      </div>
      
      <div className="frames-container">
        {frames.map((frame) => (
          <div
            key={frame.id}
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
      
      <div className="waveform-container" ref={waveformRef}></div>
      
      {selectedFrame !== null && (
        <FrameEditor 
          frame={frames[selectedFrame]} 
          onImageUpload={handleImageUpload} 
        />
      )}
    </div>
  );
};

export default AnimationPlayer; 
