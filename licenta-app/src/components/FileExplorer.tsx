import React, { useState, useEffect, useRef } from 'react';

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
    overrideUserId?: number; // Admin override to browse another user's DB
}

const FileExplorer: React.FC<FileExplorerProps> = ({ mode, onSelect, onPlay, overrideUserId }) => {
    const [currentPath, setCurrentPath] = useState<FileSystemItem[]>(() => {
        if (mode === 'view') {
            const saved = sessionStorage.getItem('fileExplorer_currentPath');
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { }
            }
        }
        return [];
    }); // Breadcrumbs
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(() => {
        if (mode === 'view') {
            const saved = sessionStorage.getItem('fileExplorer_currentFolderId');
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { }
            }
        }
        return null;
    });
    const [items, setItems] = useState<FileSystemItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: FileSystemItem } | null>(null);
    const [editingItem, setEditingItem] = useState<{ id: number, type: 'folder' | 'file' } | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [clipboard, setClipboard] = useState<{ action: 'cut' | 'copy', items: FileSystemItem[] } | null>(null);
    const [detailsItem, setDetailsItem] = useState<FileSystemItem | null>(null);
    const [selectedItems, setSelectedItems] = useState<{ id: number, type: 'folder' | 'file' }[]>([]);
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const dragSelectionRef = useRef(false);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailData, setEmailData] = useState({ to: '', subject: '', text: '' });

    // Archive Modal State
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [archiveData, setArchiveData] = useState({ name: '', destination: 'db' as 'local' | 'db' | 'drive' });

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const handleMouseUp = () => setIsDragSelecting(false);
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    useEffect(() => {
        if (mode === 'view') {
            sessionStorage.setItem('fileExplorer_currentPath', JSON.stringify(currentPath));
            sessionStorage.setItem('fileExplorer_currentFolderId', JSON.stringify(currentFolderId));
        }
        setSelectedItems([]); // Clear selection on navigate
    }, [currentPath, currentFolderId, mode]);

    useEffect(() => {
        loadItems(currentFolderId);
    }, [currentFolderId]);

    const loadItems = async (folderId: number | null) => {
        setLoading(true);
        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;
            const effectiveUserId = overrideUserId ?? user.id;

            // @ts-ignore
            const result = await window.api.library.getContents({ folderId, userId: effectiveUserId });
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
            const effectiveUserId = overrideUserId ?? user.id;

            // @ts-ignore
            await window.api.library.createFolder({ name: newFolderName, parentId: currentFolderId, userId: effectiveUserId });
            setNewFolderName('');
            setIsCreatingFolder(false);

            // Add to history (always as the logged-in user)
            try {
                await window.api.history.add({
                    userId: user.id,
                    actionType: 'CREATE_FOLDER',
                    itemName: newFolderName
                });
            } catch (e) { }

            loadItems(currentFolderId);
        } catch (error) {
            console.error("Crearea folderului a eșuat!", error);
        }
    };

    const handleItemClick = (e: React.MouseEvent, item: FileSystemItem) => {
        if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            if (selectedItems.some(i => i.id === item.id && i.type === item.type)) {
                setSelectedItems(selectedItems.filter(i => !(i.id === item.id && i.type === item.type)));
            } else {
                setSelectedItems([...selectedItems, { id: item.id, type: item.type }]);
            }
        } else {
            // Single selection
            setSelectedItems([{ id: item.id, type: item.type }]);
        }
    };



    const handleDragEnter = (e: React.MouseEvent, item: FileSystemItem) => {
        if (isDragSelecting) {
            dragSelectionRef.current = true;
            if (e.ctrlKey) {
                setSelectedItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
            } else {
                setSelectedItems(prev => {
                    if (!prev.some(i => i.id === item.id && i.type === item.type)) {
                        return [...prev, { id: item.id, type: item.type }];
                    }
                    return prev;
                });
            }
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: FileSystemItem | null) => {
        e.preventDefault();
        e.stopPropagation();

        if (item) {
            // If right-clicked item is not in selection, select it alone
            if (!selectedItems.some(i => i.id === item.id && i.type === item.type)) {
                setSelectedItems([{ id: item.id, type: item.type }]);
            }
        }

        setContextMenu({ x: e.pageX, y: e.pageY, item: item as any }); // item can be null for background
    };

    const startRenaming = (item: FileSystemItem) => {
        setEditingItem({ id: item.id, type: item.type });
        setRenameValue(item.name);
        setContextMenu(null);
    };

    const submitRename = async () => {
        if (!editingItem || !renameValue.trim()) {
            setEditingItem(null);
            return;
        }

        const currentItem = items.find(i => i.id === editingItem.id && i.type === editingItem.type);
        if (currentItem && currentItem.name === renameValue.trim()) {
            setEditingItem(null);
            return;
        }

        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;
            const effectiveUserId = overrideUserId ?? user.id;

            // @ts-ignore
            await window.api.library.renameItem({
                id: editingItem.id,
                type: editingItem.type,
                newName: renameValue,
                userId: effectiveUserId
            });
            // Add to history
            try {
                await window.api.history.add({
                    userId: user.id,
                    actionType: 'RENAME',
                    itemName: `${currentItem?.name} -> ${renameValue}`
                });
            } catch (e) { }

            setEditingItem(null);
            loadItems(currentFolderId);
        } catch (error) {
            console.error("Redenumirea elementului a eșuat!", error);
        }
    };

    const handleDetails = () => {
        if (contextMenu && contextMenu.item) {
            setDetailsItem(contextMenu.item);
            setContextMenu(null);
        }
    };

    const handleDelete = async (itemsToDelete: FileSystemItem[]) => {
        if (itemsToDelete.length === 0) return;

        let confirmMessage = "";
        if (itemsToDelete.length === 1) {
            const item = itemsToDelete[0];
            confirmMessage = item.type === 'folder'
                ? `Sigur dorești să ștergi folderul "${item.name}"? Acest lucru va duce la ștergerea permanentă a tuturor elementelor sale, adică subfoldere și înregistrări.`
                : `Sigur dorești să ștergi înregistrarea "${item.name}"?`;
        } else {
            confirmMessage = `Sigur dorești să ștergi aceste ${itemsToDelete.length} înregistrări?`;
        }

        if (!confirm(confirmMessage)) return;

        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;
            const effectiveUserId = overrideUserId ?? user.id;

            for (const item of itemsToDelete) {
                // @ts-ignore
                await window.api.library.deleteItem({ id: item.id, type: item.type, userId: effectiveUserId });

                // Add to history
                try {
                    await window.api.history.add({
                        userId: user.id,
                        actionType: 'DELETE_ITEM',
                        itemName: item.name
                    });
                } catch (e) { }
            }

            setSelectedItems([]);
            loadItems(currentFolderId);
        } catch (error) {
            console.error("Ștergerea elementelor a eșuat!", error);
        }
    }

    const handleDeleteFromMenu = (item: FileSystemItem) => {
        // If the right-clicked item is part of a multiple selection, delete all selected items.
        // Otherwise, just delete the passed item.
        const targetItems = selectedItems.some(i => i.id === item.id && i.type === item.type)
            ? selectedItems.map(si => items.find(i => i.id === si.id && i.type === si.type)).filter(Boolean) as FileSystemItem[]
            : [item];

        handleDelete(targetItems);
        setContextMenu(null);
    };

    // --- Drag & Drop ---
    const handleDragStart = (e: React.DragEvent, item: FileSystemItem) => {
        const targetItems = selectedItems.some(i => i.id === item.id && i.type === item.type)
            ? selectedItems.map(si => items.find(i => i.id === si.id && i.type === si.type)).filter(Boolean) as FileSystemItem[]
            : [item];
        e.dataTransfer.setData('application/json', JSON.stringify(targetItems));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, item: FileSystemItem) => {
        if (item.type === 'folder') {
            e.preventDefault(); // Allow drop
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleDrop = async (e: React.DragEvent, targetFolder: FileSystemItem) => {
        e.preventDefault();
        try {
            const data = e.dataTransfer.getData('application/json');
            if (!data) return;

            let droppedItems: FileSystemItem[] = [];
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) droppedItems = parsed;
                else droppedItems = [parsed];
            } catch (e) { return; }

            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;
            const effectiveUserId = overrideUserId ?? user.id;

            for (const item of droppedItems) {
                if (item.id === targetFolder.id && item.type === 'folder') continue; // Cannot drop on self

                // @ts-ignore
                await window.api.library.moveItem({
                    id: item.id,
                    type: item.type,
                    targetFolderId: targetFolder.id,
                    userId: effectiveUserId
                });

                // Add to history
                try {
                    await window.api.history.add({
                        userId: user.id,
                        actionType: 'MOVE',
                        itemName: item.name
                    });
                } catch (e) { }
            }

            setSelectedItems([]);
            loadItems(currentFolderId);
        } catch (err) {
            console.error("Drop failed", err);
        }
    };

    // --- Clipboard ---
    const handleCut = (item: FileSystemItem) => {
        const targetItems = selectedItems.some(i => i.id === item.id && i.type === item.type)
            ? selectedItems.map(si => items.find(i => i.id === si.id && i.type === si.type)).filter(Boolean) as FileSystemItem[]
            : [item];
        setClipboard({ action: 'cut', items: targetItems });
        setContextMenu(null);
    };

    const handleCopy = (item: FileSystemItem) => {
        const targetItems = selectedItems.some(i => i.id === item.id && i.type === item.type)
            ? selectedItems.map(si => items.find(i => i.id === si.id && i.type === si.type)).filter(Boolean) as FileSystemItem[]
            : [item];
        setClipboard({ action: 'copy', items: targetItems });
        setContextMenu(null);
    };

    const handlePaste = async () => {
        if (!clipboard) return;
        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;
            const effectiveUserId = overrideUserId ?? user.id;

            for (const item of clipboard.items) {
                if (clipboard.action === 'cut') {
                    // @ts-ignore
                    await window.api.library.moveItem({
                        id: item.id,
                        type: item.type,
                        targetFolderId: currentFolderId,
                        userId: effectiveUserId
                    });

                    // Add to history
                    try {
                        await window.api.history.add({
                            userId: user.id,
                            actionType: 'MOVE',
                            itemName: item.name
                        });
                    } catch (e) { }
                } else {
                    // @ts-ignore
                    await window.api.library.copyItem({
                        id: item.id,
                        type: item.type,
                        targetFolderId: currentFolderId,
                        userId: effectiveUserId
                    });
                    // Add to history
                    try {
                        await window.api.history.add({
                            userId: user.id,
                            actionType: 'COPY',
                            itemName: item.name
                        });
                    } catch (e) { }
                }
            }

            if (clipboard.action === 'cut') {
                setClipboard(null); // Clear after cut->paste
            }
            loadItems(currentFolderId);
            setContextMenu(null);
        } catch (err) {
            console.error("Paste failed", err);
        }
    };

    // --- Archive ---
    const handleOpenArchiveModal = () => {
        if (selectedItems.length === 0) return;
        setContextMenu(null);
        setArchiveData({ name: '', destination: 'db' });
        setShowArchiveModal(true);
    };

    const handleConfirmArchive = async () => {
        if (!archiveData.name.trim()) {
            alert("Numele arhivei este obligatoriu.");
            return;
        }

        if (archiveData.destination === 'drive') {
            const session = await window.api.drive.getSession();
            if (!session.isLoggedIn) {
                const authResult = await window.api.drive.authenticate();
                if (!authResult.success) {
                    alert("Autentificarea cu Google a eșuat. Nu se poate salva în Drive.");
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user) return;
            const effectiveUserId = overrideUserId ?? user.id;

            const result = await window.api.archive.create({
                items: selectedItems as any,
                targetFolderId: currentFolderId,
                archiveName: archiveData.name,
                userId: effectiveUserId,
                destination: archiveData.destination
            });

            if (result.success) {
                if (result.destination === 'drive' && result.filePath) {
                    // Upload to drive
                    const uploadResult = await window.api.drive.upload(
                        result.filePath,
                        undefined,
                        undefined,
                        result.fileName
                    );
                    if (!uploadResult.success) {
                        alert("Eroare la încărcarea în Google Drive: " + uploadResult.error);
                    } else {
                        alert("Arhiva a fost încărcată cu succes în Google Drive!");
                    }
                }

                // Add to history (always as logged-in user)
                try {
                    await window.api.history.add({
                        userId: user.id,
                        actionType: 'ARCHIVE',
                        itemName: archiveData.name + '.zip'
                    });
                } catch (e) { }

                setShowArchiveModal(false);
                setSelectedItems([]);
                if (archiveData.destination === 'db') {
                    loadItems(currentFolderId);
                }
            } else if (result.error !== 'Salvare anulată') {
                alert("Eroare la creare arhivă: " + (result.error || 'Necunoscut'));
            } else {
                setShowArchiveModal(false); // User just canceled save dialog
            }
        } catch (err: any) {
            alert('Arhivare eșuată: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Send Email ---
    const handleOpenEmailModal = async () => {
        if (selectedItems.length !== 1 || selectedItems[0].type !== 'file') return;
        setContextMenu(null);

        // Check auth status first
        const session = await window.api.drive.getSession();
        if (!session.isLoggedIn) {
            const authResult = await window.api.drive.authenticate();
            if (!authResult.success) {
                alert("Autentificarea cu Google a eșuat sau a fost anulată.");
                return;
            }
        }
        setShowEmailModal(true);
    };

    const handleSendEmail = async () => {
        if (selectedItems.length !== 1 || selectedItems[0].type !== 'file') return;

        if (!emailData.to.trim()) {
            alert("Destinatarul este obligatoriu.");
            return;
        }

        setLoading(true);
        try {
            const selectedFile = items.find(i => i.id === selectedItems[0].id && i.type === 'file');
            if (selectedFile) {
                const filePath = (selectedFile as any).filePath as string;
                // Extract extension from the actual file path (e.g. .webm, .zip)
                const ext = filePath ? filePath.substring(filePath.lastIndexOf('.')) : '';
                // Append extension if the display name doesn't already have it
                const fileNameWithExt = selectedFile.name.endsWith(ext)
                    ? selectedFile.name
                    : selectedFile.name + ext;

                // @ts-ignore
                const result = await window.api.drive.sendEmail({
                    to: emailData.to,
                    subject: emailData.subject,
                    text: emailData.text,
                    filePath: filePath,
                    fileName: fileNameWithExt
                });

                if (result.success) {
                    alert("Email trimis cu succes!");
                    setShowEmailModal(false);
                    setEmailData({ to: '', subject: '', text: '' });

                    // Add to history
                    const userStr = localStorage.getItem('user');
                    const user = userStr ? JSON.parse(userStr) : null;
                    if (user) {
                        try {
                            await window.api.history.add({
                                userId: user.id,
                                actionType: 'EMAIL',
                                itemName: `Sent ${selectedFile.name} to ${emailData.to}`
                            });
                        } catch (e) { }
                    }
                } else {
                    alert("Eroare la trimitere email: " + result.error);
                }
            }
        } catch (err: any) {
            alert('Trimitere eșuată: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full text-white relative">
            {/* ... Header & Toolbar ... */}

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
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors text-gray-300 hover:text-white"
                        title="Înapoi"
                    >
                        ⬅️ Înapoi
                    </button>
                    <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="p-2 hover:bg-gray-800 rounded text-green-400"
                        title="New Folder"
                    >
                        📁 Folder nou
                    </button>
                </div>

                {mode === 'select' && (
                    <button
                        onClick={() => onSelect && onSelect(currentFolderId)}
                        className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                    >
                        Salvează aici
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
            <div
                className="flex-1 overflow-auto p-4 select-none"
                onClick={() => {
                    if (!dragSelectionRef.current) {
                        setContextMenu(null);
                        setSelectedItems([]);
                    }
                    dragSelectionRef.current = false;
                }}
                onContextMenu={(e) => handleContextMenu(e, null)} // Background context menu
                onMouseDown={(e) => {
                    if (!(e.target as HTMLElement).closest('.fe-item')) {
                        setIsDragSelecting(true);
                        dragSelectionRef.current = false;
                    }
                }}
            >
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
                                draggable
                                onDragStart={(e) => handleDragStart(e, folder)}
                                onDragOver={(e) => handleDragOver(e, folder)}
                                onDrop={(e) => handleDrop(e, folder)}
                                onMouseEnter={(e) => handleDragEnter(e, folder)}
                                onClick={(e) => { e.stopPropagation(); handleItemClick(e, folder); setContextMenu(null); }}
                                onDoubleClick={() => handleNavigate(folder)}
                                onContextMenu={(e) => handleContextMenu(e, folder)}
                                className={`fe-item group relative flex flex-col items-center p-4 rounded-lg cursor-pointer transition-colors border ${selectedItems.some(i => i.id === folder.id && i.type === 'folder') ? 'bg-blue-900/40 border-blue-500' : 'border-transparent hover:bg-gray-800 hover:border-gray-700'} ${clipboard?.items.some(i => i.id === folder.id && i.type === 'folder') && clipboard?.action === 'cut' ? 'opacity-50' : ''}`}
                            >

                                <div className="text-5xl mb-2 text-yellow-500">📁</div>

                                {editingItem?.id === folder.id && editingItem?.type === 'folder' ? (
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={submitRename}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') submitRename();
                                            if (e.key === 'Escape') setEditingItem(null);
                                        }}
                                        autoFocus
                                        className="w-full bg-gray-700 text-center text-sm rounded px-1 outline-none border border-blue-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div
                                        className="text-sm text-center truncate w-full group-hover:text-blue-400 select-none"
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            startRenaming(folder);
                                        }}
                                    >
                                        {folder.name}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Files */}
                        {items.filter(i => i.type === 'file').map(file => (
                            <div
                                key={`file-${file.id}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, file)}
                                onMouseEnter={(e) => handleDragEnter(e, file)}
                                onClick={(e) => { e.stopPropagation(); handleItemClick(e, file); setContextMenu(null); }}
                                onDoubleClick={() => onPlay && onPlay(file)}
                                onContextMenu={(e) => handleContextMenu(e, file)}
                                className={`fe-item group relative flex flex-col items-center p-4 rounded-lg cursor-pointer transition-colors border ${selectedItems.some(i => i.id === file.id && i.type === 'file') ? 'bg-blue-900/40 border-blue-500' : 'border-transparent hover:bg-gray-800 hover:border-gray-700'} ${clipboard?.items.some(i => i.id === file.id && i.type === 'file') && clipboard?.action === 'cut' ? 'opacity-50' : ''}`}
                            >

                                <div className="text-5xl mb-2 text-blue-400">
                                    {(file as any).fileType === 'archive' ? '📦' : '🎥'}
                                </div>

                                {editingItem?.id === file.id && editingItem?.type === 'file' ? (
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={submitRename}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') submitRename();
                                            if (e.key === 'Escape') setEditingItem(null);
                                        }}
                                        autoFocus
                                        className="w-full bg-gray-700 text-center text-sm rounded px-1 outline-none border border-blue-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div
                                        className="text-sm text-center truncate w-full group-hover:text-blue-400 select-none"
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            startRenaming(file);
                                        }}
                                    >
                                        {file.name}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-gray-800 border border-gray-700 rounded shadow-xl py-1 z-50 min-w-[150px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {contextMenu.item ? (
                        <>
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                                onClick={() => startRenaming(contextMenu.item!)}
                            >
                                Redenumire
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                                onClick={() => handleCut(contextMenu.item!)}
                            >
                                Mutare
                            </button>
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                                onClick={() => handleCopy(contextMenu.item!)}
                            >
                                Copiere
                            </button>
                            {clipboard && (
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                                    onClick={handlePaste}
                                >
                                    Lipire
                                </button>
                            )}
                            <div className="h-px bg-gray-700 my-1"></div>
                            {selectedItems.length === 1 && selectedItems[0].type === 'file' && (
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-green-400 font-medium"
                                    onClick={handleOpenEmailModal}
                                >
                                    Trimite prin Email
                                </button>
                            )}
                            {selectedItems.length > 0 && (
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-yellow-500 font-medium"
                                    onClick={handleOpenArchiveModal}
                                >
                                    Arhivează ({selectedItems.length})
                                </button>
                            )}
                            {selectedItems.length === 1 && (
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                                    onClick={handleDetails}
                                >
                                    Detalii
                                </button>
                            )}
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-red-400 text-sm"
                                onClick={() => handleDeleteFromMenu(contextMenu.item!)}
                            >
                                Ștergere {selectedItems.length > 1 ? `(${selectedItems.length})` : ''}
                            </button>
                        </>
                    ) : (
                        // Background menu
                        <>
                            <button
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                                onClick={() => setIsCreatingFolder(true)}
                            >
                                Folder nou
                            </button>
                            {clipboard && (
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                                    onClick={handlePaste}
                                >
                                    Lipire
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Details Modal */}
            {detailsItem && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setDetailsItem(null)}>
                    <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            {detailsItem.type === 'folder' ? '📁' : '🎥'} Detalii {detailsItem.type === 'folder' ? 'Folder' : 'Fișier'}
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="text-gray-500 block">Nume</label>
                                <div className="text-white bg-gray-800 p-2 rounded border border-gray-700">{detailsItem.name}</div>
                            </div>
                            <div>
                                <label className="text-gray-500 block">Tip</label>
                                <div className="text-white">{detailsItem.type === 'folder' ? 'Dosar de fișiere' : 'Fișier Video (WebM)'}</div>
                            </div>
                            {detailsItem.createdAt && (
                                <div>
                                    <label className="text-gray-500 block">Data Creării</label>
                                    <div className="text-white">{new Date(detailsItem.createdAt).toLocaleString()}</div>
                                </div>
                            )}
                            {detailsItem.filePath && (
                                <div>
                                    <label className="text-gray-500 block">Locație</label>
                                    <div className="text-gray-400 text-xs break-all bg-gray-950 p-2 rounded border border-gray-800">
                                        {detailsItem.filePath.includes('AppData') ? 'Bază de date (Local)' : detailsItem.filePath}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setDetailsItem(null)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
                            >
                                Închide
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Email Modal */}
            {showEmailModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl w-[400px]">
                        <h2 className="text-xl font-bold mb-4 text-white">Trimiteți prin Email</h2>
                        <div className="mb-4 text-sm text-gray-400">
                            Fișier selectat: <span className="text-white font-medium">{items.find(i => i.id === selectedItems[0]?.id)?.name}</span>
                        </div>
                        <input
                            type="email"
                            placeholder="Către (ex: nume@gmail.com)"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 mb-3 text-white focus:outline-none focus:border-blue-500"
                            value={emailData.to}
                            onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                            autoFocus
                        />
                        <input
                            type="text"
                            placeholder="Subiect (opțional)"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 mb-3 text-white focus:outline-none focus:border-blue-500"
                            value={emailData.subject}
                            onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                        />
                        <textarea
                            placeholder="Mesaj (opțional)"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 mb-4 text-white min-h-[100px] focus:outline-none focus:border-blue-500"
                            value={emailData.text}
                            onChange={(e) => setEmailData({ ...emailData, text: e.target.value })}
                        />
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowEmailModal(false)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                                disabled={loading}
                            >
                                Anulează
                            </button>
                            <button
                                onClick={handleSendEmail}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center"
                                disabled={loading || !emailData.to.trim()}
                            >
                                {loading ? 'Se trimite...' : 'Trimite'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Archive Modal */}
            {showArchiveModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 pt-10 pb-10 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl w-[400px] my-auto">
                        <h2 className="text-xl font-bold mb-4 text-white">Salvare arhiva</h2>
                        <div className="mb-4 text-sm text-gray-400">
                            Fișiere/Foldere selectate: <span className="text-white font-medium">{selectedItems.length}</span>
                        </div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Numele arhivei (fără extensie)</label>
                        <input
                            type="text"
                            placeholder="Introduceți numele arhivei"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 mb-4 text-white focus:outline-none focus:border-blue-500"
                            value={archiveData.name}
                            onChange={(e) => setArchiveData({ ...archiveData, name: e.target.value })}
                            autoFocus
                        />
                        <label className="block text-sm font-medium text-gray-400 mb-1">Locație Salvare</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 mb-6 text-white focus:outline-none focus:border-blue-500"
                            value={archiveData.destination}
                            onChange={(e) => setArchiveData({ ...archiveData, destination: e.target.value as 'db' | 'local' | 'drive' })}
                        >
                            <option value="db">În aplicație (Baza de Date Locală)</option>
                            <option value="local">Pe computer (Alegeți folderul)</option>
                            <option value="drive">În Google Drive</option>
                        </select>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowArchiveModal(false)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
                                disabled={loading}
                            >
                                Anulați
                            </button>
                            <button
                                onClick={handleConfirmArchive}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg flex items-center"
                                disabled={loading || !archiveData.name.trim()}
                            >
                                {loading ? 'Se procesează...' : 'Arhivează și salvează'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileExplorer;
