import React, { useState, useRef } from 'react';
import StreamPlayer, { StreamPlayerRef } from '../components/StreamPlayer';
import { useRecorder } from '../hooks/useRecorder';

const Dashboard = () => {
    const [url, setUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [saveDestination, setSaveDestination] = useState('local'); // 'local' | 'sqlite' | 'drive'
    const [isUploading, setIsUploading] = useState(false);

    const [showRawYoutube, setShowRawYoutube] = useState(false);
    const playerWrapperRef = useRef<HTMLDivElement>(null);

    const playerRef = useRef<StreamPlayerRef>(null);

    // We need to track the cropped path if it exists to save THAT one instead of the original temp.
    // Since onStop is async and independent of the render cycle for saving (user clicks button later),
    // we need to store the result of cropping.
    const [croppedFilePath, setCroppedFilePath] = useState<string | null>(null);

    const {
        isRecording,
        isPaused,
        recordingTime,
        startRecording,
        stopRecording,
        discardRecording,
        pauseRecording,
        resumeRecording,
        currentFilePath
    } = useRecorder({
        onStop: async (path) => {
            console.log('Recording stopped. Temp file at:', path);

            // Calculate crop dimensions based on the player wrapper element
            if (playerWrapperRef.current) {
                const rect = playerWrapperRef.current.getBoundingClientRect();

                // We need to account for the window's own UI if capturing whole window?
                // The recording source 'desktop' usually captures the client area if we select the window?
                // Or the whole screen depending on source.
                // Assuming we capture the *window*, the 0,0 is the top-left of the webview logic usually.
                // Let's rely on getBoundingClientRect() relative to the viewport.

                // IMPORTANT: High DPI screens might need scaling. 
                // devicePixelRatio usually handles this in browser, but FFmpeg filters work on pixels.
                // We might need to multiply by window.devicePixelRatio?
                // Let's try without first, as getDisplayMedia usually returns logical pixels or scaled?
                // Actually, video dimensions match the stream resolution.

                // Apply inset to remove borders (assuming ~2px border/shadow)
                // Also ensure we stay within bounds
                const INSET = 2; // Pixels to shave off edges

                let cropX = Math.round(rect.x * window.devicePixelRatio) + INSET;
                let cropY = Math.round(rect.y * window.devicePixelRatio) + INSET;
                let cropW = Math.round(rect.width * window.devicePixelRatio) - (INSET * 2);
                let cropH = Math.round(rect.height * window.devicePixelRatio) - (INSET * 2);

                const crop = {
                    x: cropX,
                    y: cropY,
                    width: cropW,
                    height: cropH
                };

                // Ensure dimensions are even numbers (ffmpeg requirement often)
                crop.width = Math.floor(crop.width / 2) * 2;
                crop.height = Math.floor(crop.height / 2) * 2;
                crop.x = Math.floor(crop.x / 2) * 2;
                crop.y = Math.floor(crop.y / 2) * 2;

                console.log('Applying crop:', crop);

                setIsUploading(true); // Show some activity while cropping
                try {
                    const result = await window.api.recorder.cropVideo({ inputPath: path, crop });

                    if (result.success && result.outputPath) {
                        console.log('Crop successful:', result.outputPath);
                        setCroppedFilePath(result.outputPath);
                    } else {
                        console.error('Crop failed:', result.error);
                        // Optional: alert user or just fallback to original
                    }
                } catch (error) {
                    console.error('Error calling cropVideo:', error);
                } finally {
                    setIsUploading(false);
                }
            }
        }
    });

    // Reset cropped path when recording starts
    React.useEffect(() => {
        if (isRecording) {
            setCroppedFilePath(null);
        }
    }, [isRecording]);

    const handleSaveRecording = async () => {
        // Use cropped path if available, otherwise original
        const path = croppedFilePath || currentFilePath;
        if (!path) return;

        setIsUploading(true);
        try {
            const result = await window.api.recorder.saveFile({
                tempPath: path,
                destination: saveDestination,
                // userId: 1, // TODO: Get actual user ID
                title: `Recording ${new Date().toLocaleString()}`,
                sourceUrl: url
            });

            if (result.success) {
                alert(`Saved successfully to: ${saveDestination === 'drive' ? 'Google Drive' : result.filePath}`);
                // Cleanup both files if needed
                if (croppedFilePath && currentFilePath && croppedFilePath !== path) {
                    await discardRecording(); // cleans currentFilePath
                    await window.api.recorder.deleteTempFile(croppedFilePath);
                } else {
                    await discardRecording();
                }
                setCroppedFilePath(null);
            } else {
                alert(`Save failed: ${result.error}`);
            }
        } catch (err: any) {
            alert(`Error saving: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDiscard = async () => {
        if (confirm("Sigur doriți să renunțați la înregistrare?")) {
            await discardRecording();
            if (croppedFilePath) {
                await window.api.recorder.deleteTempFile(croppedFilePath);
                setCroppedFilePath(null);
            }
        }
    };

    // --- Sync Logic ---

    // Wait, we need to access isRecording. 
    // If we use empty dependency [], we capture initial state (false).
    // We need a ref to track recording state without triggering re-renders of callbacks.
    const recordingStateRef = useRef({ isRecording: false, isPaused: false });

    // Update ref when state changes
    React.useEffect(() => {
        recordingStateRef.current = { isRecording, isPaused };
    }, [isRecording, isPaused]);

    const handleVideoPauseCallback = React.useCallback(() => {
        console.log('Video Paused');
        const { isRecording, isPaused } = recordingStateRef.current;
        if (isRecording && !isPaused) {
            console.log('-> Auto-pausing Recording');
            pauseRecording();
        }
    }, [pauseRecording]); // pauseRecording from hook might strictly be stable? Let's hope.

    const handleVideoPlayCallback = React.useCallback(() => {
        console.log('Video Playing');
    }, []);

    const handleResumeRecording = () => {
        resumeRecording();
        playerRef.current?.play();
    };

    const handleConnect = () => {
        if (inputUrl) {
            setUrl(inputUrl);
        }
    };

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto">
            <h2 className="text-3xl font-bold mb-6">Dashboard</h2>

            {/* Debug Monitor */}
            <div className="mb-4 p-2 bg-gray-800 rounded border border-gray-700 font-mono text-xs">
                <p>API Status: <span className={window.api ? "text-green-500" : "text-red-500"}>{window.api ? "CONNECTED" : "DISCONNECTED"}</span></p>
                <p>Path: {currentFilePath || "None"}</p>
                {croppedFilePath && <p>Cropped Path: {croppedFilePath}</p>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                {/* Stream Area */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                            placeholder="Paste Youtube URL here..."
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            disabled={isRecording || !!currentFilePath}
                        />
                        <button
                            onClick={handleConnect}
                            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
                            disabled={isRecording || !!currentFilePath}
                        >
                            Connect
                        </button>
                        <button
                            onClick={() => setUrl('https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4')}
                            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition-colors"
                            disabled={isRecording || !!currentFilePath}
                        >
                            Test MP4
                        </button>
                        <button
                            onClick={() => setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                            className="bg-yellow-600 hover:bg-yellow-700 px-6 py-2 rounded-lg font-medium transition-colors"
                            disabled={isRecording || !!currentFilePath}
                        >
                            Test YT
                        </button>
                        <button
                            onClick={() => {
                                setShowRawYoutube(prev => !prev);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition-colors"
                            disabled={isRecording || !!currentFilePath}
                        >
                            {showRawYoutube ? 'Show Player' : 'Load Iframe'}
                        </button>
                    </div>

                    <div className="bg-black/20 rounded-xl border border-gray-800 flex-1 flex items-center justify-center overflow-hidden relative">
                        {/* Enforce 16:9 Aspect Ratio Container for the Player */}
                        <div
                            ref={playerWrapperRef}
                            className="w-full max-w-full aspect-video bg-black relative shadow-2xl"
                        >
                            {/* PREVIEW MODE */}
                            {!isRecording && currentFilePath ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 border-2 border-yellow-500/50 relative p-4">
                                    <div className="absolute top-4 left-4 bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold uppercase tracking-wider z-10">
                                        Preview Mode {croppedFilePath ? '(Cropped)' : ''}
                                    </div>
                                    <video
                                        src={`file://${croppedFilePath || currentFilePath}`}
                                        controls
                                        className="w-full h-full object-contain"
                                    />
                                    <p className="text-gray-400 text-sm mt-2">Review your recording before saving.</p>
                                </div>
                            ) : url ? (
                                <StreamPlayer
                                    key={url}
                                    ref={playerRef}
                                    url={url}
                                    showRawYoutube={showRawYoutube}
                                    onPause={handleVideoPauseCallback}
                                    onPlay={handleVideoPlayCallback}
                                />
                                {isRecording && (
                                <div className="absolute inset-0 z-50 bg-transparent cursor-none" />
                            )}
                            ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No stream connected
                            </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls Area */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 flex flex-col">
                    <h3 className="text-xl font-semibold mb-6">Controls</h3>

                    <div className="space-y-4">
                        {/* 1. IDLE / READY state */}
                        {!isRecording && !currentFilePath && (
                            <button
                                onClick={startRecording}
                                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 ${!url ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                                disabled={!url || isUploading}
                            >
                                <div className={`w-4 h-4 rounded-full ${!url ? 'bg-gray-500' : 'bg-white animate-pulse'}`} />
                                Start Recording
                            </button>
                        )}

                        {/* 2. RECORDING state */}
                        {isRecording && (
                            <div className="space-y-4">
                                <div className="bg-red-900/30 border border-red-900 rounded-lg p-4 text-center animate-pulse">
                                    <span className="text-red-400 font-mono text-xl">{recordingTime}</span>
                                    <p className="text-xs text-red-500 uppercase mt-1">Status: {isPaused ? 'PAUSED' : 'LIVE'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {isPaused ? (
                                        <button onClick={handleResumeRecording} className="py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors">
                                            Resume Rec
                                        </button>
                                    ) : (
                                        <button onClick={pauseRecording} className="py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors">
                                            Pause Rec
                                        </button>
                                    )}
                                    <button onClick={stopRecording} className="py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                                        Stop Rec
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 3. PREVIEW / SAVE state */}
                        {!isRecording && currentFilePath && (
                            <div className="space-y-4 animate-fade-in">
                                <label className="text-sm text-gray-400 block mb-2">Recording Finished</label>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDiscard}
                                        className="flex-1 py-3 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                        title="Discard Recording"
                                    >
                                        🗑️ Discard
                                    </button>

                                    <button
                                        onClick={handleSaveRecording}
                                        className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? 'Saving...' : '💾 Save Recording'}
                                    </button>
                                </div>

                                <hr className="border-gray-800 my-4" />

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Save Destination</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none"
                                        value={saveDestination}
                                        onChange={(e) => setSaveDestination(e.target.value)}
                                        disabled={isUploading}
                                    >
                                        <option value="local">Local Computer</option>
                                        <option value="sqlite">Database (SQLite)</option>
                                        <option value="drive">Google Drive</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Placeholder for when no action is active, just to keep layout consistent if needed */}
                        {!isRecording && !currentFilePath && (
                            <div className="space-y-2 opacity-50">
                                <label className="text-sm text-gray-400">Save Destination (Inactive)</label>
                                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2" disabled>
                                    <option>Local Computer</option>
                                </select>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
