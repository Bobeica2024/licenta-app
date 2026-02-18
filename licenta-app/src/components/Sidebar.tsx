import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path: string) => location.pathname === path;

    const user = localStorage.getItem('user');


    const handleAuthAction = () => {
        if (user) {
            // Logout
            localStorage.removeItem('user');
        } else {
            // Login (from Guest)
            localStorage.removeItem('guest');
        }
        navigate('/');
    };

    return (
        <div className="w-64 h-screen bg-gray-900 text-white flex flex-col p-4 border-r border-gray-800">
            <h1 className="text-2xl font-bold mb-8 text-blue-500">Licență App</h1>

            <nav className="flex-1 space-y-2">
                <Link
                    to="/dashboard"
                    className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/dashboard') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                >
                    Panou de control
                </Link>
                {user && (
                    <Link
                        to="/library"
                        className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/library') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                    >
                        Bază de date
                    </Link>
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
                        ? 'bg-black text-red-500 hover:bg-gray-900' // Deconectare (User)
                        : 'bg-white text-red-600 hover:bg-gray-100' // Conectare (Guest)
                        }`}
                >
                    {user ? 'Deconectare' : 'Conectare'}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
