import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Calendar, MessageCircle, Image, X, Send, Bot, LogOut,
    Sun, Moon, Bell, CheckCircle, ChevronDown, ChevronUp, User, Upload, Plus
} from 'lucide-react';
import LogoImage from '../../assets/Diseño sin título (9).png';
import ProfileView from '../components/ProfileView';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function PatientDashboard() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [appointments, setAppointments] = useState([]);
    const [results, setResults] = useState([]);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [showChatbot, setShowChatbot] = useState(false);
    const [faqs, setFaqs] = useState([]);
    const [chatView, setChatView] = useState('faqs'); // 'faqs' | 'suggestion'
    const [suggestion, setSuggestion] = useState('');
    const [suggestionSent, setSuggestionSent] = useState(false);
    const [myMessages, setMyMessages] = useState([]);
    const [expandedFaq, setExpandedFaq] = useState(null);
    const [unreadReplies, setUnreadReplies] = useState(0);
    const [viewingImage, setViewingImage] = useState(null);
    const [activeTab, setActiveTab] = useState('appointments');

    // Upload Results States
    const [uploadModal, setUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadName, setUploadName] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);

    // Booking States
    const [bookingModal, setBookingModal] = useState(false);
    const [specialties, setSpecialties] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [bookingData, setBookingData] = useState({ specialty_id: '', doctor_id: '', date: '', start_datetime: '' });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [bookingLoading, setBookingLoading] = useState(false);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        fetchFaqs();
        if (user.reference_id) {
            fetchAppointments();
            fetchResults();
            fetchMyMessages();
            fetchUnreadReplies();
        }
    }, []);

    const fetchFaqs = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/chatbot/faqs`);
            setFaqs(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchAppointments = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/appointments`);
            const mine = res.data.filter(a => a.patient_id === user.reference_id);
            setAppointments(mine);
        } catch (err) { console.error(err); }
    };

    const fetchResults = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/results/patient/${user.reference_id}`);
            setResults(res.data);
        } catch (err) { }
    };

    const fetchMyMessages = async () => {
        if (!user.reference_id) return;
        try {
            const res = await axios.get(`${API_URL}/api/chatbot/messages/patient/${user.reference_id}`);
            setMyMessages(res.data);
        } catch (err) { }
    };

    const fetchUnreadReplies = async () => {
        if (!user.reference_id) return;
        try {
            const res = await axios.get(`${API_URL}/api/chatbot/messages/patient/${user.reference_id}/unread`);
            setUnreadReplies(res.data.count);
        } catch (err) { }
    };

    const viewImage = async (id) => {
        try {
            const res = await axios.get(`${API_URL}/api/results/${id}`);
            setViewingImage(res.data);
        } catch (err) { alert('Error al cargar resultado'); }
    };

    const sendSuggestion = async () => {
        if (!suggestion.trim()) return;
        try {
            await axios.post(`${API_URL}/api/chatbot/messages`, {
                patient_id: user.reference_id || null,
                patient_name: user.full_name || user.username,
                message: suggestion
            });
            setSuggestionSent(true);
            setSuggestion('');
            fetchMyMessages();
        } catch (err) { alert('Error al enviar mensaje'); }
    };

    // Upload Results Logic
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadFile(file);
        setUploadName(file.name);
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                await axios.post(`${API_URL}/api/results`, {
                    patient_id: user.reference_id,
                    file_name: uploadName,
                    file_data: e.target.result,
                    mime_type: uploadFile.type
                });
                setUploadModal(false);
                setUploadFile(null);
                setUploadName('');
                fetchResults();
                alert('Perfecto, en el transcurso del día uno de nuestros asesores de laboratorio se comunicará con usted para confirmar la recepción de su orden y agendar su cita.');
            };
            reader.readAsDataURL(uploadFile);
        } catch (err) {
            alert('Error al subir documento: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    // Booking Logic
    const openBookingModal = async () => {
        setBookingModal(true);
        try {
            const [specs, docs] = await Promise.all([
                axios.get(`${API_URL}/api/specialties`),
                axios.get(`${API_URL}/api/doctors`)
            ]);
            setSpecialties(specs.data.filter(s => s.is_active));
            setDoctors(docs.data.filter(d => d.is_active));
        } catch (err) { console.error('Error fetching data for booking', err); }
    };

    const fetchAvailableSlots = async (doctorId, date, specialtyId) => {
        if (!doctorId || !date || !specialtyId) return;
        setBookingLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/appointments/availability`, {
                params: { specialtyId, date }
            });
            const data = res.data.find(d => d.doctorId === doctorId);
            setAvailableSlots(data ? data.slots : []);
        } catch (err) {
            console.error(err);
            setAvailableSlots([]);
        }
        setBookingLoading(false);
    };

    useEffect(() => {
        if (bookingData.doctor_id && bookingData.date && bookingData.specialty_id) {
            fetchAvailableSlots(bookingData.doctor_id, bookingData.date, bookingData.specialty_id);
        } else {
            setAvailableSlots([]);
        }
    }, [bookingData.doctor_id, bookingData.date, bookingData.specialty_id]);

    const handleBookingSubmit = async () => {
        if (!bookingData.start_datetime) return alert('Selecciona un horario válido');
        try {
            const res = await axios.post(`${API_URL}/api/appointments`, {
                patient_id: user.reference_id,
                doctor_id: bookingData.doctor_id,
                specialty_id: bookingData.specialty_id,
                start_datetime: bookingData.start_datetime,
                source: 'PATIENT PORTAL',
                notes: 'Agendado desde el portal de pacientes'
            });
            alert('Cita agendada exitosamente. Código: ' + res.data.confirmation_code);
            setBookingModal(false);
            setBookingData({ specialty_id: '', doctor_id: '', date: '', start_datetime: '' });
            fetchAppointments();
        } catch (err) {
            alert('Error al agendar: ' + (err.response?.data?.error || err.message));
        }
    };

    const statusColors = {
        BOOKED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        CONFIRMED: 'bg-green-500/20 text-green-400 border-green-500/30',
        COMPLETED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    const statusLabels = { BOOKED: 'Programada', CONFIRMED: 'Confirmada', COMPLETED: 'Completada', CANCELLED: 'Cancelada' };

    const logout = () => { localStorage.clear(); window.location.href = '/login'; };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-[#0B1437] text-slate-800 dark:text-white transition-colors duration-300">
            {/* Header */}
            <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1635]/95 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={LogoImage} alt="Logo" className="h-10 w-auto" />
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-white text-sm">Portal del Paciente</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">IPS Nuestra Señora de Fátima</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Bell - replies notification */}
                    {unreadReplies > 0 && (
                        <button onClick={() => { setShowChatbot(true); setChatView('myMessages'); }}
                            className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400">
                            <Bell size={18} />
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                {unreadReplies}
                            </span>
                        </button>
                    )}
                    <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        onClick={() => setActiveTab('profile')}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg, #22d3ee, #446DF5)' }}>
                            {(user.full_name || user.username || 'P')[0].toUpperCase()}
                        </div>
                        <div className="text-sm">
                            <div className="font-semibold text-slate-800 dark:text-white">{user.full_name || user.username}</div>
                            <div className="text-xs text-slate-400">Paciente</div>
                        </div>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-4xl mx-auto">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Hola, {user.full_name || user.username} 👋
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Bienvenido a tu portal de salud</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-white dark:bg-slate-800/50 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50 w-fit shadow-sm flex-wrap">
                    {[
                        { id: 'appointments', label: 'Mis Citas', icon: Calendar },
                        { id: 'results', label: 'Órdenes de Laboratorio', icon: Image },
                        { id: 'messages', label: 'Mis Mensajes', icon: MessageCircle },
                        { id: 'profile', label: 'Mi Perfil', icon: User }
                    ].map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === id
                                ? 'text-white shadow-md'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                            style={activeTab === id ? { background: 'linear-gradient(135deg, #446DF5, #7c3aed)' } : {}}>
                            <Icon size={15} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Appointments Tab */}
                {activeTab === 'appointments' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button onClick={openBookingModal} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-sm">
                                <Plus size={16} /> Nueva Cita
                            </button>
                        </div>
                        {appointments.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                                <Calendar size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                <p className="text-slate-500 dark:text-slate-400">No tienes citas registradas</p>
                            </div>
                        ) : (
                            appointments.map(apt => (
                                <div key={apt.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Calendar size={18} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-white text-sm">{apt.specialty_name || 'Consulta'}</p>
                                            <p className="text-xs text-slate-400">
                                                Dr. {apt.doctor_name} · {new Date(apt.start_datetime).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })}
                                                {' '}at {new Date(apt.start_datetime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[apt.status] || 'bg-slate-200 text-slate-500'}`}>
                                        {statusLabels[apt.status] || apt.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Results Tab */}
                {activeTab === 'results' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button onClick={() => setUploadModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-sm">
                                <Upload size={16} /> Subir Orden Médica
                            </button>
                        </div>
                        {results.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                                <Image size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                <p className="text-slate-500 dark:text-slate-400">No hay órdenes de laboratorio subidas aún</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {results.map(r => (
                                    <button key={r.id} onClick={() => viewImage(r.id)}
                                        className="p-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:border-blue-400/50 transition-all text-left">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
                                            <Image size={20} className="text-blue-400" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{r.file_name}</p>
                                        <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString('es-CO')}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Messages Tab */}
                {activeTab === 'messages' && (
                    <div className="space-y-3">
                        {myMessages.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                                <MessageCircle size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                <p className="text-slate-500 dark:text-slate-400">No has enviado ningún mensaje aún</p>
                            </div>
                        ) : (
                            myMessages.map(msg => (
                                <div key={msg.id} className="p-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString('es-CO')}</p>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${msg.status === 'REPLIED' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {msg.status === 'REPLIED' ? 'Respondido' : 'Pendiente'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-800 dark:text-white mb-2">{msg.message}</p>
                                    {msg.reply && (
                                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                            <p className="text-xs text-blue-400 font-semibold mb-1">Respuesta del equipo:</p>
                                            <p className="text-sm text-slate-800 dark:text-slate-200">{msg.reply}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <ProfileView user={user} onUpdateUser={setUser} />
                    </div>
                )}
            </main>

            {/* Chatbot floating button */}
            <button onClick={() => setShowChatbot(!showChatbot)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
                style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)', boxShadow: '0 4px 24px rgba(68,109,245,0.5)' }}>
                {showChatbot ? <X size={22} /> : <Bot size={22} />}
            </button>

            {/* Chatbot widget */}
            {showChatbot && (
                <div className="fixed bottom-24 right-6 z-50 w-80 max-h-[500px] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
                    style={{ background: '#0d1635', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {/* Bot header */}
                    <div className="p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                            <Bot size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">Asistente IPS</p>
                            <p className="text-white/70 text-xs">¿En qué te puedo ayudar?</p>
                        </div>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex border-b border-white/10">
                        {[
                            { id: 'faqs', label: 'Preguntas' },
                            { id: 'suggestion', label: 'Sugerencias' },
                            { id: 'myMessages', label: 'Mis mensajes' }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => { setChatView(tab.id); setSuggestionSent(false); }}
                                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${chatView === tab.id ? 'text-white border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {chatView === 'faqs' && (
                            faqs.length === 0
                                ? <p className="text-slate-400 text-sm text-center py-6">No hay preguntas frecuentes configuradas</p>
                                : faqs.map(faq => (
                                    <div key={faq.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <button onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                                            className="w-full p-3 text-left flex justify-between items-start gap-2">
                                            <p className="text-sm text-white font-medium">{faq.question}</p>
                                            {expandedFaq === faq.id ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />}
                                        </button>
                                        {expandedFaq === faq.id && (
                                            <div className="px-3 pb-3">
                                                <p className="text-sm text-slate-300">{faq.answer}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                        )}

                        {chatView === 'suggestion' && (
                            suggestionSent ? (
                                <div className="text-center py-6">
                                    <CheckCircle className="mx-auto mb-2 text-green-400" size={32} />
                                    <p className="text-green-400 font-semibold text-sm">¡Mensaje enviado!</p>
                                    <p className="text-slate-400 text-xs mt-1">Te responderemos pronto</p>
                                </div>
                            ) : (
                                <div className="space-y-3 py-2">
                                    <p className="text-slate-300 text-xs">Comparte tu sugerencia, comentario o queja con nuestro equipo:</p>
                                    <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)}
                                        rows={4} placeholder="Escribe aquí tu mensaje..."
                                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none text-white placeholder-slate-500"
                                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
                                    <button onClick={sendSuggestion} disabled={!suggestion.trim()}
                                        className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                        <Send size={14} /> Enviar
                                    </button>
                                </div>
                            )
                        )}

                        {chatView === 'myMessages' && (
                            myMessages.length === 0
                                ? <p className="text-slate-400 text-sm text-center py-6">No has enviado mensajes aún</p>
                                : myMessages.map(msg => (
                                    <div key={msg.id} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString('es-CO')}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${msg.status === 'REPLIED' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                {msg.status === 'REPLIED' ? '✓ Respondido' : 'Pendiente'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-white">{msg.message}</p>
                                        {msg.reply && (
                                            <div className="p-2 rounded-lg" style={{ background: 'rgba(68,109,245,0.15)', border: '1px solid rgba(68,109,245,0.3)' }}>
                                                <p className="text-xs text-blue-400 font-semibold">Respuesta:</p>
                                                <p className="text-xs text-slate-200 mt-0.5">{msg.reply}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            )}

            {/* Image viewer */}
            {viewingImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewingImage(null)}>
                    <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewingImage(null)} className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white"><X size={24} /></button>
                        <img src={viewingImage.file_data} alt={viewingImage.file_name} className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl mx-auto block" />
                        <p className="text-white/70 text-sm text-center mt-3">{viewingImage.file_name}</p>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {uploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Subir Orden Médica (Exámenes Recetados)</h3>
                            <button onClick={() => { setUploadModal(false); setUploadFile(null); setUploadName(''); }}
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre del archivo</label>
                                <input value={uploadName} onChange={e => setUploadName(e.target.value)}
                                    placeholder="Ej: Orden_Medica.jpg"
                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Documento / Imagen</label>
                                <input type="file" ref={fileRef} accept="image/*,application/pdf" onChange={handleFileSelect} className="hidden" />
                                <button onClick={() => fileRef.current?.click()}
                                    className="w-full py-8 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-slate-400 hover:text-blue-500 flex flex-col items-center gap-2">
                                    <Upload size={24} />
                                    <span className="text-sm font-medium text-center px-4">{uploadFile ? uploadFile.name : 'Haz clic para seleccionar imagen o PDF'}</span>
                                </button>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setUploadModal(false); setUploadFile(null); setUploadName(''); }}
                                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={handleUpload} disabled={!uploadFile || uploading}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                    {uploading ? 'Subiendo...' : 'Subir'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Booking Modal */}
            {bookingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Agendar Nueva Cita</h3>
                            <button onClick={() => { setBookingModal(false); setBookingData({ specialty_id: '', doctor_id: '', date: '', start_datetime: '' }); }}
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">1. Especialidad</label>
                                <select
                                    value={bookingData.specialty_id}
                                    onChange={e => setBookingData({ ...bookingData, specialty_id: e.target.value, doctor_id: '', start_datetime: '' })}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white outline-none"
                                >
                                    <option value="">Selecciona una especialidad...</option>
                                    {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            {bookingData.specialty_id && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">2. Médico</label>
                                    <select
                                        value={bookingData.doctor_id}
                                        onChange={e => setBookingData({ ...bookingData, doctor_id: e.target.value, start_datetime: '' })}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white outline-none"
                                    >
                                        <option value="">Selecciona un médico...</option>
                                        {doctors.filter(d => d.specialty_id === bookingData.specialty_id).map(d => (
                                            <option key={d.id} value={d.id}>{d.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {bookingData.doctor_id && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">3. Fecha</label>
                                    <input
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={bookingData.date}
                                        onChange={e => setBookingData({ ...bookingData, date: e.target.value, start_datetime: '' })}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white outline-none"
                                    />
                                </div>
                            )}

                            {bookingData.date && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">4. Horario Disponible</label>
                                    {bookingLoading ? (
                                        <p className="text-sm text-slate-500">Cargando horarios...</p>
                                    ) : availableSlots.length === 0 ? (
                                        <p className="text-sm text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-200 dark:border-red-500/20">No hay horarios disponibles para esta fecha.</p>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {availableSlots.map(slot => (
                                                <button
                                                    key={slot.datetime}
                                                    onClick={() => setBookingData({ ...bookingData, start_datetime: slot.datetime })}
                                                    className={`py-2 rounded-xl text-sm font-medium transition-all ${bookingData.start_datetime === slot.datetime
                                                        ? 'bg-blue-600 text-white shadow-md border-blue-600'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'}`}
                                                >
                                                    {slot.time}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button onClick={() => { setBookingModal(false); setBookingData({ specialty_id: '', doctor_id: '', date: '', start_datetime: '' }); }}
                                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={handleBookingSubmit} disabled={!bookingData.start_datetime}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                    Agendar Cita
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
