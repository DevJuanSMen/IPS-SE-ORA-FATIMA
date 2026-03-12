import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LogOut, Sun, Moon, FolderOpen, Image, Upload, X, ChevronLeft, Search, Trash2, Eye } from 'lucide-react';
import LogoImage from '../../assets/Diseño sin título (9).png';
import ProfileView from '../components/ProfileView';

const API_URL = '';

export default function LabDashboard() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [showProfile, setShowProfile] = useState(false);
    const [folders, setFolders] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingImage, setViewingImage] = useState(null);
    const [uploadModal, setUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadName, setUploadName] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => { fetchFolders(); }, []);

    const fetchFolders = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/results/folders`);
            setFolders(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const openFolder = async (patient) => {
        setSelectedPatient(patient);
        try {
            const res = await axios.get(`${API_URL}/api/results/patient/${patient.id}`);
            setResults(res.data);
        } catch (err) { console.error(err); }
    };

    const viewFull = async (resultId) => {
        try {
            const res = await axios.get(`${API_URL}/api/results/${resultId}`);
            setViewingImage(res.data);
        } catch (err) { alert('Error al cargar imagen'); }
    };

    const deleteResult = async (id) => {
        if (!confirm('¿Eliminar este resultado?')) return;
        try {
            await axios.delete(`${API_URL}/api/results/${id}`);
            setResults(r => r.filter(x => x.id !== id));
            fetchFolders();
        } catch (err) { alert('Error al eliminar'); }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadFile(file);
        setUploadName(file.name);
    };

    const handleUpload = async () => {
        if (!uploadFile || !selectedPatient) return;
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result; // full data URL: "data:image/jpeg;base64,..."
                const mimeType = uploadFile.type;
                await axios.post(`${API_URL}/api/results`, {
                    patient_id: selectedPatient.id,
                    file_name: uploadName,
                    file_data: base64Data,
                    mime_type: mimeType
                });
                setUploadModal(false);
                setUploadFile(null);
                setUploadName('');
                openFolder(selectedPatient);
                fetchFolders();
            };
            reader.readAsDataURL(uploadFile);
        } catch (err) {
            alert('Error al subir: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const filteredFolders = folders.filter(f =>
        f.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.phone?.includes(searchTerm) ||
        f.document_id?.includes(searchTerm)
    );

    const logout = () => { localStorage.clear(); window.location.href = '/login'; };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-[#0B1437] text-slate-800 dark:text-white transition-colors duration-300">
            {/* Header */}
            <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1635]/95 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={LogoImage} alt="Logo" className="h-10 w-auto" />
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-white text-sm">Laboratorio Clínico</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Gestión de Resultados</p>
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
                            style={{ background: 'linear-gradient(135deg, #22d3ee, #446DF5)' }}>
                            {(user.full_name || user.username || 'L')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">{user.full_name || user.username}</span>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-7xl mx-auto">
                {showProfile ? (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <ProfileView user={user} onUpdateUser={setUser} />
                    </div>
                ) : !selectedPatient ? (
                    /* Patient list / folders */
                    <>
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Carpetas de Pacientes 📁</h2>
                                <p className="text-sm text-slate-400 mt-1">{folders.length} pacientes registrados</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar paciente..."
                                    className="pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none shadow-sm" />
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {filteredFolders.map(folder => (
                                    <button key={folder.id} onClick={() => openFolder(folder)}
                                        className="group p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-all text-left">
                                        <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform"
                                            style={{ background: 'rgba(245,158,11,0.12)' }}>
                                            <FolderOpen size={28} />
                                        </div>
                                        <p className="font-semibold text-slate-800 dark:text-white text-sm leading-tight mb-1 line-clamp-2">{folder.full_name}</p>
                                        <p className="text-xs text-slate-400">{folder.phone}</p>
                                        <div className="mt-2 flex items-center gap-1">
                                            <Image size={12} className="text-blue-400" />
                                            <span className="text-xs text-blue-400 font-semibold">{folder.result_count} resultados</span>
                                        </div>
                                    </button>
                                ))}
                                {filteredFolders.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-slate-400">
                                        <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
                                        <p>No hay pacientes</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    /* Patient results */
                    <>
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedPatient(null)}
                                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400">
                                    <ChevronLeft size={18} />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedPatient.full_name}</h2>
                                    <p className="text-sm text-slate-400">{selectedPatient.phone} · CC: {selectedPatient.document_id || 'N/A'}</p>
                                </div>
                            </div>
                            <button onClick={() => setUploadModal(true)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
                                style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                <Upload size={16} /> Subir Resultado
                            </button>
                        </div>

                        {results.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                                <Image size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                <p className="text-slate-500 dark:text-slate-400">No hay resultados subidos para este paciente</p>
                                <button onClick={() => setUploadModal(true)}
                                    className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                    style={{ background: 'linear-gradient(135deg, #446DF5, #7c3aed)' }}>
                                    Subir primer resultado
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {results.map(r => (
                                    <div key={r.id} className="group rounded-2xl overflow-hidden bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-lg transition-all">
                                        <div className="aspect-video bg-slate-100 dark:bg-slate-700 flex items-center justify-center relative">
                                            <Image size={32} className="text-slate-300 dark:text-slate-500" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button onClick={() => viewFull(r.id)}
                                                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
                                                    <Eye size={16} />
                                                </button>
                                                <button onClick={() => deleteResult(r.id)}
                                                    className="p-2 rounded-full bg-red-500/30 hover:bg-red-500/50 text-white transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{r.file_name}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleDateString('es-CO')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Image viewer modal */}
            {viewingImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setViewingImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewingImage(null)}
                            className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                        <img src={viewingImage.file_data} alt={viewingImage.file_name}
                            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl mx-auto block" />
                        <p className="text-white/70 text-sm text-center mt-3">{viewingImage.file_name}</p>
                    </div>
                </div>
            )}

            {/* Upload modal */}
            {uploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Subir Resultado</h3>
                            <button onClick={() => { setUploadModal(false); setUploadFile(null); setUploadName(''); }}
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Paciente</label>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedPatient?.full_name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre del archivo</label>
                                <input value={uploadName} onChange={e => setUploadName(e.target.value)}
                                    placeholder="Ej: Hemograma_2025.jpg"
                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Imagen</label>
                                <input type="file" ref={fileRef} accept="image/*" onChange={handleFileSelect} className="hidden" />
                                <button onClick={() => fileRef.current?.click()}
                                    className="w-full py-8 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-slate-400 hover:text-blue-500 flex flex-col items-center gap-2">
                                    <Upload size={24} />
                                    <span className="text-sm font-medium">{uploadFile ? uploadFile.name : 'Haz clic para seleccionar imagen'}</span>
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
        </div>
    );
}
