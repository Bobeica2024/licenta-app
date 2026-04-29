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
    const rawVideoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        play: () => {
            setPlaying(true);
            rawVideoRef.current?.play().catch(e => console.error(e));
        },
        pause: () => {
            setPlaying(false);
            rawVideoRef.current?.pause();
        },
    }));

    const isLocalVideo = url.startsWith('media://') || url.match(/\.(mp4|webm|mkv|ogg|mov)$/i);

    return (
        <div className="w-full h-full bg-black rounded-xl overflow-hidden relative">
            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 text-red-500 p-4 text-center">
                    <div>
                        <p className="font-bold text-lg">Eroare Stream</p>
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
            ) : isLocalVideo ? (
                <div className="w-full h-full bg-black flex items-center justify-center">
                    <video
                        ref={rawVideoRef}
                        src={url}
                        controls
                        autoPlay
                        className="w-full h-full object-contain"
                        onPlay={() => {
                            setPlaying(true);
                            onPlay?.();
                        }}
                        onPause={() => {
                            setPlaying(false);
                            onPause?.();
                        }}
                        onError={(e) => {
                            console.error("RAW VIDEO ERROR", e);
                            setError("Fișierul video local nu a putut fi redat.");
                        }}
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
                        setError("Nu s-a putut încărca videoclipul. Verifică URL-ul sau conexiunea.");
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
