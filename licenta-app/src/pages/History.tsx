import React, { useState, useEffect } from 'react';

const History = () => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<number[]>([]);
    const [playingFile, setPlayingFile] = useState<{ name: string, filePath: string } | null>(null);
    // Admin: filter by user ('all' | specific userId as string)
    const [filterUserId, setFilterUserId] = useState<string>('all');

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const result = await window.api.history.get({ userId: user.id, isAdmin: !!user.isAdmin });
            if (result.success && result.history) {
                setHistory(result.history);
            } else {
                setError(result.error || 'A apărut o eroare la încărcarea istoricului.');
            }
        } catch (err: any) {
            setError('A apărut o eroare neașteptată.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (ids: number[]) => {
        if (ids.length === 0) return;

        try {
            let successCount = 0;
            for (const id of ids) {
                const result = await window.api.history.delete({ id, userId: user?.id, isAdmin: !!user?.isAdmin });
                if (result.success) {
                    successCount++;
                }
            }
            
            if (successCount < ids.length) {
                alert(`Unele înregistrări nu au putut fi șterse (${successCount}/${ids.length} reușite).`);
            }
            
            setSelectedItems([]);
            loadHistory(); // Reload history
        } catch (e) {
            alert('A apărut o eroare la ștergere.');
        }
    };

    const toggleSelection = (id: number) => {
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(i => i !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    const toggleAll = () => {
        if (selectedItems.length === history.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(history.map(h => h.id));
        }
    };

    const handleRowClick = (e: React.MouseEvent, id: number) => {
        if (e.ctrlKey || e.metaKey) {
            toggleSelection(id);
        } else {
            setSelectedItems([id]);
        }
    };

    const PREVIEW_ACTIONS = new Set(['VIEW_VIDEO', 'SAVE_VIDEO', 'SAVE_DB', 'SAVE_LOCAL', 'SAVE_DRIVE']);

    const handlePreviewClick = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        const result = await window.api.history.getFragmentByName({ itemName: item.item_name, ownerId: item.user_id });
        if (result.success && result.fragment && result.fragment.type === 'video') {
            setPlayingFile({ name: result.fragment.title, filePath: result.fragment.file_path });
        } else {
            alert(result.error || 'Fișierul nu poate fi previzualizat (posibil nu este video sau a fost șters/redenumit).');
        }
    };

    // Dictionary for Romanian translation of action types
    const actionTranslation: Record<string, string> = {
        'VIEW_VIDEO': 'A vizionat',
        'DELETE_ITEM': 'A șters',
        'CREATE_FOLDER': 'A creat folderul',
        'RENAME': 'A redenumit',
        'MOVE': 'A mutat',
        'COPY': 'A copiat',
        'ARCHIVE': 'A arhivat'
    };

    if (!user) {
        return <div className="p-8 text-center text-red-500">Trebuie să fii autentificat pentru a vedea istoricul.</div>;
    }

    // Unique users in history (for admin filter dropdown)
    const uniqueUsers: { id: number; username: string }[] = [];
    if (user.isAdmin) {
        const seen = new Set<number>();
        history.forEach(item => {
            if (!seen.has(item.user_id)) {
                seen.add(item.user_id);
                uniqueUsers.push({ id: item.user_id, username: item.username });
            }
        });
        uniqueUsers.sort((a, b) => a.username.localeCompare(b.username));
    }

    const filteredHistory = user.isAdmin && filterUserId !== 'all'
        ? history.filter(item => String(item.user_id) === filterUserId)
        : history;

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto h-full">
            <h2 className="text-3xl font-bold mb-6 text-blue-500">Istoric Operațiuni</h2>

            {user.isAdmin && (
                <div className="mb-6 flex flex-wrap items-center gap-4">
                    <div className="p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg text-blue-200 flex-1">
                        Sunteți autentificat ca Administrator. Vedeți istoricul tuturor utilizatorilor.
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 whitespace-nowrap">👤 Filtrează după utilizator:</span>
                        <select
                            value={filterUserId}
                            onChange={(e) => { setFilterUserId(e.target.value); setSelectedItems([]); }}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                        >
                            <option value="all">Toți utilizatorii</option>
                            <option value={String(user.id)}>Doar eu</option>
                            {uniqueUsers.filter(u => u.id !== user.id).map(u => (
                                <option key={u.id} value={String(u.id)}>{u.username}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
                    {error}
                </div>
            )}

            {selectedItems.length > 0 && (
                <div className="mb-4 flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg">
                    <span className="text-gray-300 font-medium">
                        {selectedItems.length} {selectedItems.length === 1 ? 'element selectat' : 'elemente selectate'}
                    </span>
                    <button
                        onClick={() => handleDelete(selectedItems)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm font-medium"
                    >
                        Șterge Selecția
                    </button>
                </div>
            )}

            {loading ? (
                <div className="text-gray-400">Se încarcă istoricul...</div>
            ) : filteredHistory.length === 0 ? (
                <div className="text-gray-400 bg-gray-900 p-8 rounded-xl border border-gray-800 text-center">
                    Nu s-au găsit înregistrări în istoric.
                </div>
            ) : (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-800 border-b border-gray-700">
                                <th className="p-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                        checked={filteredHistory.length > 0 && selectedItems.length === filteredHistory.length}
                                        onChange={toggleAll}
                                    />
                                </th>
                                {user.isAdmin && filterUserId === 'all' && <th className="p-4 font-semibold text-gray-300">Utilizator</th>}
                                <th className="p-4 font-semibold text-gray-300">Acțiune</th>
                                <th className="p-4 font-semibold text-gray-300">Element</th>
                                <th className="p-4 font-semibold text-gray-300">Data & Ora</th>
                                <th className="p-4 font-semibold text-gray-300 text-right">Opțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((item) => (
                                <tr 
                                    key={item.id} 
                                    className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${selectedItems.includes(item.id) ? 'bg-blue-900/20' : ''}`}
                                    onClick={(e) => handleRowClick(e, item.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td className="p-4 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                            checked={selectedItems.includes(item.id)}
                                            onChange={() => toggleSelection(item.id)}
                                        />
                                    </td>
                                    {user.isAdmin && filterUserId === 'all' && <td className="p-4 text-blue-400 font-medium">{item.username}</td>}
                                    <td className="p-4 text-gray-300">{actionTranslation[item.action_type] || item.action_type}</td>
                                    <td className="p-4 font-medium">
                                        {PREVIEW_ACTIONS.has(item.action_type) ? (
                                            <span
                                                className="hover:underline hover:text-blue-400 cursor-pointer text-blue-300"
                                                onClick={(e) => handlePreviewClick(e, item)}
                                                title="Click pentru previzualizare video"
                                            >
                                                {item.item_name}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">{item.item_name}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-gray-400 text-sm">{new Date(item.created_at).toLocaleString('ro-RO')}</td>
                                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleDelete([item.id])}
                                            className="px-3 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/60 hover:text-red-200 rounded transition-colors text-sm"
                                        >
                                            Șterge
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Video Player Modal */}
            {playingFile && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8 text-white relative">
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

export default History;
