import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        hint: ''
    });
    const [error, setError] = useState<string | null>(null);
    const [hintDisplay, setHintDisplay] = useState<string | null>(null);

    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setHintDisplay(null);

        const { username, password, confirmPassword, hint } = formData;

        if (!username || !password) {
            setError('Te rog să completezi toate câmpurile obligatorii!');
            return;
        }

        if (isRegistering) {
            if (password !== confirmPassword) {
                setError('Parolele nu se potrivesc!');
                return;
            }

            try {
                const result = await window.api.auth.register({ username, password, hint });
                if (result.success) {
                    setIsRegistering(false);
                    setError(null);
                    alert('Cont creat cu succes! Te rog să te autentifici.');
                } else {
                    setError(result.error || 'Înregistrare eșuată.');
                }
            } catch (err) {
                setError('A apărut o eroare neașteptată.');
            }
        } else {
            try {
                const result = await window.api.auth.login({ username, password });
                if (result.success) {
                    localStorage.setItem('user', JSON.stringify(result.user));
                    localStorage.removeItem('guest'); // Clear guest mode
                    navigate('/dashboard');
                } else {
                    setError(result.error || 'Autentificare eșuată');
                }
            } catch (err) {
                setError('A apărut o eroare neașteptată.');
            }
        }
    };

    const handleForgotPassword = async () => {
        if (!formData.username) {
            setError('Introdu numele de utilizator pentru a vedea indiciul.');
            return;
        }

        try {
            const result = await window.api.auth.getHint(formData.username);
            if (result.success && result.hint) {
                setHintDisplay(`Indiciul tău: ${result.hint}`);
            } else {
                setError('Niciun indiciu găsit pentru acest utilizator');
            }
        } catch (err) {
            setError('Nu am putut prelua indiciul.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
            <div className="w-full max-w-md p-8 bg-gray-900 rounded-xl border border-gray-800 shadow-2xl">
                <h2 className="text-3xl font-bold mb-6 text-center text-blue-500">
                    {isRegistering ? 'Creează Cont' : 'Bine ai revenit!'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {hintDisplay && (
                    <div className="mb-4 p-3 bg-blue-900/50 border border-blue-800 rounded text-blue-200 text-sm">
                        {hintDisplay}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Nume utilizator</label>
                        <input
                            name="username"
                            type="text"
                            value={formData.username}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Introdu numele de utilizator"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Parolă</label>
                        <input
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Introdu parola"
                        />
                    </div>

                    {isRegistering && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-400">Confirmă parola</label>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Confirmă parola"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-400">Indiciu parolă</label>
                                <input
                                    name="hint"
                                    type="text"
                                    value={formData.hint}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Introdu un indiciu în caz că ai uitat parola"
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors mt-6"
                    >
                        {isRegistering ? 'Înregistrare' : 'Conectare'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-400">
                    <p>
                        {isRegistering ? 'Ai deja cont?' : "Nu ai cont?"}
                        <button
                            type="button"
                            onClick={() => { setIsRegistering(!isRegistering); setError(null); setHintDisplay(null); }}
                            className="ml-2 text-blue-400 hover:text-blue-300 font-medium hover:underline"
                        >
                            {isRegistering ? 'Conectare' : 'Înregistrare'}
                        </button>
                    </p>
                    {!isRegistering && (
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="mt-2 text-gray-500 hover:text-gray-400 cursor-pointer hover:underline"
                        >
                            Ai uitat parola?
                        </button>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-800">
                    <button
                        type="button"
                        onClick={() => {
                            localStorage.removeItem('user');
                            localStorage.setItem('guest', 'true');
                            navigate('/dashboard');
                        }}
                        className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg transition-colors"
                    >
                        Continuă ca oaspete (neautentificat)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
