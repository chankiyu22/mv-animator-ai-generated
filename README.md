# MV Animator

A client-side SPA web application for creating animations synchronized with audio.

## Features

- Upload audio files
- View audio waveform
- Create frame-by-frame animations at 24 FPS
- Upload images for each frame
- Play, pause, and control animation playback
- Start playback from any selected frame

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mv-animator.git
cd mv-animator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## How to Use

1. **Upload Audio**: 
   - Drag and drop an audio file onto the upload area or click to select a file
   - Supported formats: MP3, WAV, OGG, etc.

2. **View Frames**:
   - After uploading audio, frames will be generated at 24 frames per second
   - The waveform of the audio will be displayed below the frames

3. **Edit Frames**:
   - Click on any frame to select it
   - Upload an image for the selected frame by dragging and dropping or clicking to select
   - You can replace or remove images from frames

4. **Playback Controls**:
   - Use the Play/Pause button to control playback
   - Use the Stop button to return to the beginning
   - When a frame is selected, you can use "Play from Selected Frame" to start playback from that point

## Technologies Used

- React
- TypeScript
- Vite
- WaveSurfer.js

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- WaveSurfer.js for audio visualization
- React and Vite for the frontend framework
