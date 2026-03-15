import React, { useState, useEffect } from 'react';

const Users = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.map((u) => (
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
                                <button
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    className="w-full mt-4 py-2 bg-gray-800 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors font-medium text-sm"
                                >
                                    Șterge Cont
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Users;
