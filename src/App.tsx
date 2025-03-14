import { useState } from 'react'
import './App.css'
import AudioUploader from './components/AudioUploader'
import AnimationPlayer from './components/AnimationPlayer'

function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null)

  return (
    <div className="app-container">
      <h1>MV Animator</h1>
      {!audioFile ? (
        <AudioUploader onAudioUploaded={setAudioFile} />
      ) : (
        <AnimationPlayer audioFile={audioFile} />
      )}
    </div>
  )
}

export default App
