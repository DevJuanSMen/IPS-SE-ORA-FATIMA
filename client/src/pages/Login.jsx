import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, User, Eye, EyeOff, X, Mail, Phone, CreditCard, ChevronDown } from 'lucide-react';
import LogoImage from '../../assets/Diseño sin título (19).png';
import { getRoleHome } from '../AppRouter';

const API_URL = '';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genders = ['Masculino', 'Femenino', 'Otro'];

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [regLoading, setRegLoading] = useState(false);
    const [regSuccess, setRegSuccess] = useState(false);
    const [regError, setRegError] = useState('');
    const [regForm, setRegForm] = useState({
        username: '', password: '', confirmPassword: '', full_name: '',
        email: '', phone: '', document_id: '', gender: '', birth_date: ''
    });
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/api/auth/login`, { username, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            navigate(getRoleHome(data.user.role));
        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');
        if (regForm.password !== regForm.confirmPassword) {
            return setRegError('Las contraseñas no coinciden');
        }
        if (regForm.password.length < 6) {
            return setRegError('La contraseña debe tener al menos 6 caracteres');
        }
        setRegLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/register-patient`, {
                username: regForm.username,
                password: regForm.password,
                full_name: regForm.full_name,
                email: regForm.email,
                phone: regForm.phone,
                document_id: regForm.document_id,
                gender: regForm.gender,
                birth_date: regForm.birth_date
            });
            setRegSuccess(true);
        } catch (err) {
            setRegError(err.response?.data?.error || 'Error al registrarse');
        } finally {
            setRegLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50">

            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-40 blur-3xl animate-pulse bg-blue-300/40" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-40 blur-3xl animate-pulse bg-indigo-300/40" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl bg-cyan-300/30" />
            </div>

            <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col md:flex-row shadow-2xl rounded-3xl overflow-hidden mx-4 my-8 bg-white/80 backdrop-blur-xl border border-white/60">

                {/* Left side: Logo & Branding */}
                <div className="w-full md:w-1/2 p-12 flex flex-col justify-center items-center text-center relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border-r border-slate-100">
                    <div className="absolute inset-0 bg-blue-100/30 blur-3xl"></div>
                    <div className="relative z-10 p-6 rounded-3xl mb-8 shadow-xl bg-white/60 backdrop-blur-md border border-white/80">
                        <img src={LogoImage} alt="IPS Nuestra Señora de Fátima" className="h-40 md:h-56 w-auto object-contain drop-shadow-xl" />
                    </div>
                    <h1 className="relative z-10 text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">IPS Nuestra Señora de Fátima</h1>
                    <p className="relative z-10 text-slate-600 text-sm font-medium px-4">Plataforma Integral de Gestión y Resultados</p>
                </div>

                {/* Right side: Login Card */}
                <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white/95">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Iniciar Sesión</h2>

                    {error && (
                        <div className="mb-5 px-4 py-3 rounded-xl text-sm text-center text-red-600 bg-red-50 border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Ingresa tu usuario"
                                    required
                                    className="w-full pl-11 pr-4 py-3.5 rounded-xl text-slate-800 placeholder-slate-400 outline-none transition-all text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5" />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full pl-11 pr-12 py-3.5 rounded-xl text-slate-800 placeholder-slate-400 outline-none transition-all text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors p-1">
                                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40">
                            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 relative border-t border-slate-100">
                        <p className="text-center text-slate-500 text-sm mb-4 font-medium">¿Primera vez aquí?</p>
                        <button onClick={() => setShowRegister(true)}
                            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-indigo-50 active:scale-[0.98] border-2 border-indigo-100 text-indigo-600 bg-white">
                            Registrarse como Paciente
                        </button>
                    </div>
                </div>
            </div>

            {/* Patient Registration Modal */}
            {showRegister && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white border border-slate-200">

                        {/* Header */}
                        <div className="flex items-center justify-between p-6 sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Regístrate</h2>
                                <p className="text-slate-500 text-sm">Crea tu cuenta de paciente</p>
                            </div>
                            <button onClick={() => { setShowRegister(false); setRegSuccess(false); setRegError(''); }}
                                className="p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            {regSuccess ? (
                                <div className="text-center py-8">
                                    <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
                                        <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">¡Registro exitoso!</h3>
                                    <p className="text-slate-500 mb-8">Tu cuenta ha sido creada. Ya puedes iniciar sesión.</p>
                                    <button onClick={() => { setShowRegister(false); setRegSuccess(false); }}
                                        className="px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all active:scale-95">
                                        Ir al Login
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleRegister} className="space-y-5">
                                    {regError && (
                                        <div className="px-4 py-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200">
                                            {regError}
                                        </div>
                                    )}

                                    {/* Row: username */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Usuario</label>
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                                            <input type="text" required placeholder="Usuario único" value={regForm.username}
                                                onChange={e => setRegForm(p => ({ ...p, username: e.target.value }))}
                                                className="w-full pl-10 pr-3 py-3 rounded-xl text-slate-800 text-sm outline-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400" />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                                            <input type="email" placeholder="correo@ejemplo.com" value={regForm.email}
                                                onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                                                className="w-full pl-10 pr-3 py-3 rounded-xl text-slate-800 text-sm outline-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400" />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Contraseña</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                                                <input type="password" required placeholder="Min. 6 caracteres" value={regForm.password}
                                                    onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                                                    className="w-full pl-10 pr-3 py-3 rounded-xl text-slate-800 text-sm outline-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Confirmar</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                                                <input type="password" required placeholder="Confirma" value={regForm.confirmPassword}
                                                    onChange={e => setRegForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                                    className="w-full pl-10 pr-3 py-3 rounded-xl text-slate-800 text-sm outline-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Full name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Nombres y Apellidos</label>
                                        <input type="text" required placeholder="Nombre completo" value={regForm.full_name}
                                            onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))}
                                            className="w-full px-4 py-3 rounded-xl text-slate-800 text-sm outline-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400" />
                                    </div>

                                    {/* Document + Phone */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Documento</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                                                <input type="text" placeholder="Núm. documento" value={regForm.document_id}
                                                    onChange={e => setRegForm(p => ({ ...p, document_id: e.target.value }))}
                                                    className="w-full pl-10 pr-3 py-3 rounded-xl text-slate-800 text-sm outline-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Celular</label>
                                            <div className="relative">
                                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                                                <input type="tel" required placeholder="3001234567" value={regForm.phone}
                                                    onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))}
                                                    className="w-full pl-10 pr-3 py-3 rounded-xl text-slate-800 text-sm outline-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-slate-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gender + Blood type */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Género</label>
                                            <div className="relative">
                                                <select value={regForm.gender} onChange={e => setRegForm(p => ({ ...p, gender: e.target.value }))}
                                                    className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                                    style={{ color: regForm.gender ? '#1e293b' : '#94a3b8' }}>
                                                    <option value="" className="text-slate-400">Selecciona</option>
                                                    {genders.map(g => <option key={g} value={g} className="text-slate-800">{g}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Fecha de nacimiento</label>
                                            <input type="date" value={regForm.birth_date} onChange={e => setRegForm(p => ({ ...p, birth_date: e.target.value }))}
                                                className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                                style={{ color: regForm.birth_date ? '#1e293b' : '#94a3b8' }} />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={regLoading}
                                        className="w-full py-4 rounded-xl font-bold text-white text-sm mt-4 disabled:opacity-70 transition-all active:scale-[0.98] bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40">
                                        {regLoading ? 'Creando cuenta...' : 'Crear cuenta'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
