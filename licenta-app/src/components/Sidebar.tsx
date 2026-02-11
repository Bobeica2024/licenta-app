import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="w-64 h-screen bg-gray-900 text-white flex flex-col p-4 border-r border-gray-800">
            <h1 className="text-2xl font-bold mb-8 text-blue-500">Licență App</h1>

            <nav className="flex-1 space-y-2">
                <Link
                    to="/"
                    className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                >
                    Dashboard
                </Link>
                <Link
                    to="/library"
                    className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/library') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                >
                    Library
                </Link>
                <Link
                    to="/settings"
                    className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/settings') ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
                >
                    Settings
                </Link>
            </nav>

            <div className="mt-auto">
                <Link
                    to="/login"
                    className="block px-4 py-3 rounded-lg hover:bg-red-900/50 text-red-400 transition-colors"
                >
                    Logout
                </Link>
            </div>
        </div>
    );
};

export default Sidebar;
