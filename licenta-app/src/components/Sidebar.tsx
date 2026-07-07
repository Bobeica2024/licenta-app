import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path: string) => location.pathname === path;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const userObj: any = React.useMemo(() => {
        const raw = localStorage.getItem('user');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }, [location.pathname]);

    const user = !!userObj;

    const handleAuthAction = async () => {
        if (user) {
            const recorderFilePath = sessionStorage.getItem('recorder_filePath');
            const croppedFilePath = sessionStorage.getItem('dashboard_croppedFilePath');

            try {
                if (croppedFilePath) {
                    // @ts-ignore
                    await window.api.recorder.deleteTempFile(croppedFilePath);
                }
                if (recorderFilePath) {
                    // @ts-ignore
                    await window.api.recorder.deleteTempFile(recorderFilePath);
                }
            } catch (e) {
                console.warn('Could not delete temp recording files on logout:', e);
            }

            sessionStorage.removeItem('recorder_filePath');
            sessionStorage.removeItem('dashboard_croppedFilePath');

           
            try {
                // @ts-ignore
                await window.api.drive.logout();
            } catch (e) {
                console.warn('Could not log out from Google Drive:', e);
            }

            localStorage.removeItem('user');
        } else {
            
            localStorage.removeItem('guest');
        }
        navigate('/');
    };

    return (
        <div className="w-64 h-screen bg-gray-900 text-white flex flex-col p-4 border-r border-gray-800">
            <h1 className="text-2xl font-bold mb-8 text-blue-500">FragMan</h1>

            <nav className="flex-1 space-y-2">
                <Link
                    to="/dashboard"
                    className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/dashboard') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                >
                    Panou de control
                </Link>
                {userObj && (
                    <>
                        <Link
                            to="/library"
                            className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/library') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                        >
                            Bază de date
                        </Link>
                        <Link
                            to="/history"
                            className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/history') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                        >
                            Istoric
                        </Link>
                        {userObj.isAdmin && (
                            <Link
                                to="/users"
                                className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/users') ? 'bg-red-900/40 text-red-200' : 'hover:bg-gray-800'}`}
                            >
                                Utilizatori
                            </Link>
                        )}
                    </>
                )}
                <Link
                    to="/settings"
                    className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/settings') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                >
                    Setări
                </Link>
            </nav>

            <div className="mt-auto">
                <button
                    onClick={handleAuthAction}
                    className={`block w-full px-4 py-3 rounded-full font-bold text-center transition-colors ${user
                        ? 'bg-black text-red-500 hover:bg-gray-900' 
                        : 'bg-white text-red-600 hover:bg-gray-100' 
                        }`}
                >
                    {user ? 'Deconectare' : 'Conectare'}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
