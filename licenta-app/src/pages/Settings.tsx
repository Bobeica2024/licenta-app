import React, { useState, useEffect } from 'react';

const Settings = () => {
    const [driveSession, setDriveSession] = useState<{ isLoggedIn: boolean; user?: any }>({ isLoggedIn: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const session = await window.api.drive.getSession();
            setDriveSession(session);
        } catch (err) {
            console.error('Failed to get session', err);
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
                setError(result.error || 'Authentication failed');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
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
            console.error('Logout failed', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 p-8 bg-gray-950 text-white overflow-auto">
            <h2 className="text-3xl font-bold mb-6">Settings</h2>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 max-w-2xl">
                <h3 className="text-xl font-semibold mb-4 text-blue-400">Google Drive Integration</h3>

                <p className="text-gray-400 mb-6">
                    Connect your Google Drive account to save recordings directly to the cloud.
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
                                {driveSession.isLoggedIn ? 'Connected' : 'Not Connected'}
                            </p>
                            {driveSession.isLoggedIn && (
                                <p className="text-sm text-gray-500">Ready to upload files</p>
                            )}
                        </div>
                    </div>

                    {!driveSession.isLoggedIn ? (
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                        >
                            {loading ? 'Connecting...' : 'Connect Drive'}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={handleConnect}
                                disabled={loading}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm"
                            >
                                Switch Account
                            </button>
                            <button
                                onClick={handleLogout}
                                disabled={loading}
                                className="px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-900 text-red-200 rounded-lg font-medium transition-colors text-sm"
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-900/50 rounded-lg text-sm text-yellow-200/70">
                    <p>Note: This integration uses a local loopback receiver (http://localhost:5000) to capture the authentication token securely.</p>
                </div>
            </div>
        </div>
    );
};

export default Settings;
