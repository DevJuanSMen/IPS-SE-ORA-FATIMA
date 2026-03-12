import React, { useState } from 'react';
import axios from 'axios';
import { User, Mail, Shield, Camera, Lock, Save } from 'lucide-react';

const API_URL = '';

export default function ProfileView({ user, onUpdateUser }) {
    const [name, setName] = useState(user.full_name || user.username || '');
    const [email, setEmail] = useState(user.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState('');
    const fileInputRef = React.useRef(null);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMsg('');
        try {
            const res = await axios.put(`${API_URL}/api/auth/me`, { full_name: name, email });
            const updated = { ...user, full_name: name, email };
            localStorage.setItem('user', JSON.stringify(updated));
            if (onUpdateUser) onUpdateUser(updated);
            setMsg('Perfil actualizado exitosamente.');
        } catch (err) {
            setMsg('Error actualizando perfil.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMsg('');
        try {
            await axios.put(`${API_URL}/api/auth/me/password`, { currentPassword, newPassword });
            setMsg('Contraseña cambiada exitosamente.');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err) {
            setMsg('Error cambiando contraseña.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            setUploading(true);
            setMsg('');
            try {
                const base64String = reader.result;
                await axios.put(`${API_URL}/api/auth/me/avatar`, { avatar_url: base64String });
                const updated = { ...user, avatar_url: base64String };
                localStorage.setItem('user', JSON.stringify(updated));
                if (onUpdateUser) onUpdateUser(updated);
                setMsg('Foto de perfil actualizada exitosamente.');
            } catch (err) {
                setMsg('Error actualizando foto de perfil.');
                console.error(err);
            } finally {
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Mi Perfil</h2>
                <p className="text-slate-500 dark:text-slate-400">Gestiona tu información personal y configuración de seguridad.</p>
            </header>

            {msg && (
                <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-4 rounded-xl font-medium text-center">
                    {msg}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Info & Avatar */}
                <div className="md:col-span-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 flex flex-col items-center">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-32 h-32 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg overflow-hidden relative">
                            {uploading && (
                                <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-12 h-12 text-slate-300 dark:text-slate-500" />
                            )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white w-8 h-8" />
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-white">{name || 'Usuario'}</h3>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-bold uppercase">
                        <Shield size={14} />
                        {user.role}
                    </div>
                </div>

                {/* Forms */}
                <div className="md:col-span-2 space-y-8">
                    {/* Basic Info Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-8">
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <User className="text-blue-500" size={20} /> Información Personal
                        </h4>
                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre Completo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Correo Electrónico</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" />
                            </div>
                            <div className="pt-4 text-right">
                                <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 ml-auto shadow-lg shadow-blue-500/30 transition-all">
                                    <Save size={18} /> Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Security Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-8">
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Lock className="text-purple-500" size={20} /> Seguridad
                        </h4>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Contraseña Actual</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nueva Contraseña</label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none dark:text-white" />
                            </div>
                            <div className="pt-4 text-right">
                                <button type="submit" disabled={loading} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 ml-auto transition-all">
                                    <Lock size={18} /> Cambiar Contraseña
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
