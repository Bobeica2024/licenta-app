declare module 'react-player' {
    import { Component } from 'react';
    export interface ReactPlayerProps {
        url?: string | string[] | MediaStream | undefined;
        playing?: boolean | undefined;
        loop?: boolean | undefined;
        controls?: boolean | undefined;
        volume?: number | undefined;
        muted?: boolean | undefined;
        playbackRate?: number | undefined;
        width?: string | number | undefined;
        height?: string | number | undefined;
        style?: object | undefined;
        progressInterval?: number | undefined;
        playsinline?: boolean | undefined;
        onReady?: ((player: ReactPlayer) => void) | undefined;
        onStart?: (() => void) | undefined;
        onPlay?: (() => void) | undefined;
        onPause?: (() => void) | undefined;
        onBuffer?: (() => void) | undefined;
        onBufferEnd?: (() => void) | undefined;
        onEnded?: (() => void) | undefined;
        onError?: ((error: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => void) | undefined;
        [key: string]: any;
    }
    export default class ReactPlayer extends Component<ReactPlayerProps, any> {
        seekTo(amount: number, type?: 'seconds' | 'fraction'): void;
        getCurrentTime(): number;
        getDuration(): number;
        getInternalPlayer(key?: string): any;
    }
}
