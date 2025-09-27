import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { STYLE_OPTIONS } from './constants';
import { applyStyleToImage } from './services/geminiService';

// --- Helper Functions (defined outside component to prevent recreation on re-render) ---

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- Helper Components (defined outside main component) ---

const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const IconCamera = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

const Loader = () => (
  <div className="flex flex-col items-center justify-center space-y-4">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-fuchsia-400"></div>
    <p className="text-lg text-fuchsia-200">Traveling through time...</p>
  </div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative text-center">
    <strong className="font-bold">Oops! </strong>
    <span className="block sm:inline">{message}</span>
  </div>
);

const CameraView: React.FC<{
    onCapture: (file: File) => void;
    onCancel: () => void;
  }> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
  
    useEffect(() => {
      async function setupCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          onCancel();
        }
      }
      setupCamera();
  
      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };
    }, [onCancel]);
  
    const handleTakePhoto = () => {
      if (!videoRef.current || !canvasRef.current) return;
  
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (!context) return;
  
      // Flip the image horizontally for a natural mirror effect
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `selfie-${Date.now()}.png`, { type: 'image/png' });
          onCapture(file);
        }
      }, 'image/png', 0.95);
    };
  
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true">
        <video ref={videoRef} autoPlay playsInline className="w-full max-w-2xl h-auto rounded-lg shadow-2xl" aria-label="Camera feed"></video>
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        <div className="absolute bottom-8 flex w-full max-w-2xl items-center justify-around">
           <button onClick={onCancel} className="px-6 py-3 rounded-full bg-gray-700/80 text-white font-semibold hover:bg-gray-600 transition-colors">
            Cancel
          </button>
          <button onClick={handleTakePhoto} className="p-4 rounded-full bg-fuchsia-500/90 text-white group ring-4 ring-white/30 hover:ring-white/50 transition-all" aria-label="Take Photo">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
          </button>
          <div className="w-[88px]"></div>
        </div>
      </div>
    );
  };

// --- Main Application Component ---

export default function App() {
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const originalImagePreview = useMemo(() => {
    if (!originalImageFile) return null;
    return URL.createObjectURL(originalImageFile);
  }, [originalImageFile]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setOriginalImageFile(file);
      setGeneratedImage(null);
      setError(null);
      setSelectedStyleId(null);
    }
  };

  const handleCapture = (file: File) => {
    setOriginalImageFile(file);
    setGeneratedImage(null);
    setError(null);
    setSelectedStyleId(null);
    setIsCameraOpen(false);
  };

  const handleStyleAndGenerate = useCallback(async (styleId: string) => {
    if (!originalImageFile) {
      setError("Please upload an image before selecting a style.");
      return;
    }

    setSelectedStyleId(styleId);
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const base64Image = await fileToBase64(originalImageFile);
      const style = STYLE_OPTIONS.find(s => s.id === styleId);
      if (!style) throw new Error("Selected style not found.");
      
      const newImageBase64 = await applyStyleToImage(base64Image, originalImageFile.type, style.prompt);
      setGeneratedImage(newImageBase64);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [originalImageFile]);
  
  const handleDownloadClick = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedImage}`;
    link.download = `stylized-${originalImageFile?.name.split('.')[0] || 'image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
       {isCameraOpen && <CameraView onCapture={handleCapture} onCancel={() => setIsCameraOpen(false)} />}
      <div className="container mx-auto max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-500">
            Time Machine
          </h1>
          <p className="mt-2 text-lg text-gray-400">Travel through the decades and see your selfie reimagined.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* --- Controls Panel --- */}
          <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2 text-fuchsia-300">1. Upload Your Portrait</h2>
              <label htmlFor="file-upload" className="cursor-pointer group">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center transition-colors group-hover:border-fuchsia-500 group-hover:bg-gray-800">
                  {originalImagePreview ? (
                     <img src={originalImagePreview} alt="Uploaded preview" className="max-h-60 mx-auto rounded-md shadow-md" />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <IconUpload />
                      <p className="mt-2 text-gray-400">Click to upload a portrait</p>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
                    </div>
                  )}
                </div>
              </label>
              <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
              <div className="mt-4 text-center">
                <p className="text-gray-500 text-sm mb-2">OR</p>
                <button
                  onClick={() => setIsCameraOpen(true)}
                  className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-fuchsia-500 transition-colors"
                >
                  <IconCamera />
                  Take a Selfie
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3 text-fuchsia-300">2. Choose Your Decade</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STYLE_OPTIONS.map((style) => (
                  <button 
                    key={style.id}
                    onClick={() => handleStyleAndGenerate(style.id)}
                    disabled={isLoading}
                    className={`p-3 text-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed
                      ${selectedStyleId === style.id 
                        ? 'bg-fuchsia-500 text-white shadow-lg scale-105' 
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      }`}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* --- Output Panel --- */}
          <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center justify-center min-h-[400px]">
            {isLoading && <Loader />}
            {error && !isLoading && <ErrorMessage message={error} />}
            {generatedImage && !isLoading && (
              <div className="text-center w-full">
                <h2 className="text-2xl font-bold mb-4 text-fuchsia-300">Welcome to the Past!</h2>
                <img src={`data:image/png;base64,${generatedImage}`} alt="Generated styled" className="w-full max-w-md mx-auto rounded-lg shadow-2xl mb-6" />
                <button
                  onClick={handleDownloadClick}
                  className="w-full max-w-md py-3 text-lg font-bold rounded-lg transition-all duration-300 ease-in-out text-gray-900
                             bg-gradient-to-r from-fuchsia-400 to-purple-500 hover:from-fuchsia-500 hover:to-purple-600
                             focus:outline-none focus:ring-4 focus:ring-purple-400/50 shadow-lg hover:shadow-purple-500/30"
                >
                  Download Image
                </button>
              </div>
            )}
            {!isLoading && !error && !generatedImage && (
              <div className="text-center text-gray-500">
                <p className="text-lg">Your time-traveled portrait will materialize here.</p>
                <p>Ready to take a trip?</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}