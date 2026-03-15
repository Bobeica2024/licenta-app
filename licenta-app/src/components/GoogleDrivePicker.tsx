import React, { useState, useEffect } from 'react';

interface DriveFolder {
    id: string;
    name: string;
}

interface GoogleDrivePickerProps {
    onSelect: (folderId: string | null) => void;
    onCancel: () => void;
}

const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({ onSelect, onCancel }) => {
    const [currentPath, setCurrentPath] = useState<{ id: string, name: string }[]>([{ id: 'root', name: 'My Drive' }]);
    const [folders, setFolders] = useState<DriveFolder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentFolderId = currentPath[currentPath.length - 1].id;

    useEffect(() => {
        loadFolders(currentFolderId);
    }, [currentFolderId]);

    const loadFolders = async (parentId: string) => {
        setLoading(true);
        setError(null);
        try {
            const apiParentId = parentId === 'root' ? undefined : parentId;
            const result = await window.api.drive.listFolders(apiParentId);

            if (result.success && result.folders) {
                setFolders(result.folders);
            } else {
                setError(result.error || 'Eroare la încărcarea folderelor');
            }
        } catch (err: any) {
            setError(err.message || 'Eroare la comunicarea cu serverul');
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folder: DriveFolder) => {
        setCurrentPath([...currentPath, folder]);
    };

    const handleNavigateBreadcrumb = (index: number) => {
        setCurrentPath(currentPath.slice(0, index + 1));
    };

    const handleNavigateUp = () => {
        if (currentPath.length > 1) {
            const newPath = [...currentPath];
            newPath.pop();
            setCurrentPath(newPath);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden text-white relative">
            {/* Header / Breadcrumbs */}
            <div className="flex items-center gap-2 p-3 bg-gray-800 border-b border-gray-700 overflow-x-auto whitespace-nowrap scrollbar-hide">
                {currentPath.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                        {index > 0 && <span className="text-gray-500">/</span>}
                        <button
                            onClick={() => handleNavigateBreadcrumb(index)}
                            className="hover:text-blue-400 font-medium transition-colors"
                        >
                            {folder.name}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-gray-950/50 border-b border-gray-800">
                <button
                    onClick={handleNavigateUp}
                    disabled={currentPath.length <= 1}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors text-gray-300 hover:text-white text-sm"
                    title="Înapoi"
                >
                    ⬅️ Înapoi
                </button>
                <div className="text-xs text-gray-500">
                    Alege destinația de salvare
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4 bg-gray-900 min-h-[250px] relative">
                {error && (
                    <div className="m-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
                        {error}
                        <button onClick={() => loadFolders(currentFolderId)} className="ml-2 underline hover:text-white">Reîncearcă</button>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Se încarcă folderele...</span>
                    </div>
                ) : folders.length === 0 && !error ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                        <span className="text-4xl text-gray-700">📁</span>
                        <span>Acest folder este gol.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {folders.map(folder => (
                            <div
                                key={folder.id}
                                onDoubleClick={() => handleNavigate(folder)}
                                className="group flex items-center p-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-blue-500/50"
                            >
                                <div className="text-2xl mr-3 text-blue-400">📁</div>
                                <div className="text-sm truncate w-full select-none" title={folder.name}>
                                    {folder.name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3 rounded-b-lg">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
                >
                    Anulare
                </button>
                <button
                    onClick={() => onSelect(currentFolderId === 'root' ? null : currentFolderId)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold transition-colors shadow-lg shadow-blue-900/50 flex items-center gap-2"
                >
                    💾 Salvare în {currentPath[currentPath.length - 1].name}
                </button>
            </div>
        </div>
    );
};

export default GoogleDrivePicker;
