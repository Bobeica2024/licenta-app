import React, { useState, useRef } from 'react';
import StreamPlayer, { StreamPlayerRef } from '../components/StreamPlayer';

const Dashboard = () => {
    const [url, setUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingPaused, setIsRecordingPaused] = useState(false); // Distinction between Stopped and Paused

    const playerRef = useRef<StreamPlayerRef>(null);

    // --- Sync Logic ---

    const handleVideoPause = () => {
        console.log('Video Paused');
        if (isRecording && !isRecordingPaused) {
            console.log('-> Auto-pausing Recording');
            pauseRecording();
        }
    };

    const handleVideoPlay = () => {
        console.log('Video Playing');
    };

    // --- Recording Controls ---

    const startRecording = () => {
        console.log('Start Recording');
        setIsRecording(true);
        setIsRecordingPaused(false);
        // TODO: Initialize media recorder
    };

    const stopRecording = () => {
        console.log('Stop Recording');
        setIsRecording(false);
        setIsRecordingPaused(false);
        // TODO: Save file
    };

    const pauseRecording = () => {
        console.log('Pause Recording');
        setIsRecordingPaused(true);
        // TODO: Pause media recorder
    };

    const resumeRecording = () => {
        console.log('Resume Recording');
        setIsRecordingPaused(false);
        // Auto-play video if it was paused
        playerRef.current?.play();
        // TODO: Resume media recorder
    };


    const handleConnect = () => {
        if (inputUrl) {
            setUrl(inputUrl);
        }
    };

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto">
            <h2 className="text-3xl font-bold mb-6">Dashboard</h2>

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
                    </div>

                    <div className="bg-black rounded-xl border border-gray-800 flex-1 overflow-hidden relative">
                        {url ? (
                            <StreamPlayer
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
                                disabled={!url}
                            >
                                <div className={`w-4 h-4 rounded-full ${!url ? 'bg-gray-500' : 'bg-white animate-pulse'}`} />
                                Start Recording
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-red-900/30 border border-red-900 rounded-lg p-4 text-center animate-pulse">
                                    <span className="text-red-400 font-mono text-xl">Recording...</span>
                                    <p className="text-xs text-red-500 uppercase mt-1">Status: {isRecordingPaused ? 'PAUSED' : 'LIVE'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {isRecordingPaused ? (
                                        <button
                                            onClick={resumeRecording}
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
                            <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none">
                                <option>Local Computer</option>
                                <option>Database (SQLite)</option>
                                <option>Google Drive</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
