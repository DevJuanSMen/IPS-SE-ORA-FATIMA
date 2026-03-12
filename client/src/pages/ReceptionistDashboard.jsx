import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
    MessageSquare, Send, Power, Search, Bell, LogOut,
    Sun, Moon, ChevronLeft, User, RefreshCw
} from 'lucide-react';
import LogoImage from '../../assets/Diseño sin título (9).png';
import ProfileView from '../components/ProfileView';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const socket = io(API_URL);

export default function ReceptionistDashboard() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [pendingCount, setPendingCount] = useState(0);
    const [showInbox, setShowInbox] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [inbox, setInbox] = useState([]);
    const [replyText, setReplyText] = useState({});
    const messagesEndRef = useRef(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        fetchChats();
        fetchPendingCount();
        const interval = setInterval(() => { fetchChats(); fetchPendingCount(); }, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedChat) {
            fetchMessages(selectedChat.phone);
            const interval = setInterval(() => fetchMessages(selectedChat.phone), 3000);
            return () => clearInterval(interval);
        }
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        socket.on('new_message', () => { fetchChats(); if (selectedChat) fetchMessages(selectedChat.phone); });
        return () => socket.off('new_message');
    }, [selectedChat]);

    const fetchChats = async () => {
        try {
            const res = await axios.get(`${API_URL} /api/chats`);
            setChats(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchMessages = async (phone) => {
        try {
            const res = await axios.get(`${API_URL} /api/chats / ${phone}/messages`);
            setMessages(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchPendingCount = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/chatbot/messages/pending-count`);
            setPendingCount(res.data.count);
        } catch (err) { }
    };

    const fetchInbox = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/chatbot/messages`);
            setInbox(res.data);
        } catch (err) { console.error(err); }
    };

    const openInbox = () => { setShowInbox(true); fetchInbox(); };

    const sendReply = async (msgId) => {
        if (!replyText[msgId]?.trim()) return;
        try {
            await axios.put(`${API_URL}/api/chatbot/messages/${msgId}/reply`, { reply: replyText[msgId] });
            setReplyText(p => ({ ...p, [msgId]: '' }));
            fetchInbox();
            fetchPendingCount();
        } catch (err) { alert('Error al responder'); }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;
        try {
            await axios.post(`${API_URL}/api/chats/${selectedChat.phone}/send`, { body: newMessage });
            setNewMessage('');
            fetchMessages(selectedChat.phone);
        } catch (err) { alert('Error al enviar: ' + err.message); }
    };

    const toggleBot = async (phone, active) => {
        try {
            await axios.post(`${API_URL}/api/chats/${phone}/toggle-bot`, { active });
            setSelectedChat(p => ({ ...p, is_bot_active: active }));
            fetchChats();
        } catch (err) { alert('Error'); }
    };

    const filteredChats = chats.filter(c =>
        c.phone?.includes(searchTerm) || c.last_message?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const logout = () => { localStorage.clear(); window.location.href = '/login'; };

    return (
        <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#0B1437] transition-colors duration-300" style={{ height: '100vh' }}>
            {/* Header */}
            <header className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1635]/95 backdrop-blur-sm z-40 shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={LogoImage} alt="Logo" className="h-10 w-auto" />
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-white text-sm">Atención al Cliente</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Chats de WhatsApp</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Bell notification */}
                    <button onClick={openInbox}
                        className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400">
                        <Bell size={18} />
                        {pendingCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                {pendingCount > 9 ? '9+' : pendingCount}
                            </span>
                        )}
                    </button>
                    <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        onClick={() => setShowProfile(!showProfile)}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                            {(user.full_name || user.username || 'R')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">{user.full_name || user.username}</span>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            {showProfile ? (
                <main className="p-6 max-w-7xl mx-auto flex-1 overflow-auto w-full">
                    <div className="animate-in fade-in zoom-in duration-300">
                        <ProfileView user={user} onUpdateUser={setUser} />
                    </div>
                </main>
            ) : (
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-72 flex-shrink-0 flex flex-col bg-white dark:bg-[#0d1635]/80 border-r border-slate-200 dark:border-slate-800">
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar conversación..."
                                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white outline-none border border-slate-200 dark:border-slate-700" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredChats.map(chat => (
                                <div key={chat.phone}
                                    onClick={() => { setSelectedChat(chat); fetchMessages(chat.phone); }}
                                    className={`p-3 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800 ${selectedChat?.phone === chat.phone ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/3'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-shrink-0 w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <MessageSquare size={16} className="text-green-500" />
                                            {chat.advisor_requested && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">{chat.phone}</p>
                                            <p className="text-xs text-slate-400 truncate">{chat.last_message}</p>
                                        </div>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${chat.is_bot_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                            {chat.is_bot_active ? 'BOT' : 'Manual'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {filteredChats.length === 0 && (
                                <div className="p-6 text-center text-slate-400 text-sm">
                                    <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                                    No hay conversaciones
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Message Area */}
                    <div className="flex-1 flex flex-col">
                        {selectedChat ? (
                            <>
                                {/* Chat header */}
                                <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1635]/60 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setSelectedChat(null)} className="text-slate-400 hover:text-white transition-colors lg:hidden">
                                            <ChevronLeft size={20} />
                                        </button>
                                        <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <MessageSquare size={16} className="text-green-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white text-sm">{selectedChat.phone}</p>
                                            <p className="text-xs text-slate-400">WhatsApp</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400">Bot:</span>
                                        <button onClick={() => toggleBot(selectedChat.phone, !selectedChat.is_bot_active)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selectedChat.is_bot_active ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-green-500/20 hover:text-green-400'}`}>
                                            <Power size={12} />
                                            {selectedChat.is_bot_active ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </div>
                                </div>
                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${msg.from_me
                                                ? 'bg-blue-600 text-white rounded-tr-sm'
                                                : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-tl-sm border border-slate-200 dark:border-slate-600'}`}>
                                                <p>{msg.body}</p>
                                                <p className={`text-[10px] mt-1 ${msg.from_me ? 'text-blue-200' : 'text-slate-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                {/* Send */}
                                <form onSubmit={handleSend} className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1635]/60 flex gap-2">
                                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Escribe un mensaje..."
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white outline-none border border-slate-200 dark:border-slate-700" />
                                    <button type="submit" className="p-2.5 rounded-xl text-white transition-colors"
                                        style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                        <Send size={18} />
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                <MessageSquare size={64} className="opacity-20 mb-4" />
                                <p className="font-medium">Selecciona una conversación</p>
                                <p className="text-sm opacity-60">para ver los mensajes</p>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* Inbox Modal */}
            {showInbox && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <Bell size={20} className="text-blue-500" /> Buzón de Sugerencias
                            </h3>
                            <button onClick={() => setShowInbox(false)}
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors">✕</button>
                        </div>
                        <div className="p-4 space-y-4">
                            {inbox.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">No hay mensajes en el buzón</div>
                            ) : (
                                inbox.map(msg => (
                                    <div key={msg.id} className={`rounded-xl p-4 border ${msg.status === 'PENDING' ? 'border-amber-500/30 bg-amber-50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30'}`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-white text-sm">{msg.patient_name}</p>
                                                <p className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString('es-CO')}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${msg.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'}`}>
                                                {msg.status === 'PENDING' ? 'Pendiente' : 'Respondido'}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 dark:text-slate-300 text-sm mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">{msg.message}</p>
                                        {msg.reply ? (
                                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                                <p className="text-xs text-blue-400 font-semibold mb-1">Tu respuesta:</p>
                                                <p className="text-sm text-slate-800 dark:text-slate-200">{msg.reply}</p>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <input value={replyText[msg.id] || ''} onChange={e => setReplyText(p => ({ ...p, [msg.id]: e.target.value }))}
                                                    placeholder="Escribe una respuesta..."
                                                    className="flex-1 px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white outline-none" />
                                                <button onClick={() => sendReply(msg.id)}
                                                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                                                    style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                                    Responder
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
