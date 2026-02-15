import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import ReactPlayer from 'react-player';

interface StreamPlayerProps {
    url: string;
    onPlay?: () => void;
    onPause?: () => void;
    showRawYoutube?: boolean;
    // toggleRawYoutube no longer needed in props if controlled by parent, 
    // but we might want to keep the imperative handle or just control it via props.
    // Let's control it via props completely.
}

export interface StreamPlayerRef {
    play: () => void;
    pause: () => void;
    // toggleRawYoutube removed from ref, controlled by prop
}

const StreamPlayer = forwardRef<StreamPlayerRef, StreamPlayerProps>(({ url, onPlay, onPause, showRawYoutube }, ref) => {
    const [playing, setPlaying] = useState(true);
    // Use any to bypass strict type checking for the library ref if needed
    const playerRef = useRef<any>(null);
    // const [showRawYoutube, setShowRawYoutube] = useState(false); // LIFTED

    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        play: () => setPlaying(true),
        pause: () => setPlaying(false),
        // toggleRawYoutube: ... removed
    }));

    return (
        <div className="w-full h-full bg-black rounded-xl overflow-hidden relative">
            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 text-red-500 p-4 text-center">
                    <div>
                        <p className="font-bold text-lg">Stream Error</p>
                        <p className="text-sm">{error.toString()}</p>
                    </div>
                </div>
            )}
            {showRawYoutube ? (
                <div className="w-full h-full bg-black">
                    <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${url.includes('v=') ? url.split('v=')[1] : ''}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full"
                    ></iframe>
                </div>
            ) : url.endsWith('.mp4') ? (
                <div style={{ padding: 20, background: 'red' }}>
                    <p style={{ color: 'white' }}>Raw Video Tag Test</p>
                    <video
                        src={url}
                        controls
                        autoPlay
                        style={{ width: '100%', height: '300px', background: 'black' }}
                        onPlay={() => console.log("RAW VIDEO PLAYING")}
                        onError={(e) => console.error("RAW VIDEO ERROR", e)}
                    />
                </div>
            ) : (
                <ReactPlayer
                    key={url}
                    ref={playerRef}
                    url={url}
                    width="100%"
                    height="100%"
                    playing={playing}
                    controls={true}
                    muted={true}
                    config={{
                        youtube: {
                            playerVars: {
                                origin: window.location.origin, // Reset to standard behavior first
                                modestbranding: 1,
                                rel: 0,
                                iv_load_policy: 3, // Hide annotations
                                fs: 0, // Disable fullscreen button
                                disablekb: 1 // Disable keyboard controls (optional, cleaner)
                            }
                        }
                    }}
                    onReady={() => console.log('StreamPlayer: Ready')}
                    onStart={() => console.log('StreamPlayer: Started')}
                    onProgress={(p: { playedSeconds: number }) => console.log('StreamPlayer: Progress', p.playedSeconds)}
                    onError={(e) => {
                        console.error('StreamPlayer Error:', e);
                        setError("Failed to load video. Please check URL or connection.");
                    }}
                    onPlay={() => {
                        setPlaying(true);
                        onPlay?.();
                    }}
                    onPause={() => {
                        setPlaying(false);
                        onPause?.();
                    }}
                />
            )}
        </div>
    );
});

export default React.memo(StreamPlayer);
