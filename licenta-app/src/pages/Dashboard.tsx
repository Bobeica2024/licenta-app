import React, { useState, useRef } from 'react';
import StreamPlayer, { StreamPlayerRef } from '../components/StreamPlayer';
import { useRecorder } from '../hooks/useRecorder';

const Dashboard = () => {
    const [url, setUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [saveDestination, setSaveDestination] = useState('local'); // 'local' | 'sqlite' | 'drive'
    const [isUploading, setIsUploading] = useState(false);

    const playerRef = useRef<StreamPlayerRef>(null);

    const {
        isRecording,
        isPaused,
        recordingTime,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording
    } = useRecorder({
        onStop: async (path) => {
            console.log('Recording saved locally to:', path);

            if (saveDestination === 'drive') {
                const confirmUpload = confirm(`Recording saved locally. Upload to Google Drive?`);
                if (confirmUpload) {
                    setIsUploading(true);
                    try {
                        // We pass null for tokens as the backend manages the session in memory for now
                        const result = await window.api.drive.upload(path, null) as any;
                        if (result.success) {
                            alert(`Successfully uploaded to Drive!\nLink: ${result.link}`);
                            // TODO: Save metadata to SQLite if needed
                        } else {
                            alert(`Upload failed: ${result.error}`);
                        }
                    } catch (err: any) {
                        alert(`Error uploading: ${err.message}`);
                    } finally {
                        setIsUploading(false);
                    }
                }
            } else if (saveDestination === 'sqlite') {
                // Trigger SQLite save (actually metadata save, file is already local)
                // The backend recorder handler already does this if we pass saveToDb=true
                // But our useRecorder hook just calls stopSave.
                // We might need to handle this in stopRecording or here.
                // For now, let's just alert.
                alert(`Saved to Local. Metadata would be saved to SQLite.`);
            } else {
                alert(`Recording saved to: ${path}`);
            }
        }
    });

    // --- Sync Logic ---

    const handleVideoPause = () => {
        console.log('Video Paused');
        if (isRecording && !isPaused) {
            console.log('-> Auto-pausing Recording');
            pauseRecording();
        }
    };

    const handleVideoPlay = () => {
        console.log('Video Playing');
    };

    const handleResumeRecording = () => {
        resumeRecording();
        // Auto-play video if it was paused
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
                <p>API Status: <span className={window.api ? "text-green-500" : "text-red-500"}>{window.api ? "CONNECTED" : "DISCONNECTED (Preload Failed)"}</span></p>
                <p>Preload Path: {window.api ? "Loaded" : "Not Loaded"}</p>
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
                        />
                        <button
                            onClick={handleConnect}
                            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Connect
                        </button>
                        <button
                            onClick={() => setUrl('https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4')}
                            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Test MP4
                        </button>
                        <button
                            onClick={() => {
                                // Assuming we can access the ref via context or pass a callback, but specific to this component structure:
                                // Since ref is not directly accessible here easily without Context, let's keep it simple for now and rely on ReactPlayer behavior first.
                                // Actually, let's just use console log for now or force a specific URL known to work.
                                // Or better, let's use a known working YouTube video ID directly in the StreamPlayer component logic for testing.
                                setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Rick Roll always works?
                            }}
                            className="bg-yellow-600 hover:bg-yellow-700 px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Test YT
                        </button>
                        <button
                            onClick={() => playerRef.current?.toggleRawYoutube?.()}
                            className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Toggle Iframe
                        </button>
                    </div>

                    <div className="bg-black rounded-xl border border-gray-800 flex-1 overflow-hidden relative">
                        {url ? (
                            <StreamPlayer
                                key={url}
                                ref={playerRef}
                                url={url}
                                onPause={handleVideoPause}
                                onPlay={handleVideoPlay}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No stream connected
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls Area */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 flex flex-col">
                    <h3 className="text-xl font-semibold mb-6">Controls</h3>

                    <div className="space-y-4">
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 ${!url ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                                disabled={!url || isUploading}
                            >
                                <div className={`w-4 h-4 rounded-full ${!url ? 'bg-gray-500' : 'bg-white animate-pulse'}`} />
                                {isUploading ? 'Uploading...' : 'Start Recording'}
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-red-900/30 border border-red-900 rounded-lg p-4 text-center animate-pulse">
                                    <span className="text-red-400 font-mono text-xl">{recordingTime}</span>
                                    <p className="text-xs text-red-500 uppercase mt-1">Status: {isPaused ? 'PAUSED' : 'LIVE'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {isPaused ? (
                                        <button
                                            onClick={handleResumeRecording}
                                            className="py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                                        >
                                            Resume Rec
                                        </button>
                                    ) : (
                                        <button
                                            onClick={pauseRecording}
                                            className="py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors"
                                        >
                                            Pause Rec
                                        </button>
                                    )}
                                    <button
                                        onClick={stopRecording}
                                        className="py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                                    >
                                        Stop Rec
                                    </button>
                                </div>
                            </div>
                        )}

                        <hr className="border-gray-800 my-6" />

                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Save Destination</label>
                            <select
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none"
                                value={saveDestination}
                                onChange={(e) => setSaveDestination(e.target.value)}
                                disabled={isRecording || isUploading}
                            >
                                <option value="local">Local Computer</option>
                                <option value="sqlite">Database (SQLite)</option>
                                <option value="drive">Google Drive</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
