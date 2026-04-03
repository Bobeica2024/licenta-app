import { useState, useEffect } from 'react';
import FileExplorer from '../components/FileExplorer';

const Library = () => {
    const [playingFile, setPlayingFile] = useState<{ name: string, filePath: string } | null>(null);

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const isAdmin = !!currentUser?.isAdmin;

    // Admin: list of all users to browse
    const [allUsers, setAllUsers] = useState<{ id: number; username: string; is_admin: number }[]>([]);
    // Admin: which user's DB to browse (null = own)
    const [viewingUserId, setViewingUserId] = useState<number | null>(null);

    useEffect(() => {
        if (isAdmin) {
            window.api.admin.getUsers({ isAdmin: true }).then((res) => {
                if (res.success && res.users) setAllUsers(res.users);
            });
        }
    }, [isAdmin]);

    // Reset folder navigation when admin switches user
    const handleUserChange = (userId: number | null) => {
        // Clear fileExplorer session so it resets to root for the new user
        sessionStorage.removeItem('fileExplorer_currentPath');
        sessionStorage.removeItem('fileExplorer_currentFolderId');
        setViewingUserId(userId);
    };

    const handlePlay = async (file: any) => {
        setPlayingFile(file);

        // Add to history (always log as current admin)
        try {
            if (currentUser) {
                await window.api.history.add({
                    userId: currentUser.id,
                    actionType: 'VIEW_VIDEO',
                    itemName: file.name
                });
            }
        } catch (e) {
            console.error('Failed to log history:', e);
        }
    };

    const viewingUser = viewingUserId
        ? allUsers.find(u => u.id === viewingUserId)
        : null;

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto relative h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h2 className="text-3xl font-bold">
                    Bază de date
                    {viewingUser && (
                        <span className="ml-3 text-base font-normal text-blue-400">
                            — vizualizând contul: <span className="font-semibold">{viewingUser.username}</span>
                        </span>
                    )}
                </h2>

                {/* Admin: user selector */}
                {isAdmin && allUsers.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Vizualizează baza de date a:</span>
                        <select
                            value={viewingUserId ?? ''}
                            onChange={(e) => handleUserChange(e.target.value ? Number(e.target.value) : null)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                        >
                            <option value="">Contul meu</option>
                            {allUsers
                                .filter(u => u.id !== currentUser?.id)
                                .map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.username} {u.is_admin ? '(Admin)' : ''}
                                    </option>
                                ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <FileExplorer
                    key={viewingUserId ?? 'self'}
                    mode="view"
                    onPlay={handlePlay}
                    overrideUserId={viewingUserId ?? undefined}
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
                                src={`media:///${(playingFile.filePath || '').replace(/\\/g, '/')}`}
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
