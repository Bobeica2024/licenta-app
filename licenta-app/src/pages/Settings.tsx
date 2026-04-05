import React, { useState, useEffect } from 'react';

const Settings = () => {
    const [driveSession, setDriveSession] = useState<{ isLoggedIn: boolean; user?: any }>({ isLoggedIn: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Account settings state
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const [originalUsername] = useState(currentUser?.username || '');
    const [username, setUsername] = useState(currentUser?.username || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountMessage, setAccountMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const session = await window.api.drive.getSession();
            setDriveSession(session);
        } catch (err) {
            console.error('Eroare la obținerea sesiunii', err);
        }
    };

    const handleConnect = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.api.drive.authenticate();
            if (result.success) {
                await checkSession();
            } else {
                setError(result.error || 'Autentificare eșuată');
            }
        } catch (err: any) {
            setError(err.message || 'A apărut o eroare');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await window.api.drive.logout();
            await checkSession();
        } catch (err) {
            console.error('Logout eșuat', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeUsername = async () => {
        if (!currentUser) return;
        if (!username.trim() || username.length < 3) {
            setAccountMessage({ type: 'error', text: 'Numele trebuie să aibă minim 3 caractere.' });
            return;
        }
        if (username === originalUsername) {
            setAccountMessage({ type: 'error', text: 'Introduceți un nume de utilizator diferit.' });
            return;
        }

        setAccountLoading(true);
        setAccountMessage(null);
        try {
            const result = await window.api.auth.changeUsername({ userId: currentUser.id, newUsername: username });
            if (result.success) {
                const updatedUser = { ...currentUser, username };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setAccountMessage({ type: 'success', text: 'Nume de utilizator schimbat cu succes!' });

                // Actualizăm interfața după o scurtă pauză ca să se randeze și meniul
                setTimeout(() => window.location.reload(), 1500);
            } else {
                setAccountMessage({ type: 'error', text: result.error || 'Schimbarea a eșuat.' });
            }
        } catch (e) {
            setAccountMessage({ type: 'error', text: 'Eroare neașteptată.' });
        } finally {
            setAccountLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentUser) return;
        if (!newPassword || newPassword.length < 6) {
            setAccountMessage({ type: 'error', text: 'Parola trebuie să aibă minim 6 caractere.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setAccountMessage({ type: 'error', text: 'Parolele nu se potrivesc.' });
            return;
        }

        setAccountLoading(true);
        setAccountMessage(null);
        try {
            const result = await window.api.auth.changePassword({ userId: currentUser.id, newPassword });
            if (result.success) {
                setAccountMessage({ type: 'success', text: 'Parola a fost schimbată!' });
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setAccountMessage({ type: 'error', text: result.error || 'Eroare la schimbarea parolei.' });
            }
        } catch (e) {
            setAccountMessage({ type: 'error', text: 'Eroare neașteptată.' });
        } finally {
            setAccountLoading(false);
        }
    };

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto flex flex-col gap-6">
            <h2 className="text-3xl font-bold">Setări</h2>

            {/* Setări profil */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 max-w-2xl">
                <h3 className="text-xl font-semibold mb-4 text-green-400">Setări cont</h3>
                <p className="text-gray-400 mb-6">
                    Aici poți să îți schimbi numele de utilizator și parola contului tău.
                </p>

                {accountMessage && (
                    <div className={`mb-6 p-3 rounded text-sm ${accountMessage.type === 'success' ? 'bg-green-900/50 border border-green-800 text-green-200' : 'bg-red-900/50 border border-red-800 text-red-200'}`}>
                        {accountMessage.text}
                    </div>
                )}

                <div className="flex flex-col gap-6">
                    {/* Schimbare username */}
                    <div className="p-4 bg-black/30 border border-gray-800 rounded-lg">
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Schimbă nume utilizator (Curent: {originalUsername})
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500 text-white"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Nume utilizator..."
                            />
                            <button
                                onClick={handleChangeUsername}
                                disabled={accountLoading || username === originalUsername}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                            >
                                Salvează
                            </button>
                        </div>
                    </div>

                    {/* Schimbare parola */}
                    <div className="p-4 bg-black/30 border border-gray-800 rounded-lg space-y-4">
                        <label className="block text-sm font-medium text-gray-400">
                            Schimbă parola
                        </label>
                        <input
                            type="password"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Parola nouă..."
                        />
                        <input
                            type="password"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 text-white"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirmă parola nouă..."
                        />
                        <button
                            onClick={handleChangePassword}
                            disabled={accountLoading || !newPassword}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                            Salvează parola
                        </button>
                    </div>
                </div>
            </div>

            {/* Integrare Google */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 max-w-2xl">
                <h3 className="text-xl font-semibold mb-4 text-blue-400">Integrare Google</h3>

                <p className="text-gray-400 mb-6">
                    Conectează-ți contul Google pentru a salva înregistrările direct în cloud.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between bg-black/30 p-4 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${driveSession.isLoggedIn ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} />
                        <div>
                            <p className="font-medium text-lg">
                                {driveSession.isLoggedIn ? 'Conectat' : 'Neconectat'}
                            </p>
                            {driveSession.isLoggedIn && (
                                <p className="text-sm text-gray-500">Gata pentru încărcare fișiere</p>
                            )}
                        </div>
                    </div>

                    {!driveSession.isLoggedIn ? (
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                        >
                            {loading ? 'Se conectează...' : 'Conectează-te cu un cont Google'}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        await window.api.drive.logout();
                                        await handleConnect();
                                    } catch (err) {
                                        console.error('Logout failed before changing account', err);
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm"
                            >
                                Schimbare cont
                            </button>
                            <button
                                onClick={handleLogout}
                                disabled={loading}
                                className="px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-900 text-red-200 rounded-lg font-medium transition-colors text-sm"
                            >
                                Deconectare
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-900/50 rounded-lg text-sm text-yellow-200/70">
                    <p>Notă: Această integrare folosește un receptor local (http://localhost:5000) pentru a captura token-ul de autentificare în siguranță.</p>
                </div>
            </div>
        </div>
    );
};

export default Settings;
