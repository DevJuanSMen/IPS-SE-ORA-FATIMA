import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, User } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await axios.post(`${API_URL}/api/auth/login`, { username, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Configurar header default para axios
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#171A21] text-white">
            <div className="bg-[#1F232B] p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <div className="bg-[#2D63ED] p-4 rounded-full shadow-lg shadow-blue-900/50">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-[#8FB5FF] mb-2">
                        IPS Nuestra Señora de Fátima
                    </h2>
                    <p className="text-gray-400 text-sm">Ingresa tus credenciales para continuar</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-200 mb-2">Usuario</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-500" />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-[#171A21] border border-gray-700/80 rounded-xl focus:ring-2 focus:ring-[#446DF5] focus:border-transparent text-white placeholder-gray-600 outline-none transition-all"
                                placeholder="Ingresa tu usuario"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-200 mb-2">Contraseña</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-500" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-[#171A21] border border-gray-700/80 rounded-xl focus:ring-2 focus:ring-[#446DF5] focus:border-transparent text-white placeholder-gray-600 outline-none transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 mt-8 bg-[#446DF5] hover:bg-[#3457D5] text-white font-bold rounded-xl shadow-lg transform transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#1F232B] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}
