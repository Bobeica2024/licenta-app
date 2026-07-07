import React, { useState, useRef } from 'react';
import StreamPlayer, { StreamPlayerRef } from '../components/StreamPlayer';
import { useRecorder } from '../hooks/useRecorder';
import FileExplorer from '../components/FileExplorer';
import GoogleDrivePicker from '../components/GoogleDrivePicker';

const Dashboard = () => {
    const [url, setUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [saveDestination, setSaveDestination] = useState('local'); // 'local' | 'sqlite' | 'drive'
    const [saveFormat, setSaveFormat] = useState('mp4'); // 'mp4' | 'webm'
    const [isUploading, setIsUploading] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showDrivePicker, setShowDrivePicker] = useState(false);

    const [showRawYoutube, setShowRawYoutube] = useState(false);
    const playerWrapperRef = useRef<HTMLDivElement>(null);

    const playerRef = useRef<StreamPlayerRef>(null);

    // Get user state to conditionally show save options
    const user = localStorage.getItem('user');

    // We need to track the cropped path if it exists to save THAT one instead of the original temp.
    // Since onStop is async and independent of the render cycle for saving (user clicks button later),
    // we need to store the result of cropping.
    // Initialize from session storage
    const [croppedFilePath, setCroppedFilePath] = useState<string | null>(() => {
        return sessionStorage.getItem('dashboard_croppedFilePath');
    });

    // New state for custom title
    const [recordingTitle, setRecordingTitle] = useState('');

    // Persist croppedFilePath
    React.useEffect(() => {
        if (croppedFilePath) {
            sessionStorage.setItem('dashboard_croppedFilePath', croppedFilePath);
        } else {
            sessionStorage.removeItem('dashboard_croppedFilePath');
        }
    }, [croppedFilePath]);

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
            console.log('Înregistrare oprită. Fișier temporar la:', path);

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

                // Calculate window frame offsets (title bar and borders)
                // When desktopCapturer captures the window/screen, 0,0 is the top-left of the OS window (or screen).
                // getBoundingClientRect() is relative to the *client area* (webview).
                const diffX = window.outerWidth - window.innerWidth;
                const diffY = window.outerHeight - window.innerHeight;
                
                // Assuming symmetrical left/right borders
                const borderX = Math.max(0, diffX / 2);
                // Top offset is usually the title bar (diffY minus bottom border)
                const titleBarY = Math.max(0, diffY - borderX);

                let cropX = Math.round((rect.x + borderX) * window.devicePixelRatio) + INSET;
                let cropY = Math.round((rect.y + titleBarY) * window.devicePixelRatio) + INSET;
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

                console.log('Aplicare decupare:', crop);

                setIsUploading(true); // Show some activity while cropping
                try {
                    // @ts-ignore
                    const result = await window.api.recorder.cropVideo({ inputPath: path, crop });

                    if (result.success && result.outputPath) {
                        console.log('Decupare efectuată cu succes:', result.outputPath);
                        setCroppedFilePath(result.outputPath);
                    } else {
                        console.error('Decupare eșuată:', result.error);
                        // Optional: alert user or just fallback to original
                    }
                } catch (error) {
                    console.error('Eroare la apelarea cropVideo:', error);
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

    const handleSaveClick = async () => {
        if (saveDestination === 'sqlite') {
            setShowSaveModal(true);
        } else if (saveDestination === 'drive') {
            // Initiate Google Drive flow
            setIsUploading(true);
            try {
                const session = await window.api.drive.getSession();
                if (!session.isLoggedIn) {
                    const authResult = await window.api.drive.authenticate();
                    if (!authResult.success) {
                        alert('Autentificarea Google a eșuat sau a fost anulată.');
                        setIsUploading(false);
                        return;
                    }
                }

                // If logged in (or just logged in), show the picker
                setShowDrivePicker(true);
            } catch (err: any) {
                alert(`Eroare la conectarea Google Drive: ${err.message}`);
            } finally {
                setIsUploading(false);
            }
        } else {
            handleConfirmSave(null);
        }
    };

    const handleConfirmSave = async (folderId: string | number | null) => {
        setShowSaveModal(false);
        setShowDrivePicker(false);
        // Use cropped path if available, otherwise original
        const path = croppedFilePath || currentFilePath;
        if (!path) return;

        setIsUploading(true);
        try {
            const userObj = user ? JSON.parse(user) : null;
            // Use custom title if provided, otherwise default timestamp
            const finalTitle = recordingTitle.trim() || `Se înregistrează ${new Date().toLocaleString()}`;

            let result;

            if (saveDestination === 'drive') {
                // Perform real drive upload. Pass tokens as undefined to use session
                result = await window.api.drive.upload(path, undefined, folderId ? String(folderId) : undefined, finalTitle);
            } else {
                result = await window.api.recorder.saveFile({
                    tempPath: path,
                    destination: saveDestination,
                    userId: userObj?.id,
                    title: finalTitle,
                    sourceUrl: url,
                    folderId: folderId as (number | null),
                    format: saveFormat
                });
            }

            if (result.success) {
                if (saveDestination === 'sqlite') {
                    alert('Salvat cu succes în baza de date!');
                } else if (saveDestination === 'drive') {
                    alert('Salvat cu succes în Google Drive!');
                } else {
                    alert(`Salvat cu succes în: ${(result as any).filePath}`);
                }
                setRecordingTitle('');

            } else if (result.error !== 'Cancelled' && result.error !== 'Salvare anulată') {
                alert(`Salvare eșuată: ${result.error}`);
            }
        } catch (err: any) {
            alert(`Eroare la salvare: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDiscard = async () => {
        if (confirm("Sigur dorești să renunți la înregistrare?")) {
            await discardRecording();
            if (croppedFilePath) {
                // @ts-ignore
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
        console.log('Video pe pauză.');
        const { isRecording, isPaused } = recordingStateRef.current;
        if (isRecording && !isPaused) {
            console.log('-> Pauză automată a înregistrării.');
            pauseRecording();
        }
    }, [pauseRecording]); // pauseRecording from hook might strictly be stable? Let's hope.

    const handleVideoPlayCallback = React.useCallback(() => {
        console.log('Video în curs de redare');
    }, []);

    const handleResumeRecording = () => {
        resumeRecording();
        playerRef.current?.play();
    };

    const loadNewUrl = async (newUrl: string) => {
        if (!newUrl) {
            setUrl('');
            setShowRawYoutube(false);
            return;
        }

        let formattedUrl = newUrl.trim();
        
        // Handle file:/// URLs copied from browser
        if (formattedUrl.startsWith('file:///')) {
            formattedUrl = formattedUrl.substring(8);
            // On Windows, it's file:///C:/path -> C:/path
            // Decode URI components in case the user copied %20
            try {
                formattedUrl = decodeURIComponent(formattedUrl);
            } catch (e) {
                // Ignore if not encoded
            }
        } else {
            // Remove any surrounding quotes from drag & drop
            formattedUrl = formattedUrl.replace(/^["']|["']$/g, '');
        }

        // Detect local paths (e.g. C:\path or /path)
        if (/^[a-zA-Z]:[\\/]/.test(formattedUrl) || formattedUrl.startsWith('/')) {
            // Convert to media protocol for Electron secure loading
            formattedUrl = `media:///${formattedUrl.replace(/\\/g, '/')}`;
        }

        if (currentFilePath) {
            if (confirm("Se pare că ai o înregistrare recentă pe ecran. Dorești să o ștergi pentru a putea adăuga un videoclip nou?")) {
                await discardRecording();
                if (croppedFilePath) {
                    // @ts-ignore
                    await window.api.recorder.deleteTempFile(croppedFilePath);
                    setCroppedFilePath(null);
                }
                setUrl(formattedUrl);
            }
        } else {
            setUrl(formattedUrl);
        }
    };

    const handleConnect = () => {
        loadNewUrl(inputUrl);
    };

    const handleStartNewRecording = async () => {
        // If there is an existing recording, clean it up first (auto-discard)
        if (currentFilePath) {
            await discardRecording();
            // Also clean up cropped file if it exists
            if (croppedFilePath) {
                // @ts-ignore
                await window.api.recorder.deleteTempFile(croppedFilePath);
                setCroppedFilePath(null);
            }
        }
        await startRecording();
    };

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto relative">
            <h2 className="text-3xl font-bold mb-6">Panou de control</h2>

            {/* Debug Monitor */}
            {/* <div className="mb-4 p-2 bg-gray-800 rounded border border-gray-700 font-mono text-xs">
                <p>Status API: <span className={(window as any).api ? "text-green-500" : "text-red-500"}>{(window as any).api ? "CONECTAT" : "DECONECTAT"}</span></p>
                <p>Cale: {currentFilePath || "Niciuna"}</p>
                {croppedFilePath && <p>Cale decupată: {croppedFilePath}</p>}
            </div> */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stream Area */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                            placeholder="Introdu URL Youtube sau calea fișierului local (ex: C:\Video.mp4)."
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            disabled={isRecording}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleConnect}
                                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
                                disabled={isRecording}
                            >
                                Conectează-te
                            </button>
                            <button
                                onClick={async () => {
                                    const res = await window.api.recorder.selectVideo();
                                    if (res.success && res.filePath) {
                                        setInputUrl(res.filePath);
                                        loadNewUrl(res.filePath);
                                    }
                                }}
                                className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                                disabled={isRecording}
                            >
                                Încarcă din PC
                            </button>
                            <button
                                onClick={() => {
                                    // Dacă încearcă să încarce, dar căsuța e goală, scoatem video-ul vechi
                                    if (!showRawYoutube && !inputUrl.trim()) {
                                        setUrl('');
                                        return;
                                    }
                                    setShowRawYoutube(prev => !prev);
                                }}
                                className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition-colors"
                                disabled={isRecording}
                            >
                                {showRawYoutube ? 'Golește player-ul' : 'Afișează YouTube nativ'}
                            </button>
                        </div>
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
                                        Mod previzualizare {croppedFilePath ? '(Decupat)' : ''}
                                    </div>
                                    <video
                                        src={`media:///${(croppedFilePath || currentFilePath || '').replace(/\\/g, '/')}`}
                                        controls
                                        className="w-full h-full object-contain"
                                    />
                                    <p className="text-gray-400 text-sm mt-2">Verifică înregistrarea înainte de salvare.</p>
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
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    Niciun stream conectat
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls Area */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 flex flex-col">
                    <h3 className="text-xl font-semibold mb-6">Controale</h3>

                    <div className="space-y-4">
                        {/* 1. START RECORDING (Visible if NOT recording) */}
                        {!isRecording && (
                            <button
                                onClick={handleStartNewRecording}
                                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 ${!url ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                                disabled={!url || isUploading}
                            >
                                <div className={`w-4 h-4 rounded-full ${!url ? 'bg-gray-500' : 'bg-white animate-pulse'}`} />
                                {currentFilePath ? "Începe înregistrare nouă" : "Începe înregistrarea"}
                            </button>
                        )}

                        {/* 2. RECORDING state */}
                        {isRecording && (
                            <div className="space-y-4">
                                <div className="bg-red-900/30 border border-red-900 rounded-lg p-4 text-center animate-pulse">
                                    <span className="text-red-400 font-mono text-xl">{recordingTime}</span>
                                    <p className="text-xs text-red-500 uppercase mt-1">Status: {isPaused ? 'PAUZĂ' : 'LIVE'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {isPaused ? (
                                        <button onClick={handleResumeRecording} className="py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors">
                                            Reia înregistrarea
                                        </button>
                                    ) : (
                                        <button onClick={pauseRecording} className="py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors">
                                            Pauză înregistrare
                                        </button>
                                    )}
                                    <button onClick={stopRecording} className="py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                                        Stop înregistrare
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 3. PREVIEW / SAVE state */}
                        {!isRecording && currentFilePath && (
                            <div className="space-y-4 animate-fade-in">
                                <label className="text-sm text-gray-400 block mb-2">Înregistrare finalizată</label>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDiscard}
                                        className="flex-1 py-3 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                        title="Șterge înregistrarea curentă"
                                    >
                                        🗑️ Șterge Preview
                                    </button>

                                    <button
                                        onClick={handleSaveClick}
                                        className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? 'Se salvează...' : 'Salvează'}
                                    </button>
                                </div>

                                <hr className="border-gray-800 my-4" />

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Destinație salvare</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none"
                                        value={saveDestination}
                                        onChange={(e) => setSaveDestination(e.target.value)}
                                        disabled={isUploading}
                                    >
                                        <option value="local">Computer Local</option>
                                        {user && <option value="sqlite">Bază de date (Local)</option>}
                                        <option value="drive">Google Drive</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Format video</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none"
                                        value={saveFormat}
                                        onChange={(e) => setSaveFormat(e.target.value)}
                                        disabled={isUploading || saveDestination === 'drive'}
                                    >
                                        <option value="mp4">MP4 (Compatibilitate maximă)</option>
                                        <option value="webm">WebM (Format brut browser)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Placeholder for when no action is active, just to keep layout consistent if needed */}
                        {!isRecording && !currentFilePath && (
                            <div className="space-y-2 opacity-50">
                                <label className="text-sm text-gray-400">Destinație salvare (Inactiv)</label>
                                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2" disabled>
                                    <option>Computer local</option>
                                </select>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Folder Selection Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-900 w-[800px] h-[600px] rounded-xl flex flex-col border border-gray-700 shadow-2xl">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800">
                            <h3 className="font-bold text-xl text-white">Salvare în bază de date</h3>
                            <button
                                onClick={() => {
                                    setShowSaveModal(false);
                                    setRecordingTitle(''); // Clear title when modal is closed
                                }}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 bg-gray-800 border-b border-gray-700">
                            <label className="block text-sm text-gray-400 mb-1">Titlu înregistrare</label>
                            <input
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Introdu titlul aici..."
                                value={recordingTitle}
                                onChange={(e) => setRecordingTitle(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-hidden p-2">
                            <p className="text-sm text-gray-400 px-2 py-1">Selectează folderul destinație:</p>
                            <FileExplorer
                                mode="select"
                                onSelect={(folderId) => handleConfirmSave(folderId)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Google Drive Picker Modal */}
            {showDrivePicker && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-900 w-[800px] h-[600px] rounded-xl flex flex-col border border-gray-700 shadow-2xl">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800 rounded-t-xl">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2">
                                <span className="text-blue-500">☁️</span> Salvare în Google Drive
                            </h3>
                            <button
                                onClick={() => setShowDrivePicker(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 bg-gray-800 border-b border-gray-700">
                            <label className="block text-sm text-gray-400 mb-1">Titlu înregistrare</label>
                            <input
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Alegeți un titlu..."
                                value={recordingTitle}
                                onChange={(e) => setRecordingTitle(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-hidden p-4">
                            <GoogleDrivePicker
                                onSelect={(folderId) => handleConfirmSave(folderId)}
                                onCancel={() => setShowDrivePicker(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
