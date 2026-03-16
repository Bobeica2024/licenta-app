import { useState, useEffect } from 'react';

const Users = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Password reset modal state
    const [resetTarget, setResetTarget] = useState<{ id: number; username: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetLoading, setResetLoading] = useState(false);

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        if (!currentUser || !currentUser.isAdmin) {
            setError('Acces Neautorizat');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await window.api.admin.getUsers({ isAdmin: true });
            if (result.success && result.users) {
                setUsers(result.users);
            } else {
                setError(result.error || 'Eroare la încărcarea utilizatorilor.');
            }
        } catch (err) {
            setError('Eroare neașteptată.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (targetUserId: number, username: string) => {
        if (!confirm(`Sunteți complet sigur că doriți să ștergeți utilizatorul ${username}? Toate datele asociate vor fi eliminate!`)) return;

        try {
            const result = await window.api.admin.deleteUser({ targetUserId, isAdmin: true });
            if (result.success) {
                loadUsers();
            } else {
                alert(result.error || 'Ștergerea a eșuat. Utilizatorii admin nu pot fi șterși.');
            }
        } catch (e) {
            alert('A apărut o eroare la ștergerea utilizatorului.');
        }
    };

    const openResetModal = (user: { id: number; username: string }) => {
        setResetTarget(user);
        setNewPassword('');
        setConfirmPassword('');
        setResetError(null);
    };

    const closeResetModal = () => {
        setResetTarget(null);
        setNewPassword('');
        setConfirmPassword('');
        setResetError(null);
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            setResetError('Parola trebuie să aibă cel puțin 6 caractere.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setResetError('Parolele nu se potrivesc.');
            return;
        }

        setResetLoading(true);
        setResetError(null);
        try {
            const result = await window.api.admin.resetPassword({
                targetUserId: resetTarget!.id,
                newPassword,
                isAdmin: true,
            });
            if (result.success) {
                alert(`Parola utilizatorului "${resetTarget!.username}" a fost schimbată cu succes!`);
                closeResetModal();
            } else {
                setResetError(result.error || 'Resetarea a eșuat.');
            }
        } catch (e) {
            setResetError('A apărut o eroare neașteptată.');
        } finally {
            setResetLoading(false);
        }
    };

    if (!currentUser || !currentUser.isAdmin) {
        return <div className="p-8 text-center text-red-500 font-bold text-xl">Acces Interzis. Această pagină este rezervată Administratorilor.</div>;
    }

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto h-full">
            <h2 className="text-3xl font-bold mb-6 text-red-500">Gestiune Utilizatori</h2>

            <p className="text-gray-400 mb-6 max-w-2xl">
                Din acest panou puteți vizualiza și elimina utilizatorii din aplicație. Conturile cu drepturi de administrator (ex: bobeicastefan) nu pot fi șterse.
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-gray-400">Se încarcă lista de utilizatori...</div>
            ) : (
                <>
                    {/* Search */}
                    <div className="mb-6 max-w-sm relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Caută după nume utilizator..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {users
                            .filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
                            .map((u) => (
                        <div key={u.id} className={`p-6 rounded-xl border ${u.is_admin ? 'bg-red-900/20 border-red-900/50' : 'bg-gray-900 border-gray-800'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold">{u.username}</h3>
                                    <p className="text-sm text-gray-400 mt-1">ID Cont: #{u.id}</p>
                                </div>
                                {u.is_admin ? (
                                    <span className="bg-red-500/20 text-red-400 px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wider">Admin</span>
                                ) : (
                                    <span className="bg-blue-500/20 text-blue-400 px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wider">User</span>
                                )}
                            </div>

                            {!u.is_admin && (
                                <div className="flex flex-col gap-2 mt-4">
                                    <button
                                        onClick={() => openResetModal({ id: u.id, username: u.username })}
                                        className="w-full py-2 bg-gray-700 hover:bg-blue-700 text-gray-200 hover:text-white rounded-lg transition-colors font-medium text-sm"
                                    >
                                        🔑 Schimbă Parola
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(u.id, u.username)}
                                        className="w-full py-2 bg-gray-800 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors font-medium text-sm"
                                    >
                                        🗑️ Șterge Cont
                                    </button>
                                </div>
                            )}
                        </div>
                        ))}
                    </div>
                </>
            )}

            {/* Reset Password Modal */}
            {resetTarget && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-900 w-full max-w-md rounded-xl border border-gray-700 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">
                                🔑 Schimbă parola pentru <span className="text-blue-400">{resetTarget.username}</span>
                            </h3>
                            <button onClick={closeResetModal} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
                        </div>

                        {resetError && (
                            <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
                                {resetError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Parolă nouă</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                                    placeholder="Minim 6 caractere..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Confirmă parola nouă</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                                    placeholder="Repetă parola..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={closeResetModal}
                                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                            >
                                Anulează
                            </button>
                            <button
                                onClick={handleResetPassword}
                                disabled={resetLoading}
                                className="flex-[2] py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {resetLoading ? 'Se salvează...' : '✅ Salvează Parola'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
