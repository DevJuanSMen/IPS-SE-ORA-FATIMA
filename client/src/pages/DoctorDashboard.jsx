import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Calendar, Clock, User, Stethoscope, LogOut, Sun, Moon,
    ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Bell
} from 'lucide-react';
import LogoImage from '../../assets/Diseño sin título (9).png';
import ProfileView from '../components/ProfileView';

const API_URL = '';

export default function DoctorDashboard() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [showProfile, setShowProfile] = useState(false);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        fetchMyAppointments();
    }, []);

    const fetchMyAppointments = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/appointments`);
            // Filter to this doctor's appointments
            const mine = Array.isArray(res.data) ? res.data.filter(a => a.doctor_id === user.reference_id) : [];
            setAppointments(mine);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const todayAppts = Array.isArray(appointments) ? appointments.filter(a => a.start_datetime?.startsWith(selectedDate)) : [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = Array.isArray(appointments) ? appointments.filter(a => a.start_datetime?.startsWith(todayStr)).length : 0;
    const pendingCount = Array.isArray(appointments) ? appointments.filter(a => a.status === 'BOOKED').length : 0;
    const completedCount = Array.isArray(appointments) ? appointments.filter(a => a.status === 'COMPLETED').length : 0;

    const statusColors = {
        BOOKED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        CONFIRMED: 'bg-green-500/20 text-green-400 border-green-500/30',
        COMPLETED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
        NO_SHOW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };

    const statusLabels = {
        BOOKED: 'Programada', CONFIRMED: 'Confirmada', COMPLETED: 'Completada',
        CANCELLED: 'Cancelada', NO_SHOW: 'No se presentó'
    };

    const logout = () => { localStorage.clear(); window.location.href = '/login'; };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-[#0B1437] text-slate-800 dark:text-white transition-colors duration-300">
            {/* Header */}
            <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1635]/95 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={LogoImage} alt="Logo" className="h-10 w-auto" />
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-white text-sm">Panel Médico</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">IPS Nuestra Señora de Fátima</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        onClick={() => setShowProfile(!showProfile)}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                            {(user.full_name || user.username || 'D')[0].toUpperCase()}
                        </div>
                        <div className="text-sm">
                            <div className="font-semibold text-slate-800 dark:text-white">{user.full_name || user.username}</div>
                            <div className="text-xs text-slate-400">Médico</div>
                        </div>
                    </div>
                    <button onClick={logout}
                        className="p-2 rounded-xl hover:bg-red-500/10 transition-colors text-red-400 hover:text-red-500">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-7xl mx-auto">
                {showProfile ? (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <ProfileView user={user} onUpdateUser={setUser} />
                    </div>
                ) : (
                    <>
                        {/* Welcome */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Bienvenido, Dr. {user.full_name || user.username} 👨‍⚕️
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {[
                                { label: 'Citas Hoy', value: todayCount, icon: Calendar, color: '#446DF5', bg: 'rgba(68,109,245,0.12)' },
                                { label: 'Pendientes', value: pendingCount, icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                                { label: 'Completadas', value: completedCount, icon: CheckCircle, color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
                            ].map(({ label, value, icon: Icon, color, bg }) => (
                                <div key={label} className="rounded-2xl p-5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2.5 rounded-xl" style={{ background: bg }}>
                                            <Icon size={20} style={{ color }} />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Appointments for selected date */}
                        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-200 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                    <Calendar size={20} className="text-blue-500" /> Mis Citas
                                </h3>
                                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                    className="px-3 py-2 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white outline-none" />
                            </div>
                            <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                {loading ? (
                                    <div className="p-8 text-center text-slate-400">
                                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                                        Cargando...
                                    </div>
                                ) : todayAppts.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">
                                        <Calendar size={40} className="mx-auto mb-2 opacity-30" />
                                        <p>No hay citas para esta fecha</p>
                                    </div>
                                ) : (
                                    todayAppts.map(apt => (
                                        <div key={apt.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                    <User size={16} className="text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{apt.patient_name}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {new Date(apt.start_datetime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })}
                                                        {apt.specialty_name && ` · ${apt.specialty_name}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[apt.status] || 'bg-slate-200 text-slate-600'}`}>
                                                {statusLabels[apt.status] || apt.status}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
