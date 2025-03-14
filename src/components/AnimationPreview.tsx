import { useEffect, useState } from 'react';

interface FrameData {
  id: number;
  time: number;
  image: string | null;
}

interface AnimationPreviewProps {
  frames: FrameData[];
  currentTime: number;
}

const AnimationPreview = ({ frames, currentTime }: AnimationPreviewProps) => {
  const [currentFrame, setCurrentFrame] = useState<FrameData | null>(null);
  const FPS = 24;

  useEffect(() => {
    // Calculate which frame to show based on current time
    const frameIndex = Math.floor(currentTime * FPS);
    const frame = frames.find(f => f.id === frameIndex) || null;
    setCurrentFrame(frame);
  }, [currentTime, frames, FPS]);

  return (
    <div className="animation-preview">
      <h3>Animation Preview</h3>
      <p>Current Time: {currentTime.toFixed(2)}s</p>
      <div className="preview-container">
        {currentFrame && currentFrame.image ? (
          <img 
            src={currentFrame.image} 
            alt={`Frame ${currentFrame.id}`} 
            className="preview-image"
          />
        ) : (
          <div className="empty-preview">
            <p>No image for current frame</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimationPreview; 
