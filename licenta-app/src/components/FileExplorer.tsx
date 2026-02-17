import React, { useState, useEffect } from 'react';

interface FileSystemItem {
    id: number;
    name: string;
    type: 'folder' | 'file';
    parentId: number | null;
    createdAt?: string;
    filePath?: string; // For files
    duration?: string; // Optional metadata
}

interface FileExplorerProps {
    mode: 'view' | 'select'; // 'view' for Library, 'select' for Saving
    onSelect?: (folderId: number | null) => void; // For saving, returns selected folder ID
    onPlay?: (file: FileSystemItem) => void; // For playing a file
}

const FileExplorer: React.FC<FileExplorerProps> = ({ mode, onSelect, onPlay }) => {
    const [currentPath, setCurrentPath] = useState<FileSystemItem[]>([]); // Breadcrumbs
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [items, setItems] = useState<FileSystemItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    useEffect(() => {
        loadItems(currentFolderId);
    }, [currentFolderId]);

    const loadItems = async (folderId: number | null) => {
        setLoading(true);
        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;

            // @ts-ignore
            const result = await window.api.library.getContents({ folderId, userId: user.id });
            setItems(result);
        } catch (error) {
            console.error("Failed to load items", error);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folder: FileSystemItem) => {
        setCurrentPath([...currentPath, folder]);
        setCurrentFolderId(folder.id);
    };

    const handleNavigateUp = () => {
        if (currentPath.length === 0) return;
        const newPath = [...currentPath];
        newPath.pop();
        setCurrentPath(newPath);
        setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
    };

    const handleNavigateBreadcrumb = (index: number) => {
        if (index === -1) {
            setCurrentPath([]);
            setCurrentFolderId(null);
        } else {
            const newPath = currentPath.slice(0, index + 1);
            setCurrentPath(newPath);
            setCurrentFolderId(newPath[newPath.length - 1].id);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;

            // @ts-ignore
            await window.api.library.createFolder({ name: newFolderName, parentId: currentFolderId, userId: user.id });
            setNewFolderName('');
            setIsCreatingFolder(false);
            loadItems(currentFolderId);
        } catch (error) {
            console.error("Failed to create folder", error);
        }
    };

    const handleDelete = async (e: React.MouseEvent, item: FileSystemItem) => {
        e.stopPropagation();
        if (!confirm(`Sigur vrei să ștergi "${item.name}"?`)) return;
        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;

            // @ts-ignore
            await window.api.library.deleteItem({ id: item.id, type: item.type, userId: user.id });
            loadItems(currentFolderId);
        } catch (error) {
            console.error("Failed to delete item", error);
        }
    }

    return (
        <div className="flex flex-col h-full text-white">
            {/* Header / Breadcrumbs */}
            <div className="flex items-center gap-2 p-4 bg-gray-900 border-b border-gray-800">
                <button
                    onClick={() => handleNavigateBreadcrumb(-1)}
                    className="hover:text-blue-400 font-bold"
                >
                    Home
                </button>
                {currentPath.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                        <span className="text-gray-600">/</span>
                        <button
                            onClick={() => handleNavigateBreadcrumb(index)}
                            className="hover:text-blue-400"
                        >
                            {folder.name}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-gray-950/50">
                <div className="flex gap-2">
                    <button
                        onClick={handleNavigateUp}
                        disabled={currentPath.length === 0}
                        className="p-2 hover:bg-gray-800 rounded disabled:opacity-30"
                        title="Go Up"
                    >
                        ⬆️ Sus
                    </button>
                    <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="p-2 hover:bg-gray-800 rounded text-green-400"
                        title="New Folder"
                    >
                        📁 Folder Nou
                    </button>
                </div>

                {mode === 'select' && (
                    <button
                        onClick={() => onSelect && onSelect(currentFolderId)}
                        className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                    >
                        Salvează Aici
                    </button>
                )}
            </div>

            {/* New Folder Input */}
            {isCreatingFolder && (
                <div className="p-4 flex gap-2 items-center bg-gray-900">
                    <span className="text-2xl">📁</span>
                    <input
                        autoFocus
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Nume folder..."
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder();
                            if (e.key === 'Escape') setIsCreatingFolder(false);
                        }}
                    />
                    <button onClick={handleCreateFolder} className="text-green-500 hover:text-green-400">✓</button>
                    <button onClick={() => setIsCreatingFolder(false)} className="text-red-500 hover:text-red-400">✕</button>
                </div>
            )}

            {/* Content Grid */}
            <div className="flex-1 overflow-auto p-4">
                {loading ? (
                    <div className="text-center text-gray-500 mt-10">Se încarcă...</div>
                ) : items.length === 0 ? (
                    <div className="text-center text-gray-600 mt-10">Folder gol</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {/* Folders */}
                        {items.filter(i => i.type === 'folder').map(folder => (
                            <div
                                key={`folder-${folder.id}`}
                                onDoubleClick={() => handleNavigate(folder)}
                                className="group relative flex flex-col items-center p-4 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-gray-700"
                            >
                                <div className="text-5xl mb-2 text-yellow-500">📁</div>
                                <div className="text-sm text-center truncate w-full group-hover:text-blue-400">
                                    {folder.name}
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, folder)}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 rounded text-red-500"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}

                        {/* Files */}
                        {items.filter(i => i.type === 'file').map(file => (
                            <div
                                key={`file-${file.id}`}
                                onDoubleClick={() => onPlay && onPlay(file)}
                                className="group relative flex flex-col items-center p-4 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-gray-700"
                            >
                                <div className="text-5xl mb-2 text-blue-400">🎥</div>
                                <div className="text-sm text-center truncate w-full group-hover:text-blue-400">
                                    {file.name}
                                </div>
                                {/* <div className="text-xs text-gray-500">{file.createdAt}</div> */}
                                <button
                                    onClick={(e) => handleDelete(e, file)}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 rounded text-red-500"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileExplorer;
