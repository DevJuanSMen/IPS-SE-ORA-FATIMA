import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, User, Eye, EyeOff, X, Mail, Phone, CreditCard, ChevronDown } from 'lucide-react';
import LogoImage from '../../assets/Diseño sin título (9).png';
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
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1635 40%, #0f2460 100%)' }}>

            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse"
                    style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-15 blur-3xl animate-pulse"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent)', animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5 blur-3xl"
                    style={{ background: 'radial-gradient(circle, #22d3ee, transparent)' }} />
            </div>

            <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col md:flex-row shadow-2xl rounded-3xl overflow-hidden mx-4 my-8"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.1)' }}>

                {/* Left side: Logo & Branding */}
                <div className="w-full md:w-1/2 p-12 flex flex-col justify-center items-center text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(68,109,245,0.15) 0%, rgba(124,58,237,0.15) 100%)' }}>
                    <div className="absolute inset-0 bg-blue-500/10 blur-3xl"></div>
                    <div className="relative z-10 p-6 rounded-3xl mb-8 shadow-xl" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <img src={LogoImage} alt="IPS Nuestra Señora de Fátima" className="h-32 md:h-48 w-auto object-contain drop-shadow-2xl" />
                    </div>
                    <h1 className="relative z-10 text-3xl font-extrabold text-white mb-2 tracking-tight">IPS Nuestra Señora de Fátima</h1>
                    <p className="relative z-10 text-blue-200 text-sm font-medium px-4">Plataforma Integral de Gestión y Resultados</p>
                </div>

                {/* Right side: Login Card */}
                <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-[#0d1635]/90">
                    <h2 className="text-2xl font-bold text-white mb-6 text-center">Iniciar Sesión</h2>

                    {error && (
                        <div className="mb-5 px-4 py-3 rounded-xl text-sm text-center text-red-300"
                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-blue-200 mb-2">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Ingresa tu usuario"
                                    required
                                    className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-500 outline-none transition-all text-sm"
                                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.7)'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-blue-200 mb-2">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full pl-10 pr-10 py-3 rounded-xl text-white placeholder-slate-500 outline-none transition-all text-sm"
                                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.7)'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors">
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)', boxShadow: '0 4px 24px rgba(68,109,245,0.4)' }}>
                            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 relative">
                        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}></div>
                        <p className="text-center text-slate-400 text-sm mb-4">¿Primera vez aquí?</p>
                        <button onClick={() => setShowRegister(true)}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:bg-white/5 active:scale-[0.98]"
                            style={{ border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', background: 'rgba(99,102,241,0.05)' }}>
                            Registrarse como Paciente
                        </button>
                    </div>
                </div>
            </div>

            {/* Patient Registration Modal */}
            {showRegister && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
                        style={{ background: '#0d1635', border: '1px solid rgba(99,102,241,0.3)' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between p-6 sticky top-0 z-10"
                            style={{ background: '#0d1635', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <div>
                                <h2 className="text-xl font-bold text-white">Regístrate</h2>
                                <p className="text-slate-400 text-sm">Crea tu cuenta de paciente</p>
                            </div>
                            <button onClick={() => { setShowRegister(false); setRegSuccess(false); setRegError(''); }}
                                className="p-2 rounded-xl transition-colors hover:bg-white/10 text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            {regSuccess ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">¡Registro exitoso!</h3>
                                    <p className="text-slate-400 mb-6">Tu cuenta ha sido creada. Ya puedes iniciar sesión.</p>
                                    <button onClick={() => { setShowRegister(false); setRegSuccess(false); }}
                                        className="px-6 py-3 rounded-xl font-bold text-white"
                                        style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                        Ir al Login
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleRegister} className="space-y-4">
                                    {regError && (
                                        <div className="px-4 py-3 rounded-xl text-sm text-red-300"
                                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                            {regError}
                                        </div>
                                    )}

                                    {/* Row: username */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Usuario</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                            <input type="text" required placeholder="Usuario único" value={regForm.username}
                                                onChange={e => setRegForm(p => ({ ...p, username: e.target.value }))}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-white text-sm outline-none"
                                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                            <input type="email" placeholder="correo@ejemplo.com" value={regForm.email}
                                                onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-white text-sm outline-none"
                                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Contraseña</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                                <input type="password" required placeholder="Min. 6 caracteres" value={regForm.password}
                                                    onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-white text-sm outline-none"
                                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirmar</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                                <input type="password" required placeholder="Confirma" value={regForm.confirmPassword}
                                                    onChange={e => setRegForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-white text-sm outline-none"
                                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Full name */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nombres y Apellidos</label>
                                        <input type="text" required placeholder="Nombre completo" value={regForm.full_name}
                                            onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl text-white text-sm outline-none"
                                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                    </div>

                                    {/* Document + Phone */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Documento</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                                <input type="text" placeholder="Núm. documento" value={regForm.document_id}
                                                    onChange={e => setRegForm(p => ({ ...p, document_id: e.target.value }))}
                                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-white text-sm outline-none"
                                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Celular</label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                                <input type="tel" required placeholder="3001234567" value={regForm.phone}
                                                    onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))}
                                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-white text-sm outline-none"
                                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gender + Blood type */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Género</label>
                                            <div className="relative">
                                                <select value={regForm.gender} onChange={e => setRegForm(p => ({ ...p, gender: e.target.value }))}
                                                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none"
                                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: regForm.gender ? 'white' : '#94a3b8' }}>
                                                    <option value="">Selecciona</option>
                                                    {genders.map(g => <option key={g} value={g}>{g}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fecha de nacimiento</label>
                                            <input type="date" value={regForm.birth_date} onChange={e => setRegForm(p => ({ ...p, birth_date: e.target.value }))}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none"
                                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: regForm.birth_date ? 'white' : '#94a3b8' }} />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={regLoading}
                                        className="w-full py-3.5 rounded-xl font-bold text-white text-sm mt-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                                        style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)', boxShadow: '0 4px 24px rgba(68,109,245,0.35)' }}>
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
