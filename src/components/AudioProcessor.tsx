import React, { useCallback, useState, useRef } from 'react';
import { Upload, AudioWaveform as Waveform } from 'lucide-react';
import { filters, FilterConfig } from '../lib/filterConfig';

// 1GB size limit
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes

// Supported audio MIME types
const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/webm',
  'audio/flac'
];

function AudioProcessor() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const createFilter = (ctx: OfflineAudioContext, config: FilterConfig) => {
    const filter = ctx.createBiquadFilter();
    filter.type = config.type;
    filter.frequency.value = config.freq;
    filter.gain.value = config.gain;
    if (config.Q !== undefined) {
      filter.Q.value = config.Q;
    }
    return filter;
  };

  const processAudio = async (audioBuffer: AudioBuffer) => {
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Sort filters by frequency
    const sortedFilters = [...filters].sort((a, b) => a.freq - b.freq);

    // Create and connect filters in series
    let currentNode: AudioNode = source;
    sortedFilters.forEach(filterConfig => {
      const filter = createFilter(offlineCtx, filterConfig);
      currentNode.connect(filter);
      currentNode = filter;
    });
    
    // Connect the last filter to the destination
    currentNode.connect(offlineCtx.destination);

    source.start(0);
    return offlineCtx.startRendering();
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError('');

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Check file type
    if (!SUPPORTED_AUDIO_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please use a standard audio format (WAV, MP3, OGG, AAC, M4A, FLAC)');
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size must be less than 1GB`);
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const processedBuffer = await processAudio(audioBuffer);
      
      // Convert to WAV and download
      const wav = audioBufferToWav(processedBuffer);
      const blob = new Blob([wav], { type: file.type }); // Use original file type
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const lastDotIndex = file.name.lastIndexOf('.');
      const newFileName = lastDotIndex !== -1
        ? file.name.slice(0, lastDotIndex) + '-EQ' + file.name.slice(lastDotIndex)
        : file.name + '-EQ';
      a.href = url;
      a.download = newFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error processing audio:', error);
      setError('Error processing audio file. Make sure the file is a valid audio format.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center mb-6">
            <Waveform className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Audio EQ Processor</h1>
            <p className="text-gray-600 mt-2">Drop your audio file (max 1GB)</p>
            <p className="text-sm text-gray-500 mt-1">Supported formats: WAV, MP3, OGG, AAC, M4A, FLAC</p>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
              ${isDragging 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-300 hover:border-indigo-400'
              }
            `}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {fileName 
                ? `File selected: ${fileName}`
                : 'Drag and drop your audio file here'
              }
            </p>
          </div>

          {error && (
            <div className="mt-4 text-center">
              <div className="text-red-600">{error}</div>
            </div>
          )}

          {isProcessing && (
            <div className="mt-4 text-center">
              <div className="animate-pulse text-indigo-600">Processing audio...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
  const view = new DataView(wav);
  
  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * blockAlign, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, buffer.length * blockAlign, true);
  
  // Write audio data
  const offset = 44;
  const channelData = new Float32Array(buffer.length);
  
  for (let channel = 0; channel < numChannels; channel++) {
    buffer.copyFromChannel(channelData, channel, 0);
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), int16, true);
    }
  }
  
  return new Uint8Array(wav);
}

export default AudioProcessor;