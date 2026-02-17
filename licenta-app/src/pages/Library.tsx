import React, { useState } from 'react';
import FileExplorer from '../components/FileExplorer';

const Library = () => {
    const [playingFile, setPlayingFile] = useState<{ name: string, filePath: string } | null>(null);

    const handlePlay = (file: any) => {
        // file.filePath comes from DB. 
        // We need to make sure it's accessible.
        // If it's a local path, `file://` protocol is needed.
        setPlayingFile(file);
    };

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto relative h-full flex flex-col">
            <h2 className="text-3xl font-bold mb-6">Bază de date</h2>

            <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <FileExplorer
                    mode="view"
                    onPlay={handlePlay}
                />
            </div>

            {/* Video Player Modal */}
            {playingFile && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8">
                    <div className="w-full max-w-5xl bg-gray-900 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-full">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg truncate">{playingFile.name}</h3>
                            <button
                                onClick={() => setPlayingFile(null)}
                                className="text-gray-400 hover:text-white px-2 text-2xl"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                            <video
                                src={`file://${playingFile.filePath}`}
                                controls
                                autoPlay
                                className="max-w-full max-h-[70vh]"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Library;
