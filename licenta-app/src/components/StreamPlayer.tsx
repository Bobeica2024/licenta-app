import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import ReactPlayer from 'react-player';

interface StreamPlayerProps {
    url: string;
    onPlay?: () => void;
    onPause?: () => void;
}

export interface StreamPlayerRef {
    play: () => void;
    pause: () => void;
}

const StreamPlayer = forwardRef<StreamPlayerRef, StreamPlayerProps>(({ url, onPlay, onPause }, ref) => {
    const [playing, setPlaying] = useState(true);
    // Use any to bypass strict type checking for the library ref if needed
    const playerRef = useRef<any>(null);

    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        play: () => setPlaying(true),
        pause: () => setPlaying(false),
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
            {url.endsWith('.mp4') ? (
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
                    key={url} // Force remount when URL changes
                    ref={playerRef}
                    url={url}
                    width="100%"
                    height="100%"
                    playing={playing}
                    controls={true}
                    muted={true} // Mute by default to allow autoplay
                    config={{
                        youtube: {
                            playerVars: {
                                origin: window.location.origin,
                                modestbranding: 1,
                                rel: 0
                            }
                        }
                    }}
                />
            )}
        </div>
    );
});

export default StreamPlayer;
