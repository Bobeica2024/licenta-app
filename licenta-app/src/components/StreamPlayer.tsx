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
    const [playing, setPlaying] = useState(false);
    // Use any to bypass strict type checking for the library ref if needed
    const playerRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        play: () => setPlaying(true),
        pause: () => setPlaying(false),
    }));

    return (
        <div className="w-full h-full bg-black rounded-xl overflow-hidden relative">
            <ReactPlayer
                ref={playerRef}
                url={url}
                width="100%"
                height="100%"
                playing={playing}
                controls={true}
                onPlay={() => {
                    setPlaying(true);
                    onPlay?.();
                }}
                onPause={() => {
                    setPlaying(false);
                    onPause?.();
                }}
            />
        </div>
    );
});

export default StreamPlayer;
