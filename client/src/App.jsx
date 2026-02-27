import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { QRCodeCanvas } from 'qrcode.react';
import {
    MessageSquare,
    CheckCircle,
    RefreshCw,
    Users,
    Stethoscope,
    Calendar,
    LayoutDashboard,
    Plus,
    Trash2,
    Edit,
    X,
    AlertCircle,
    ArrowLeft,
    Search,
    Lock,
    Power,
    Check,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Building2,
    Briefcase,
    Eye,
    Moon,
    Sun,
    User,
    Clock,
    Mail
} from 'lucide-react';
import axios from 'axios';
import LogoImage from '../assets/Diseño sin título (9).png';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
    const [qrCode, setQrCode] = useState('');
    const [status, setStatus] = useState('disconnected'); // disconnected, connecting, qr, ready, error
    const [errorMsg, setErrorMsg] = useState('');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showPoliciesModal, setShowPoliciesModal] = useState(false);
    const [specialties, setSpecialties] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState([]);

    // Admin Sub Tabs
    const [activeAdminSubTab, setActiveAdminSubTab] = useState('services');

    // Modals
    const [showSpecialtyModal, setShowSpecialtyModal] = useState(false);
    const [currentSpecialty, setCurrentSpecialty] = useState(null);
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [currentDoctor, setCurrentDoctor] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [doctorSchedules, setDoctorSchedules] = useState([]);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [doctorBlocks, setDoctorBlocks] = useState([]);
    const [showAppointmentModal, setShowAppointmentModal] = useState(false);
    const [currentAppointment, setCurrentAppointment] = useState(null);
    const [isSpecialSchedule, setIsSpecialSchedule] = useState(false);
    const [selectedSpecialDates, setSelectedSpecialDates] = useState([]);
    const [selectedScheduleDays, setSelectedScheduleDays] = useState([1, 2, 3, 4, 5]); // Default L-V
    const [specialMonthDate, setSpecialMonthDate] = useState(new Date());
    const [viewingSpecialDates, setViewingSpecialDates] = useState(null);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingStep, setBookingStep] = useState(1);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingSlots, setBookingSlots] = useState([]);
    const [bookingData, setBookingData] = useState({
        phone: '',
        full_name: '',
        document_id: '',
        entidad: '',
        regimen: '',
        auth_number: '',
        service_id: '',
        specialty_id: '',
        doctor_id: '',
        start_datetime: '',
        is_new_patient: false,
        catalog_item: null,
        consultation_type: 'PRIMERA VEZ'
    });

    const [catalogs, setCatalogs] = useState({ Ecografias: [], Radiografias: [] });

    // Availability State
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [availabilityDate, setAvailabilityDate] = useState(new Date().toISOString().split('T')[0]);

    // Attendance Validation State
    const [codeToValidate, setCodeToValidate] = useState('');
    const [validationResult, setValidationResult] = useState(null);

    // Calendar State
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

    // Theme State
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'dark';
        }
        return 'dark';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Chat State
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to server');
        });

        socket.on('status_sync', (data) => {
            console.log('Status sync:', data);
            setStatus(data.status);
            if (data.message) setErrorMsg(data.message);
        });

        socket.on('qr', (qr) => {
            setQrCode(qr);
            setStatus('qr');
        });

        socket.on('ready', () => {
            setStatus('ready');
            setQrCode('');
        });

        return () => {
            socket.off('connect');
            socket.off('status_sync');
            socket.off('qr');
            socket.off('ready');
        };
    }, []);

    useEffect(() => {
        const handleNewMessage = (msgData) => {
            console.log('New message received via socket:', msgData);
            fetchChats();
            if (activeTab === 'chat' && selectedChat && selectedChat.phone === msgData.phone) {
                fetchMessages(selectedChat.phone);
            }
        };

        socket.on('new_message', handleNewMessage);
        return () => socket.off('new_message', handleNewMessage);
    }, [activeTab, selectedChat]);

    useEffect(() => {
        // Fetch all data on initial mount for dashboard stats
        fetchAllData();
    }, []);

    const fetchAllData = () => {
        fetchServices();
        fetchSpecialties();
        fetchDoctors();
        fetchAppointments();
        fetchCatalogs();
    };

    const fetchCatalogs = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/catalog`);
            setCatalogs(res.data);
        } catch (err) {
            console.error('Error fetching catalogs:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'specialties') {
            fetchServices();
            fetchSpecialties();
        }
        if (activeTab === 'doctors') {
            fetchDoctors();
            fetchSpecialties();
        }
        if (activeTab === 'appointments') {
            fetchAppointments();
        }
        if (activeTab === 'chat') {
            fetchChats();
        }
    }, [activeTab]);

    useEffect(() => {
        let interval;
        if (activeTab === 'chat' && !selectedChat) {
            interval = setInterval(fetchChats, 5000);
        }
        if (activeTab === 'chat' && selectedChat) {
            interval = setInterval(() => fetchMessages(selectedChat.phone), 3000);
        }
        return () => clearInterval(interval);
    }, [activeTab, selectedChat]);

    const fetchServices = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/services`, { headers: { Authorization: `Bearer ${token}` } });
            setServices(res.data);
        } catch (error) {
            console.error('Error fetching services', error);
        }
    };

    const fetchSpecialties = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/specialties`);
            setSpecialties(res.data);
        } catch (err) {
            console.error('Error fetching specialties:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDoctors = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/doctors`);
            setDoctors(res.data);
        } catch (err) {
            console.error('Error fetching doctors:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/appointments`);
            setAppointments(res.data);
        } catch (err) {
            console.error('Error fetching appointments:', err);
        } finally {
            setLoading(false);
        }
    };

    // Dashboard Derived Data
    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments.filter(a => a.start_datetime.startsWith(today));

    // Simple Chart Data (Last 7 days)
    const getLast7Days = () => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const shortName = d.toLocaleDateString('es-ES', { weekday: 'short' });
            const count = appointments.filter(a => a.start_datetime.startsWith(dateStr)).length;
            days.push({ day: shortName, count, date: dateStr });
        }
        return days;
    };
    const chartData = getLast7Days();
    const maxChartValue = Math.max(...chartData.map(d => d.count), 5); // Base max 5 for scale

    const fetchChats = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/chats`);
            setChats(res.data);
        } catch (err) {
            console.error('Error fetching chats:', err);
        }
    };

    const fetchMessages = async (phone) => {
        try {
            const res = await axios.get(`${API_URL}/api/chats/${phone}/messages`);
            setMessages(res.data);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    // Calendar Helper Functions
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const generateCalendarDays = () => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        const days = [];
        // Padding for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push({ day: null });
        }
        // Days of current month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayApts = appointments.filter(a => a.start_datetime.startsWith(dateStr));
            days.push({ day: i, date: dateStr, appointments: dayApts });
        }
        return days;
    };

    const handleMonthChange = (increment) => {
        const newDate = new Date(currentCalendarDate);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentCalendarDate(newDate);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        try {
            await axios.post(`${API_URL}/api/chats/${selectedChat.phone}/send`, { body: newMessage });
            setNewMessage('');
            fetchMessages(selectedChat.phone);
            fetchChats();
        } catch (err) {
            alert('Error al enviar: ' + err.message);
        }
    };

    const toggleBot = async (phone, active) => {
        try {
            await axios.post(`${API_URL}/api/chats/${phone}/toggle-bot`, { active });
            const updated = { ...selectedChat, is_bot_active: active };
            setSelectedChat(updated);
            fetchChats();
        } catch (err) {
            alert('Error al cambiar estado del bot: ' + err.message);
        }
    };

    const handleSaveService = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            is_active: true
        };

        try {
            if (currentService) {
                await axios.put(`${API_URL}/api/services/${currentService.id}`, data);
            } else {
                await axios.post(`${API_URL}/api/services`, data);
            }
            setShowServiceModal(false);
            fetchServices();
        } catch (err) {
            alert('Error al guardar servicio: ' + err.message);
        }
    };

    const handleToggleServiceStatus = async (service) => {
        try {
            await axios.put(`${API_URL}/api/services/${service.id}`, { ...service, is_active: !service.is_active });
            fetchServices();
        } catch (err) {
            alert('Error al desactivar servicio: ' + err.message);
        }
    };

    const handleSaveSpecialty = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            description: formData.get('description'),
            duration_minutes: parseInt(formData.get('duration_minutes')) || 30,
            capacity: parseInt(formData.get('capacity')) || 1,
            service_id: formData.get('service_id') || null,
            is_active: true
        };

        try {
            if (currentSpecialty) {
                await axios.put(`${API_URL}/api/specialties/${currentSpecialty.id}`, data);
            } else {
                await axios.post(`${API_URL}/api/specialties`, data);
            }
            setShowSpecialtyModal(false);
            fetchSpecialties();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        }
    };

    const handleToggleSpecialtyStatus = async (specialty) => {
        try {
            await axios.put(`${API_URL}/api/specialties/${specialty.id}`, { ...specialty, is_active: !specialty.is_active });
            fetchSpecialties();
        } catch (err) {
            alert('Error al modificar estado: ' + err.message);
        }
    };

    const handleSaveDoctor = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            full_name: formData.get('full_name'),
            specialty_id: formData.get('specialty_id'),
            phone: formData.get('phone'),
            is_active: true
        };

        try {
            if (currentDoctor) {
                await axios.put(`${API_URL}/api/doctors/${currentDoctor.id}`, data);
            } else {
                await axios.post(`${API_URL}/api/doctors`, data);
            }
            setShowDoctorModal(false);
            fetchDoctors();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        }
    };

    const handleDeleteDoctor = async (id) => {
        if (!confirm('¿Estás seguro de desactivar este médico?')) return;
        try {
            await axios.delete(`${API_URL}/api/doctors/${id}`);
            fetchDoctors();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    const fetchDoctorSchedules = async (doctorId) => {
        try {
            const res = await axios.get(`${API_URL}/api/doctors/${doctorId}/schedules`);
            setDoctorSchedules(res.data);
        } catch (err) {
            console.error('Error fetching schedules:', err);
        }
    };

    const fetchDoctorBlocks = async (doctorId) => {
        try {
            const res = await axios.get(`${API_URL}/api/doctors/${doctorId}/blocks`);
            setDoctorBlocks(res.data);
        } catch (err) {
            console.error('Error fetching blocks:', err);
        }
    };

    const handleSaveBlock = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            doctor_id: currentDoctor.id,
            date: formData.get('date'),
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            reason: formData.get('reason')
        };

        try {
            await axios.post(`${API_URL}/api/doctors/blocks`, data);
            fetchDoctorBlocks(currentDoctor.id);
            e.target.reset();
        } catch (err) {
            alert('Error al guardar bloqueo: ' + err.message);
        }
    };

    const handleDeleteBlock = async (id) => {
        try {
            await axios.delete(`${API_URL}/api/doctors/blocks/${id}`);
            fetchDoctorBlocks(currentDoctor.id);
        } catch (err) {
            alert('Error al eliminar bloqueo: ' + err.message);
        }
    };

    const handleToggleDoctorStatus = async (doctor) => {
        if (!confirm(`¿${doctor.is_active ? 'Desactivar' : 'Activar'} al médico ${doctor.full_name}?`)) return;
        try {
            await axios.put(`${API_URL}/api/doctors/${doctor.id}`, { ...doctor, is_active: !doctor.is_active });
            fetchDoctors();
        } catch (err) {
            alert('Error al cambiar estado: ' + err.message);
        }
    };



    const handlePatientLookup = async (phone) => {
        if (phone.length < 7) return;
        try {
            const res = await axios.get(`${API_URL}/api/patients?search=${phone}`);
            if (res.data.length > 0) {
                // Patient exists
                const p = res.data.find(pat => pat.phone.includes(phone)) || res.data[0];
                setBookingData(prev => ({
                    ...prev,
                    full_name: p.full_name,
                    is_new_patient: false,
                    patient_id: p.id
                }));
            } else {
                // New patient
                setBookingData(prev => ({
                    ...prev,
                    full_name: '',
                    is_new_patient: true,
                    patient_id: null
                }));
            }
        } catch (err) {
            console.error('Error lookup patient:', err);
        }
    };

    const fetchAvailability = async (doctorId, date) => {
        try {
            // Find specialty_id from doctor
            const doctor = doctors.find(d => d.id === doctorId);
            if (!doctor) return;

            setLoading(true);
            const res = await axios.get(`${API_URL}/api/appointments/availability`, {
                params: { specialtyId: doctor.specialty_id, date }
            });
            // Result is array of { doctorId, doctorName, slots: [] }
            // Since we asked for specific doctor, we expect one entry or empty
            const data = res.data.find(d => d.doctorId === doctorId);
            setAvailableSlots(data ? data.slots : []);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const fetchBookingSlots = async (doctorId, date) => {
        try {
            const doctor = doctors.find(d => d.id === doctorId);
            if (!doctor) return;
            const res = await axios.get(`${API_URL}/api/appointments/availability`, {
                params: { specialtyId: doctor.specialty_id, date }
            });
            const data = res.data.find(d => d.doctorId === doctorId);
            setBookingSlots(data ? data.slots : []);
        } catch (err) {
            console.error(err);
            setBookingSlots([]);
        }
    };

    const handleValidateCode = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/api/appointments/validate-code`, {
                code: codeToValidate
            });
            setValidationResult({ success: true, message: res.data.message, appointment: res.data.appointment });
            setCodeToValidate('');
            fetchAppointments(); // Refresh lists
        } catch (err) {
            setValidationResult({ success: false, message: err.response?.data?.error || 'Error al validar código' });
        }
    };

    const handleNextStep = () => {
        if (bookingStep === 1) {
            setBookingStep(2);
        } else if (bookingStep === 2) {
            if (!bookingData.entidad) {
                alert('Por favor seleccione una entidad o tipo de afiliación.');
                return;
            }
            if (['ALIANZA SALUD', 'COMPENSAR'].includes(bookingData.entidad) && !bookingData.regimen) {
                alert('Por favor seleccione su régimen.');
                return;
            }
            if (['ALIANZA SALUD', 'COMPENSAR', 'MEDICINA PREPAGADA'].includes(bookingData.entidad)) {
                if (!isValidAuthNumber(bookingData.auth_number)) {
                    alert('Por favor ingrese un número de autorización válido (no secuenciales ni repetidos simples).');
                    return;
                }
            }
            setBookingStep(3);
        }
    };

    const handlePrevStep = () => {
        setBookingStep(prev => prev - 1);
    };

    const isValidAuthNumber = (val) => {
        if (!val || val.length < 5) return false;
        if (/^(\d)\1+$/.test(val)) return false; // same chars e.g. 11111
        if (/\b(?:0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)\d*\b/.test(val)) return false;
        return true;
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();

        // At step 1 or 2, just go next
        if (bookingStep < 3) {
            handleNextStep();
            return;
        }

        if (!bookingData.start_datetime) {
            alert('Por favor selecciona una fecha y un horario disponible.');
            return;
        }

        try {
            let patientId = bookingData.patient_id;

            // 1. Create patient if new
            if (bookingData.is_new_patient) {
                const pRes = await axios.post(`${API_URL}/api/patients`, {
                    full_name: bookingData.full_name,
                    phone: bookingData.phone,
                    document_id: bookingData.document_id
                });
                patientId = pRes.data.id;
            }

            // 2. Create Appointment
            if (!patientId) throw new Error('Error identificando al paciente');

            const apRes = await axios.post(`${API_URL}/api/appointments`, {
                patient_id: patientId,
                doctor_id: bookingData.doctor_id,
                specialty_id: bookingData.specialty_id,
                start_datetime: bookingData.start_datetime,
                source: 'ADMIN', // Explicitly mark as Admin booking
                total_price: bookingData.entidad === 'PARTICULAR' && bookingData.catalog_item ? bookingData.catalog_item.price : null,
                notes: JSON.stringify({ entidad: bookingData.entidad, regimen: bookingData.regimen, autorizacion: bookingData.auth_number, consultation_type: bookingData.consultation_type })
            });

            // 3. Show Success & Recommendations
            let successMsg = `Cita agendada con éxito.\nCódigo de Cita: ${apRes.data.confirmation_code}\n`;

            if (bookingData.regimen === 'SUBSIDIADO') {
                successMsg += `\nAl ser régimen Subsidiado, el pago en ventanilla es $ 0 (Sin cobro).\n`;
            } else if (bookingData.entidad === 'PARTICULAR' && bookingData.catalog_item) {
                successMsg += `\nCosto Estimado: $${bookingData.catalog_item.price.toLocaleString('es-CO')} COP\n`;
            }

            if (bookingData.catalog_item && bookingData.catalog_item.recommendation) {
                successMsg += `\nPreparación / Recomendaciones:\n${bookingData.catalog_item.recommendation}`;
            }

            alert(successMsg);

            setShowBookingModal(false);
            setBookingStep(1);
            setBookingData({
                phone: '', full_name: '', document_id: '', entidad: 'ENTIDAD', auth_number: '', specialty_id: '', doctor_id: '', start_datetime: '', is_new_patient: false, catalog_item: null
            });
            fetchAppointments();
        } catch (err) {
            alert('Error al agendar: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCancelAppointment = async (id) => {
        if (!confirm('¿Estás seguro de cancelar esta cita?')) return;
        try {
            await axios.put(`${API_URL}/api/appointments/${id}/cancel`);
            fetchAppointments();
            setShowAppointmentModal(false);
        } catch (err) {
            alert('Error al cancelar: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newDatetime = formData.get('new_datetime');
        const newDoctorId = formData.get('new_doctor_id');

        try {
            await axios.put(`${API_URL}/api/appointments/${currentAppointment.id}`, {
                start_datetime: newDatetime,
                doctor_id: newDoctorId
            });
            fetchAppointments();
            setIsRescheduling(false);
            setShowAppointmentModal(false);
        } catch (err) {
            alert('Error al reagendar: ' + (err.response?.data?.error || err.message));
        }
    };



    const handleSaveSchedule = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const data = {
            doctor_id: currentDoctor.id,
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time')
        };

        if (isSpecialSchedule) {
            if (selectedSpecialDates.length === 0) {
                alert('Por favor selecciona al menos una fecha específica');
                return;
            }
            data.special_dates = selectedSpecialDates;
        } else {
            if (selectedScheduleDays.length === 0) {
                alert('Por favor selecciona al menos un día');
                return;
            }
            data.weekdays = selectedScheduleDays;
        }

        try {
            await axios.post(`${API_URL}/api/doctors/schedules`, data);
            fetchDoctorSchedules(currentDoctor.id);
            // Reset checkboxes
            if (!isSpecialSchedule) {
                data.weekdays.forEach(d => {
                    const el = document.getElementById(`day-${d}`);
                    if (el) el.checked = false;
                });
            } else {
                setSelectedSpecialDates([]);
            }
            e.target.reset();
        } catch (err) {
            alert('Error al guardar horario: ' + err.message);
        }
    };

    const handleDeleteSchedule = async (id) => {
        try {
            await axios.delete(`${API_URL}/api/doctors/schedules/${id}`);
            fetchDoctorSchedules(currentDoctor.id);
        } catch (err) {
            alert('Error al eliminar horario: ' + err.message);
        }
    };

    const handleDeleteSpecialGroup = async (ids) => {
        if (!window.confirm(`¿Estás seguro de eliminar estas ${ids.length} fechas especiales?`)) return;
        try {
            await Promise.all(ids.map(id => axios.delete(`${API_URL}/api/doctors/schedules/${id}`)));
            fetchDoctorSchedules(currentDoctor.id);
        } catch (err) {
            alert('Error al eliminar grupo de horarios: ' + err.message);
        }
    };

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const SidebarItem = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === id
                ? 'bg-[#2B3654] text-white shadow-md'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
        >
            <Icon size={18} />
            <span className="font-medium text-sm">{label}</span>
        </button>
    );

    const WhatsappConnectionView = () => (
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full text-center mx-auto mt-10 text-white">
            <h1 className="text-3xl font-bold mb-6 flex items-center justify-center gap-2">
                <MessageSquare className="text-green-500" /> WhatsApp Bot
            </h1>

            {status === 'connecting' && (
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-blue-400" size={48} />
                    <p>Conectando con el servidor...</p>
                </div>
            )}

            {status === 'qr' && qrCode && (
                <div className="flex flex-col items-center gap-6">
                    <p className="text-slate-300">Escanea el código QR para conectar el Bot al sistema</p>
                    <div className="bg-white p-4 rounded-xl">
                        <QRCodeCanvas value={qrCode} size={256} />
                    </div>
                    <p className="text-xs text-slate-400">Asegúrate de vincular tu dispositivo móvil de la clínica.</p>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="text-red-500" size={48} />
                    <h2 className="text-xl font-bold text-red-400">Error de Inicialización</h2>
                    <div className="bg-slate-900 p-3 rounded-lg text-xs font-mono text-red-300 break-all">{errorMsg}</div>
                    <button onClick={() => socket.emit('reset_session')} className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
                        <RefreshCw size={18} /> Reiniciar Sesión
                    </button>
                </div>
            )}

            {status === 'disconnected' && <div className="text-slate-400 italic">Iniciando servicios...</div>}
        </div>
    );

    return (
        <div className="flex min-h-screen bg-[#111C44] text-slate-100 transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-64 bg-[#1F232B] border-r border-[#2C313C] py-6 px-4 flex flex-col transition-colors duration-300 sticky top-0 h-screen z-50">
                <div className="flex items-center justify-center mb-8">
                    <img src={LogoImage} alt="IPS Nuestra Señora de Fátima Logo" className="h-28 w-auto object-contain" />
                </div>

                <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1 pr-2">
                    <SidebarItem id="dashboard" icon={LayoutDashboard} label="Inicio" />

                    <div className="mt-6 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">CITAS</div>
                    <SidebarItem id="appointments" icon={Calendar} label="Reservar" />
                    <SidebarItem id="calendar" icon={Calendar} label="Calendario" />

                    <div className="mt-6 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">USUARIOS</div>
                    <SidebarItem id="patients" icon={Users} label="Pacientes" />
                    <SidebarItem id="doctors" icon={Stethoscope} label="Médicos" />
                    <SidebarItem id="chat" icon={MessageSquare} label="Atención al cliente" />
                    <div className="relative">
                        {chats.some(c => c.advisor_requested) && (
                            <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></span>
                        )}
                    </div>

                    <div className="mt-6 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">SERVICIOS MÉDICOS</div>
                    <SidebarItem id="specialties" icon={LayoutDashboard} label="Gestión de Servicios" />

                    <div className="mt-6 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">TURNOS</div>
                    {/* Placeholder for future Turnos tab */}

                    <div className="mt-8 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-t border-[#2C313C] pt-6">FAQ</div>
                    <button onClick={() => setShowPoliciesModal(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-slate-400 hover:bg-white/5 hover:text-white">
                        <span className="font-medium text-sm flex items-center gap-3">
                            <span className="w-4 h-4 rounded border border-current flex items-center justify-center text-[10px]">🏛️</span> Políticas IPS
                        </span>
                    </button>
                    <a href="https://docs.google.com/forms/d/e/1FAIpQLSdMCtnGy3-rbXlPI3Z5P0rZiL9pvnJ6qUUZRYAD8yqVQocgdQ/viewform" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-slate-400 hover:bg-white/5 hover:text-white">
                        <span className="font-medium text-sm flex items-center gap-3">
                            <AlertCircle size={18} /> Reportar un problema
                        </span>
                    </a>
                    <a href="https://ipsnuestrasenoradefatima.com/contacto/" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-slate-400 hover:bg-white/5 hover:text-white">
                        <span className="font-medium text-sm flex items-center gap-3">
                            <Mail size={18} /> Contáctanos
                        </span>
                    </a>
                </nav>

                <div className="mt-auto pt-4 border-t border-[#2C313C]">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                        <span className="font-medium text-sm">{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <button
                        onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                        className="w-full flex mt-2 items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                    >
                        <Power size={18} />
                        <span className="font-medium text-sm">Salir</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0B1437]">
                <header className="flex justify-between items-center px-8 py-5 border-b border-indigo-900/30 bg-[#0B1437]/80 backdrop-blur-sm z-40">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="hover:text-blue-400 cursor-pointer">Home</span>
                        <span>/</span>
                        <span className="text-white font-bold capitalize">{activeTab}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <a href="https://entregaderesultados.com/ipsnsf_lab/" target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors">Portal de Resultados</a>
                        <span className="text-white font-medium text-sm">👋 Hola, {user.username || 'Admin'}</span>
                        <div className="w-10 h-10 bg-[#1F232B] rounded-full flex items-center justify-center border border-slate-700 shadow-lg cursor-pointer hover:bg-slate-700 transition">
                            <User className="text-slate-300 w-5 h-5" />
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-8 overflow-auto">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
                            <header>
                                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Dashboard General</h2>
                                <p className="text-slate-500 dark:text-slate-400">Resumen de actividad y métricas clave.</p>
                            </header>

                            {/* Attendance Verification Widget */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <CheckCircle size={120} />
                                </div>
                                <div className="relative z-10 max-w-md">
                                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                        <CheckCircle /> Validar Llegada
                                    </h3>
                                    <p className="text-blue-100 text-sm mb-4">Ingresa el código de confirmación enviado al WhatsApp del paciente para registrar su llegada.</p>

                                    <form onSubmit={handleValidateCode} className="flex gap-2">
                                        <input
                                            value={codeToValidate}
                                            onChange={(e) => setCodeToValidate(e.target.value.toUpperCase())}
                                            placeholder="CÓDIGO (ej. X7Y2Z9)"
                                            className="flex-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 outline-none placeholder-blue-200 text-white font-mono uppercase focus:bg-white/30 transition-all"
                                        />
                                        <button type="submit" className="bg-white text-blue-600 font-bold px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
                                            Validar
                                        </button>
                                    </form>

                                    {/* The old small alert was removed to use a Modal instead */}
                                </div>
                            </div>

                            {/* Validation Result Modal Details */}
                            {validationResult && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700">

                                        <div className={`p-6 text-white ${validationResult.success ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                                            <div className="flex justify-between items-start">
                                                <h3 className="text-xl font-bold flex items-center gap-2">
                                                    {validationResult.success ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                                                    {validationResult.success ? 'Validación Exitosa' : 'Error en Validación'}
                                                </h3>
                                                <button onClick={() => setValidationResult(null)} className="text-white/80 hover:text-white transition-colors bg-white/10 p-1.5 rounded-full">
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <p className="mt-2 text-white/90 text-sm font-medium">{validationResult.message}</p>
                                        </div>

                                        {validationResult.success && validationResult.appointment && (
                                            <div className="p-6 space-y-4">
                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-slate-400 block text-xs uppercase font-bold mb-1">Paciente</span>
                                                            <span className="text-slate-800 dark:text-slate-200 font-semibold">{validationResult.appointment.patient_name}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs uppercase font-bold mb-1">Médico Asignado</span>
                                                            <span className="text-slate-800 dark:text-slate-200 font-semibold">{validationResult.appointment.doctor_name}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs uppercase font-bold mb-1">Fecha y Hora</span>
                                                            <span className="text-slate-800 dark:text-slate-200 font-semibold">
                                                                {new Date(validationResult.appointment.start_datetime).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs uppercase font-bold mb-1">Estado</span>
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                                                COMPLETADA
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-100 dark:border-blue-800/30">
                                                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2 uppercase tracking-wider">Desglose de Pago</h4>

                                                    {validationResult.appointment.total_price ? (
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-600 dark:text-slate-400">Tipo de Reserva</span>
                                                                <span className="font-semibold text-slate-800 dark:text-slate-200">Paciente Particular</span>
                                                            </div>
                                                            <div className="pt-3 border-t border-blue-200 dark:border-blue-800/50 flex justify-between items-end">
                                                                <span className="text-slate-800 dark:text-slate-200 font-bold uppercase">Total a Cobrar Física</span>
                                                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                                                    ${Number(validationResult.appointment.total_price).toLocaleString('es-CO')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-600 dark:text-slate-400">Tipo de Reserva</span>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200 px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-full">Por Entidad</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => setValidationResult(null)}
                                                    className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold rounded-xl transition-colors"
                                                >
                                                    Cerrar y Continuar
                                                </button>
                                            </div>
                                        )}

                                        {!validationResult.success && (
                                            <div className="p-6">
                                                <button
                                                    onClick={() => setValidationResult(null)}
                                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold rounded-xl transition-colors"
                                                >
                                                    Intentar de nuevo
                                                </button>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            )}

                            {/* Top Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-blue-900/10 transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-blue-600/20 p-3 rounded-xl text-blue-500">
                                            <Calendar size={24} />
                                        </div>
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Hoy</span>
                                    </div>
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{todaysAppointments.length}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Citas Programadas</p>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-purple-900/10 transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-purple-600/20 p-3 rounded-xl text-purple-500">
                                            <Users size={24} />
                                        </div>
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Total</span>
                                    </div>
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{doctors.length}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Médicos Activos</p>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-green-900/10 transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-green-600/20 p-3 rounded-xl text-green-500">
                                            <CheckCircle size={24} />
                                        </div>
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Total</span>
                                    </div>
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{appointments.length}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Citas Históricas</p>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-amber-900/10 transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-amber-600/20 p-3 rounded-xl text-amber-500">
                                            <MessageSquare size={24} />
                                        </div>
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Activos</span>
                                    </div>
                                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{chats.length}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Conversaciones</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Today's Appointments List */}
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl flex flex-col">
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <Calendar className="text-blue-500" size={20} />
                                            Agenda de Hoy
                                        </h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowBookingModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                                                <Plus size={14} /> Nueva
                                            </button>
                                            <button onClick={() => setActiveTab('appointments')} className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-bold uppercase tracking-wider">Ver Todo</button>
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 overflow-auto max-h-[400px] space-y-3">
                                        {todaysAppointments.length === 0 ? (
                                            <div className="text-center py-10 text-slate-500">
                                                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                                <p>No hay citas para hoy</p>
                                            </div>
                                        ) : (
                                            todaysAppointments.map(apt => (
                                                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all">
                                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg text-center min-w-[60px] shadow-sm">
                                                        <span className="block text-xl font-bold text-slate-700 dark:text-white">{new Date(apt.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{apt.patient_name}</h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{apt.specialty_name} • Dr. {apt.doctor_name}</p>
                                                    </div>
                                                    <div className={`w-2 h-2 rounded-full ${apt.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Activity Chart */}
                                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 flex flex-col">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                        <LayoutDashboard className="text-purple-500" size={20} />
                                        Actividad Semanal
                                    </h3>
                                    <div className="flex-1 flex items-end justify-between gap-2 h-[300px] pb-6 px-4">
                                        {chartData.map((d, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                                <div className="relative w-full bg-slate-100 dark:bg-slate-700/30 rounded-t-xl overflow-hidden flex items-end justify-center hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors h-full">
                                                    {/* Bar */}
                                                    <div
                                                        className="w-full mx-2 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-lg transition-all duration-1000 ease-out group-hover:from-blue-500 group-hover:to-cyan-300 relative"
                                                        style={{ height: `${(d.count / maxChartValue) * 100}%` }}
                                                    >
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-10">
                                                            {d.count} Citas
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-500 uppercase">{d.day}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                    }

                    {
                        activeTab === 'appointments' && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <header className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Citas Agendadas</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona y visualiza todas las citas médicas.</p>
                                    </div>
                                    <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${viewMode === 'list'
                                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                        >
                                            <LayoutDashboard size={18} /> Lista
                                        </button>
                                        <button
                                            onClick={() => setShowBookingModal(true)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg ml-2"
                                        >
                                            <Plus size={18} /> Nueva Cita
                                        </button>
                                        <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        <button
                                            onClick={fetchAppointments}
                                            className="px-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                                            title="Refrescar"
                                        >
                                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                </header>

                                {viewMode === 'list' ? (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                                    <th className="px-6 py-4">Paciente</th>
                                                    <th className="px-6 py-4">Especialidad</th>
                                                    <th className="px-6 py-4">Médico</th>
                                                    <th className="px-6 py-4">Fecha y Hora</th>
                                                    <th className="px-6 py-4">Estado</th>
                                                    <th className="px-6 py-4">Origen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {appointments.map((a) => (
                                                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors" onClick={() => { setCurrentAppointment(a); setShowAppointmentModal(true); setIsRescheduling(false); }}>
                                                        <td className="px-6 py-4">
                                                            <div className="font-semibold text-slate-900 dark:text-white">{a.patient_name}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">{a.patient_phone}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{a.specialty_name}</td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{a.doctor_name}</td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                            {new Date(a.start_datetime).toLocaleString('es-ES', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${a.status === 'BOOKED' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' :
                                                                a.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400' :
                                                                    'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                                                                }`}>
                                                                {a.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{a.source}</td>
                                                    </tr>
                                                ))}
                                                {appointments.length === 0 && (
                                                    <tr>
                                                        <td colSpan="6" className="px-6 py-10 text-center text-slate-500 italic">No hay citas agendadas aún.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : null}
                            </div>
                        )
                    }

                    {
                        activeTab === 'calendar' && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <header className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Calendario de Citas</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">Visualización mensual de la agenda.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowBookingModal(true)}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg"
                                    >
                                        <Plus size={18} /> Nueva Cita
                                    </button>
                                </header>

                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
                                    {/* Calendar Header */}
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                                            {currentCalendarDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                        </h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><ArrowLeft size={20} /></button>
                                            <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><ArrowLeft size={20} className="rotate-180" /></button>
                                        </div>
                                    </div>

                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-4 mb-2">
                                        {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(d => (
                                            <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase py-2">{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-4">
                                        {generateCalendarDays().map((dayObj, i) => (
                                            <div
                                                key={i}
                                                className={`min-h-[100px] border rounded-xl p-2 transition-all relative group
                                            ${!dayObj.day
                                                        ? 'bg-transparent border-transparent'
                                                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:bg-slate-100 dark:hover:bg-slate-700/30'}
                                            ${dayObj.date === new Date().toISOString().split('T')[0] ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}
                                        `}
                                            >
                                                {dayObj.day && (
                                                    <>
                                                        <span className={`text-sm font-bold ${dayObj.date === new Date().toISOString().split('T')[0] ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>{dayObj.day}</span>
                                                        <div className="mt-2 space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                                            {dayObj.appointments.map(apt => (
                                                                <div key={apt.id}
                                                                    onClick={(e) => { e.stopPropagation(); setCurrentAppointment(apt); setShowAppointmentModal(true); setIsRescheduling(false); }}
                                                                    className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300 px-1.5 py-1 rounded truncate border-l-2 border-blue-500 hover:bg-blue-200 dark:hover:bg-blue-600 hover:text-blue-800 dark:hover:text-white cursor-pointer transition-colors" title={`${apt.patient_name} - ${apt.specialty_name}`}>
                                                                    {new Date(apt.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {apt.patient_name.split(' ')[0]}...
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {
                        activeTab === 'patients' && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <header className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Pacientes</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">Registro de pacientes y su historial de contacto.</p>
                                    </div>
                                </header>

                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 text-center text-slate-500">
                                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>La lista completa de pacientes interactivos se encuentra consolidada en la sección de Chat CRM.</p>
                                    <button onClick={() => setActiveTab('chat')} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                        Ir al Chat CRM
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    {
                        activeTab === 'chat' && (
                            status !== 'ready' ? (
                                <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
                                    <WhatsappConnectionView />
                                </div>
                            ) : (
                                <div className="flex h-[calc(100vh-10rem)] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                                    {/* Contacts Sidebar */}
                                    <div className="w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <MessageSquare size={18} className="text-green-500" />
                                                Conversaciones
                                            </h3>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar paciente..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-auto">
                                            {chats
                                                .filter(c =>
                                                    (c.patient_name && c.patient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                                    c.phone.includes(searchTerm)
                                                )
                                                .map((chat) => (
                                                    <button
                                                        key={chat.phone}
                                                        onClick={() => {
                                                            setSelectedChat(chat);
                                                            fetchMessages(chat.phone);
                                                        }}
                                                        className={`w-full p-4 flex flex-col gap-1 text-left transition-all border-b border-slate-200 dark:border-slate-700/50 ${selectedChat?.phone === chat.phone
                                                            ? 'bg-blue-100 dark:bg-blue-600/20 border-l-4 border-l-blue-500'
                                                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <span className="font-bold text-slate-900 dark:text-white truncate w-full pr-2 flex items-center gap-2">
                                                                {chat.patient_name || chat.phone}
                                                                {chat.advisor_requested && (
                                                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="Solicitud de Asesor"></span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-1">
                                                            <span className="uppercase">{chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                            <div className="flex gap-2 items-center">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${chat.is_bot_active ? 'bg-green-500' : 'bg-amber-500'}`} title={chat.is_bot_active ? 'Bot Activo' : 'Manual'}></span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate italic mt-1">
                                                            {chat.from_me ? 'Tú: ' : ''}{chat.last_message || 'Sin mensajes'}
                                                        </p>
                                                    </button>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Chat Window */}
                                    {selectedChat ? (
                                        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/20 backdrop-blur-sm">
                                            {/* Chat Header */}
                                            <header className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/80 dark:bg-slate-800/80">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => setSelectedChat(null)}
                                                        className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-300"
                                                    >
                                                        <ArrowLeft size={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedChat(null)}
                                                        className="hidden md:block p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 mr-1"
                                                        title="Cerrar chat"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white uppercase shadow-lg shadow-blue-900/50">
                                                        {(selectedChat.patient_name || '?')[0]}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                            {selectedChat.patient_name || 'Paciente'}
                                                            {selectedChat.advisor_requested && <span className="text-[10px] bg-red-500/20 text-red-500 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-500/50">Solicita Asesor</span>}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{selectedChat.phone}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                                        <span className={`text-[10px] font-bold ${selectedChat.is_bot_active ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                            BOT: {selectedChat.is_bot_active ? 'ON' : 'OFF'}
                                                        </span>
                                                        <button
                                                            onClick={() => toggleBot(selectedChat.phone, !selectedChat.is_bot_active)}
                                                            className={`w-10 h-5 rounded-full relative transition-all ${selectedChat.is_bot_active ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                        >
                                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${selectedChat.is_bot_active ? 'right-1' : 'left-1'}`}></div>
                                                        </button>
                                                    </div>
                                                </div>
                                            </header>

                                            {/* Messages History */}
                                            <div className="flex-1 overflow-auto p-6 space-y-4 bg-[url('https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-background-dark-whatsapp-background-dark-background.jpg')] bg-repeat bg-center bg-opacity-5 relative">
                                                <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 -z-10" />
                                                {messages.map((m, i) => (
                                                    <div key={i} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm relative ${m.from_me
                                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                                                            }`}>
                                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                                                            <span className={`text-[9px] block text-right mt-1 opacity-60 font-mono`}>
                                                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div id="chat-end" />
                                            </div>

                                            {/* Message Input */}
                                            <footer className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                                    <input
                                                        value={newMessage}
                                                        onChange={(e) => setNewMessage(e.target.value)}
                                                        placeholder="Escribe un mensaje..."
                                                        className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white"
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl shadow-lg transition-transform active:scale-95"
                                                    >
                                                        <MessageSquare size={20} />
                                                    </button>
                                                </form>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center italic">
                                                    * El modo Manual suspende las respuestas automáticas del bot para este contacto.
                                                </p>
                                            </footer>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-4">
                                            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full border border-slate-200 dark:border-slate-700 shadow-inner">
                                                <MessageSquare size={64} className="opacity-20 text-slate-900 dark:text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-400">Canal de Mensajería</h3>
                                                <p className="max-w-xs text-sm">Selecciona una conversación a la izquierda para ver el historial y responder manualmente.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        )
                    }

                    {
                        activeTab === 'doctors' && (
                            <div className="space-y-6">
                                <header className="flex justify-between items-center">
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Médicos</h2>
                                    <button
                                        onClick={() => { setCurrentDoctor(null); setShowDoctorModal(true); }}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
                                    >
                                        <Plus size={20} /> Nuevo Médico
                                    </button>
                                </header>

                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                                <th className="px-6 py-4">Nombre</th>
                                                <th className="px-6 py-4">Especialidad</th>
                                                <th className="px-6 py-4">Teléfono</th>
                                                <th className="px-6 py-4">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {doctors.map((d) => (
                                                <tr key={d.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!d.is_active ? 'opacity-50' : ''}`}>
                                                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{d.full_name} {d.is_active ? '' : '(Inactivo)'}</td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{d.specialty_name}</td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{d.phone}</td>
                                                    <td className="px-6 py-4 flex gap-4">
                                                        <button onClick={() => { setCurrentDoctor(d); setShowDoctorModal(true); }} className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300" title="Editar Médico"><Edit size={18} /></button>
                                                        <button onClick={() => { setCurrentDoctor(d); setShowScheduleModal(true); fetchDoctorSchedules(d.id); }} className="text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300" title="Agenda"><Calendar size={18} /></button>
                                                        <button onClick={() => { setCurrentDoctor(d); setAvailabilityDate(new Date().toISOString().split('T')[0]); fetchAvailability(d.id, new Date().toISOString().split('T')[0]); setShowAvailabilityModal(true); }} className="text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300" title="Ver Disponibilidad"><Eye size={18} /></button>
                                                        <button onClick={() => { setCurrentDoctor(d); setShowBlockModal(true); fetchDoctorBlocks(d.id); }} className="text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300" title="Bloqueos"><Lock size={18} /></button>
                                                        <button onClick={() => handleToggleDoctorStatus(d)} className={`${d.is_active ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300' : 'text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300'}`} title={d.is_active ? "Desactivar" : "Activar"}><Power size={18} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    }

                    {
                        activeTab === 'specialties' && (
                            <div className="space-y-6">
                                <div className="border-b border-slate-200 dark:border-slate-700">
                                    <nav className="-mb-px flex space-x-8">
                                        <button
                                            onClick={() => setActiveAdminSubTab('services')}
                                            className={`${activeAdminSubTab === 'services'
                                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg`}
                                        >
                                            Servicios
                                        </button>
                                        <button
                                            onClick={() => setActiveAdminSubTab('specialties')}
                                            className={`${activeAdminSubTab === 'specialties'
                                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg`}
                                        >
                                            Especialidades
                                        </button>
                                    </nav>
                                </div>

                                {/* Services Tab Content */}
                                {activeAdminSubTab === 'services' && (
                                    <>
                                        <header className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 w-full max-w-md">
                                                <div className="relative w-full">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar servicios..."
                                                        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setCurrentService(null); setShowServiceModal(true); }}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
                                            >
                                                <Plus size={20} /> Nuevo Servicio
                                            </button>
                                        </header>

                                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                                        <th className="px-6 py-4">Nombre</th>
                                                        <th className="px-6 py-4">Visible</th>
                                                        <th className="px-6 py-4 text-right pr-6">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                    {services.map((s) => (
                                                        <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-3 py-1 rounded inline-flex items-center gap-1 text-xs border ${s.is_active ? 'border-green-500 text-green-500' : 'border-slate-400 text-slate-400'}`}>
                                                                    <Check size={12} /> {s.is_active ? 'Sí' : 'No'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 flex gap-2 justify-end">
                                                                <button onClick={() => { setCurrentService(s); setShowServiceModal(true); }} className="text-blue-500 hover:text-blue-600 border border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors"><Edit size={14} /> Editar</button>
                                                                <button onClick={() => handleToggleServiceStatus(s)} className={`px-3 py-1 border rounded text-sm flex items-center gap-1 transition-colors ${s.is_active ? 'text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`} title={s.is_active ? "Desactivar" : "Activar"}><Power size={14} /> {s.is_active ? "Desactivar" : "Activar"}</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}

                                {/* Specialties Tab Content */}
                                {activeAdminSubTab === 'specialties' && (
                                    <>
                                        <header className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 w-full max-w-md">
                                                <div className="relative w-full">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar especialidades..."
                                                        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setCurrentSpecialty(null); setShowSpecialtyModal(true); }}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
                                            >
                                                <Plus size={20} /> Nueva Especialidad
                                            </button>
                                        </header>

                                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                                        <th className="px-6 py-4">Nombre</th>
                                                        <th className="px-6 py-4">Servicio Padre</th>
                                                        <th className="px-6 py-4">Duración (min)</th>
                                                        <th className="px-6 py-4">Capacidad</th>
                                                        <th className="px-6 py-4 text-right pr-6">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                    {specialties.map((s) => (
                                                        <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{s.service_name || 'Sin Asignar'}</td>
                                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{s.duration_minutes}</td>
                                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                                <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold px-2 py-1 rounded">
                                                                    {s.capacity || 1}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 flex gap-2 justify-end">
                                                                <button onClick={() => { setCurrentSpecialty(s); setShowSpecialtyModal(true); }} className="text-blue-500 hover:text-blue-600 border border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors"><Edit size={14} /> Editar</button>
                                                                <button onClick={() => handleToggleSpecialtyStatus(s)} className={`px-3 py-1 border rounded text-sm flex items-center gap-1 transition-colors ${s.is_active ? 'text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`} title={s.is_active ? "Desactivar" : "Activar"}><Power size={14} /> {s.is_active ? "Desactivar" : "Activar"}</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    }
                </div >
            </main >

            {/* Service Modal */}
            {
                showServiceModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                        <form onSubmit={handleSaveService} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{currentService ? 'Editar' : 'Nuevo'} Servicio</h3>
                                <button type="button" onClick={() => setShowServiceModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nombre del Servicio</label>
                                    <input name="name" defaultValue={currentService?.name} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95">Guardar Servicio</button>
                        </form>
                    </div>
                )
            }

            {/* Specialty Modal */}
            {
                showSpecialtyModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                        <form onSubmit={handleSaveSpecialty} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{currentSpecialty ? 'Editar' : 'Nueva'} Especialidad</h3>
                                <button type="button" onClick={() => setShowSpecialtyModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nombre de la Especialidad</label>
                                    <input name="name" defaultValue={currentSpecialty?.name} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Servicio al que pertenece (Padre)</label>
                                    <select name="service_id" defaultValue={currentSpecialty?.service_id || ''} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white">
                                        <option value="" disabled>Seleccionar Servicio</option>
                                        {services.filter(s => s.is_active).map(srv => <option key={srv.id} value={srv.id}>{srv.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Duración (minutos)</label>
                                        <input name="duration_minutes" type="number" defaultValue={currentSpecialty?.duration_minutes || 20} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Capacidad por turno</label>
                                        <input name="capacity" type="number" min="1" defaultValue={currentSpecialty?.capacity || 1} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Descripción (Opcional)</label>
                                    <textarea name="description" defaultValue={currentSpecialty?.description} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 text-slate-900 dark:text-white placeholder-slate-400" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95">Guardar Especialidad</button>
                        </form>
                    </div>
                )
            }

            {/* Availability Modal */}
            {
                showAvailabilityModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-xl shadow-2xl space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Disponibilidad</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Dr. {currentDoctor?.full_name}</p>
                                </div>
                                <button type="button" onClick={() => setShowAvailabilityModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Consultar Fecha</label>
                                    <input
                                        type="date"
                                        value={availabilityDate}
                                        onChange={(e) => { setAvailabilityDate(e.target.value); fetchAvailability(currentDoctor.id, e.target.value); }}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white dark:[color-scheme:dark]"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                        <CheckCircle size={16} className="text-green-500" /> Espacios Disponibles
                                    </h4>
                                    {loading ? (
                                        <div className="text-center py-8 text-slate-400 animate-pulse">Cargando disponibilidad...</div>
                                    ) : availableSlots.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 italic bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                            No hay espacios disponibles para esta fecha.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                            {availableSlots.map((slot, i) => (
                                                <div key={i} className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 py-2 px-1 rounded-lg text-center font-bold text-sm border border-green-200 dark:border-green-500/30">
                                                    {slot}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Booking Modal */}
            {
                showBookingModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <form onSubmit={handleBookingSubmit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto custom-scrollbar">
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-4 -mx-8 -mt-8 rounded-t-2xl border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                    Reserva de Cita
                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 text-xs rounded-full font-bold">Asistente en {bookingStep} de 3</span>
                                </h3>
                                <button type="button" onClick={() => setShowBookingModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-800 rounded-full p-2 shadow-sm border border-slate-200 dark:border-slate-700"><X size={20} /></button>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative pt-6 pb-2 px-4">
                                <div className="absolute top-1/2 left-8 right-8 h-1 bg-slate-200 dark:bg-slate-700 -translate-y-1/2 rounded-full"></div>
                                <div className="absolute top-1/2 left-8 h-1 bg-blue-600 -translate-y-1/2 rounded-full transition-all duration-300" style={{ width: `calc(${((bookingStep - 1) / 2) * 100}% - 2rem)` }}></div>

                                <div className="relative flex justify-between z-10 w-full">
                                    {['Identificación', 'Facturación', 'Agendamiento'].map((stepName, i) => (
                                        <div key={i} className="flex flex-col items-center gap-2">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors shadow-sm ${bookingStep > i + 1 ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900' : (bookingStep === i + 1 ? 'bg-blue-600 ring-4 ring-blue-200 dark:ring-blue-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-600')}`}>
                                                {bookingStep > i + 1 ? <CheckCircle size={18} /> : i + 1}
                                            </div>
                                            <span className={`text-xs font-bold uppercase tracking-wider ${bookingStep >= i + 1 ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'}`}>
                                                {stepName}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Step 1: Patient Info */}
                                {bookingStep === 1 && (
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-700/50 animate-in fade-in duration-300">
                                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">Datos del Paciente</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Celular</label>
                                                <input
                                                    value={bookingData.phone}
                                                    onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                                                    onBlur={(e) => handlePatientLookup(e.target.value)}
                                                    required
                                                    placeholder="57300..."
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Documento</label>
                                                <input
                                                    value={bookingData.document_id}
                                                    onChange={(e) => setBookingData({ ...bookingData, document_id: e.target.value })}
                                                    placeholder="Opcional"
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                                                />
                                            </div>
                                            <div className="col-span-2 flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nombre Completo</label>
                                                <input
                                                    value={bookingData.full_name}
                                                    onChange={(e) => setBookingData({ ...bookingData, full_name: e.target.value })}
                                                    required
                                                    readOnly={!bookingData.is_new_patient}
                                                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 ${!bookingData.is_new_patient ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                                                />
                                                {bookingData.is_new_patient && bookingData.phone.length > 6 && (
                                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">* Nuevo paciente detectado</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Entidad & Autorización */}
                                {bookingStep === 2 && (
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-700/50 animate-in fade-in duration-300">
                                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">Entidad y Cobertura</h4>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Tipo de Paciente / Entidad</label>
                                                <select
                                                    value={bookingData.entidad}
                                                    onChange={(e) => setBookingData({ ...bookingData, entidad: e.target.value, auth_number: '', regimen: '' })}
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                                >
                                                    <option value="">Seleccionar Entidad / Cobertura...</option>
                                                    <option value="PARTICULAR">Atención Particular (Pago en Sede)</option>
                                                    <option value="ARL">ARL</option>
                                                    <option value="SOAT">SOAT</option>
                                                    <option value="ALIANZA SALUD">E.P.S Alianza Salud</option>
                                                    <option value="COMPENSAR">E.P.S Compensar</option>
                                                    <option value="MEDICINA PREPAGADA">Medicina Prepagada</option>
                                                </select>
                                            </div>

                                            {['ALIANZA SALUD', 'COMPENSAR'].includes(bookingData.entidad) && (
                                                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Régimen</label>
                                                    <select
                                                        value={bookingData.regimen || ''}
                                                        onChange={(e) => setBookingData({ ...bookingData, regimen: e.target.value })}
                                                        required
                                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                                    >
                                                        <option value="">Seleccionar Régimen...</option>
                                                        <option value="CONTRIBUTIVO">Contributivo</option>
                                                        <option value="SUBSIDIADO">Subsidiado</option>
                                                    </select>
                                                </div>
                                            )}

                                            {['ALIANZA SALUD', 'COMPENSAR', 'MEDICINA PREPAGADA'].includes(bookingData.entidad) && (
                                                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Número de Autorización</label>
                                                    <input
                                                        value={bookingData.auth_number}
                                                        onChange={(e) => setBookingData({ ...bookingData, auth_number: e.target.value })}
                                                        required
                                                        placeholder="Ingrese el número impreso en la orden"
                                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 font-mono tracking-wide"
                                                    />
                                                </div>
                                            )}

                                            {['ARL', 'SOAT'].includes(bookingData.entidad) && (
                                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-2 animate-in fade-in">
                                                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                                    <p>
                                                        <strong>Atención:</strong> El paciente debe presentar en ventanilla: Historia Clínica, Documento de Identidad, y Exámenes Autorizados / SOAT / ARL vigentes. De lo contrario no podrá tomar su cita.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Appointment Info */}
                                {bookingStep === 3 && (
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-700/50 animate-in fade-in duration-300">
                                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">Detalles de la Cita</h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Servicio</label>
                                                <select
                                                    value={bookingData.service_id}
                                                    onChange={(e) => {
                                                        const serviceId = e.target.value;
                                                        // Find specialties for this service
                                                        const serviceSpecialties = specialties.filter(s => s.service_id === serviceId && s.is_active);

                                                        // Auto-select if there's only 1 specialty (or none, we just clear)
                                                        const autoSpecId = serviceSpecialties.length === 1 ? serviceSpecialties[0].id : '';

                                                        setBookingData({
                                                            ...bookingData,
                                                            service_id: serviceId,
                                                            specialty_id: autoSpecId,
                                                            doctor_id: '',
                                                            catalog_item: null
                                                        });
                                                    }}
                                                    required
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                                >
                                                    <option value="">Seleccionar Servicio...</option>
                                                    {services.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>

                                            {bookingData.service_id && specialties.filter(s => s.service_id === bookingData.service_id && s.is_active).length > 1 && (
                                                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Especialidad</label>
                                                    <select
                                                        value={bookingData.specialty_id}
                                                        onChange={(e) => setBookingData({ ...bookingData, specialty_id: e.target.value, doctor_id: '', catalog_item: null })}
                                                        required
                                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                                    >
                                                        <option value="">Seleccionar Especialidad...</option>
                                                        {specialties.filter(s => s.service_id === bookingData.service_id && s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Tipo de Consulta</label>
                                                <select
                                                    value={bookingData.consultation_type}
                                                    onChange={(e) => setBookingData({ ...bookingData, consultation_type: e.target.value })}
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                                >
                                                    <option value="PRIMERA VEZ">Primera Vez</option>
                                                    <option value="CONTROL">Control</option>
                                                </select>
                                            </div>

                                            {bookingData.specialty_id && specialties.find(s => s.id === bookingData.specialty_id) && catalogs[specialties.find(s => s.id === bookingData.specialty_id).name] && (
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Examen Específico</label>
                                                    <select
                                                        onChange={(e) => {
                                                            const specName = specialties.find(s => s.id === bookingData.specialty_id).name;
                                                            const item = catalogs[specName].find(c => c.name === e.target.value);
                                                            setBookingData({ ...bookingData, catalog_item: item });
                                                        }}
                                                        required
                                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                                    >
                                                        <option value="">Seleccionar examen...</option>
                                                        {catalogs[specialties.find(s => s.id === bookingData.specialty_id).name].map((c, i) => (
                                                            <option key={i} value={c.name}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {bookingData.entidad === 'PARTICULAR' && bookingData.catalog_item && (
                                                <div className="p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-200 text-sm">
                                                    <strong className="block mb-1">Costo Estimado (Sujeto a cambios):</strong>
                                                    ${bookingData.catalog_item.price.toLocaleString('es-CO')} COP
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Médico</label>
                                                <select
                                                    value={bookingData.doctor_id}
                                                    onChange={(e) => {
                                                        const docId = e.target.value;
                                                        setBookingData({ ...bookingData, doctor_id: docId, start_datetime: '' });
                                                        setBookingDate('');
                                                        setBookingSlots([]);
                                                        if (docId) fetchDoctorSchedules(docId);
                                                        else setDoctorSchedules([]);
                                                    }}
                                                    required
                                                    disabled={!bookingData.specialty_id}
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 text-slate-900 dark:text-white"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {doctors
                                                        .filter(d => !bookingData.specialty_id || d.specialty_id === bookingData.specialty_id)
                                                        .map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)
                                                    }
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Fecha y Hora</label>
                                                <div className="flex flex-col gap-3">
                                                    <input
                                                        type="date"
                                                        min={new Date().toLocaleDateString('en-CA')}
                                                        value={bookingDate}
                                                        onChange={(e) => {
                                                            setBookingDate(e.target.value);
                                                            setBookingData({ ...bookingData, start_datetime: '' });
                                                            if (e.target.value && bookingData.doctor_id) {
                                                                fetchBookingSlots(bookingData.doctor_id, e.target.value);
                                                            } else {
                                                                setBookingSlots([]);
                                                            }
                                                        }}
                                                        required
                                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white dark:[color-scheme:dark]"
                                                    />

                                                    {bookingDate && bookingData.doctor_id && (
                                                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                                            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Horas Disponibles</h5>
                                                            {bookingSlots.length > 0 ? (
                                                                <div className="grid grid-cols-4 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                                                    {bookingSlots.map((slot, i) => (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onClick={() => setBookingData({ ...bookingData, start_datetime: `${bookingDate}T${slot}` })}
                                                                            className={`py-2 px-1 rounded-lg text-center font-bold text-sm border transition-all ${bookingData.start_datetime === `${bookingDate}T${slot}` ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
                                                                        >
                                                                            {slot}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-4 text-xs font-medium text-slate-500 dark:text-slate-400 italic">
                                                                    No hay horas disponibles para esta fecha.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {bookingData.doctor_id && doctorSchedules.length > 0 && (
                                                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl">
                                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block mb-2">Horarios de Atención Sugeridos:</span>
                                                        <div className="space-y-1">
                                                            {doctorSchedules.filter(s => s.special_date == null).map((sch, i) => (
                                                                <div key={i} className="text-xs text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                                    {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][sch.weekday]}: {sch.start_time.substring(0, 5)} - {sch.end_time.substring(0, 5)}
                                                                </div>
                                                            ))}
                                                            {doctorSchedules.filter(s => s.special_date != null).length > 0 && (
                                                                <div className="text-xs text-purple-700 dark:text-purple-400 font-medium flex gap-2 mt-2 pt-2 border-t border-blue-200 dark:border-blue-800/50">
                                                                    <Calendar size={12} className="mt-0.5" />
                                                                    <span>Tiene fechas especiales disponibles. (Ver Agenda del Médico para más detalles).</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {bookingData.doctor_id && doctorSchedules.length === 0 && (
                                                    <span className="text-xs text-orange-500 mt-1">* El médico no tiene horarios configurados.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 font-bold">
                                {bookingStep > 1 && (
                                    <button type="button" onClick={handlePrevStep} className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white py-3 rounded-xl transition-all shadow-lg active:scale-95">
                                        Anterior
                                    </button>
                                )}
                                <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl transition-all shadow-lg active:scale-95">
                                    {bookingStep < 3 ? 'Siguiente' : 'Confirmar Cita'}
                                </button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* Doctor Modal */}
            {
                showDoctorModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <form onSubmit={handleSaveDoctor} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{currentDoctor ? 'Editar' : 'Nuevo'} Médico</h3>
                                <button type="button" onClick={() => setShowDoctorModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nombre Completo</label>
                                    <input name="full_name" defaultValue={currentDoctor?.full_name} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Especialidad</label>
                                    <select name="specialty_id" defaultValue={currentDoctor?.specialty_id} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white">
                                        <option value="">Seleccionar...</option>
                                        {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Teléfono</label>
                                    <input name="phone" defaultValue={currentDoctor?.phone} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95">Guardar Médico</button>
                        </form>
                    </div>
                )
            }

            {/* Schedule Modal */}
            {
                showScheduleModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] max-h-[800px]">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda: {currentDoctor?.full_name}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Define las horas de atención regulares o fechas específicas.</p>
                                </div>
                                <button type="button" onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-xl"><X /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                                <form onSubmit={handleSaveSchedule} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-6">
                                    <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                                        <button type="button" onClick={() => setIsSpecialSchedule(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isSpecialSchedule ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Regular (Semanal)</button>
                                        <button type="button" onClick={() => setIsSpecialSchedule(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isSpecialSchedule ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Especial (Fechas)</button>
                                    </div>

                                    {!isSpecialSchedule ? (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Día de la Semana</label>
                                            </div>
                                            <div className="grid grid-cols-7 gap-2">
                                                {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((day, idx) => (
                                                    <label key={idx} className={`cursor-pointer text-center py-2 rounded-xl border-2 transition-all ${selectedScheduleDays.includes(idx) ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-500/50'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedScheduleDays.includes(idx)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedScheduleDays([...selectedScheduleDays, idx]);
                                                                else setSelectedScheduleDays(selectedScheduleDays.filter(d => d !== idx));
                                                            }}
                                                            className="sr-only"
                                                        />
                                                        <span className="font-bold text-sm block">{day}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Fechas Específicas</label>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => setSpecialMonthDate(new Date(specialMonthDate.getFullYear(), specialMonthDate.getMonth() - 1, 1))} className="p-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronLeft size={20} /></button>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-32 text-center">
                                                        {specialMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                                    </span>
                                                    <button type="button" onClick={() => setSpecialMonthDate(new Date(specialMonthDate.getFullYear(), specialMonthDate.getMonth() + 1, 1))} className="p-1 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronRight size={20} /></button>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                                <div className="grid grid-cols-7 gap-1 mb-2">
                                                    {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => (
                                                        <div key={d} className="text-center text-xs font-bold text-slate-400">{d}</div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-7 gap-1">
                                                    {(() => {
                                                        const start = new Date(specialMonthDate.getFullYear(), specialMonthDate.getMonth(), 1);
                                                        const end = new Date(specialMonthDate.getFullYear(), specialMonthDate.getMonth() + 1, 0);
                                                        const blanks = Array(start.getDay()).fill(null).map((_, i) => <div key={`blank-${i}`} />);
                                                        const days = Array.from({ length: end.getDate() }).map((_, i) => {
                                                            const d = new Date(specialMonthDate.getFullYear(), specialMonthDate.getMonth(), i + 1);
                                                            const isSelected = selectedSpecialDates.some(sd => sd === d.toISOString().split('T')[0]);
                                                            const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    disabled={isPast}
                                                                    onClick={() => {
                                                                        const dateStr = d.toISOString().split('T')[0];
                                                                        if (isSelected) {
                                                                            setSelectedSpecialDates(selectedSpecialDates.filter(sd => sd !== dateStr));
                                                                        } else {
                                                                            setSelectedSpecialDates([...selectedSpecialDates, dateStr]);
                                                                        }
                                                                    }}
                                                                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors
                                                                        ${isPast ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' :
                                                                            isSelected ? 'bg-purple-600 text-white shadow-md' :
                                                                                'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                                        }`}
                                                                >
                                                                    {d.getDate()}
                                                                </button>
                                                            );
                                                        });
                                                        return [...blanks, ...days];
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Hora Inicio</label>
                                            <input name="start_time" type="time" required defaultValue="08:00" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-slate-400 text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Hora Fin</label>
                                            <input name="end_time" type="time" required defaultValue="18:00" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-slate-400 text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                        </div>
                                    </div>

                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95">
                                        <Plus size={20} /> Agregar Horario
                                    </button>
                                    <p className="text-[10px] text-slate-500 text-center italic mt-2">
                                        * Para almuerzos o descansos, agrega dos rangos: ej. 08:00 a 12:00 y luego 14:00 a 18:00.
                                    </p>
                                </form>

                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-300">Horarios Configurados</h4>
                                    {doctorSchedules.length === 0 ? (
                                        <p className="text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">No hay horarios definidos para este médico.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {doctorSchedules.filter(s => s.special_date == null).length > 0 && (
                                                <div className="space-y-2">
                                                    <h5 className="text-xs font-bold text-slate-500 uppercase">Regulares (Semanales)</h5>
                                                    {doctorSchedules.filter(s => s.special_date == null).map((sch) => (
                                                        <div key={sch.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all">
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg text-sm font-bold">
                                                                    {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][sch.weekday]}
                                                                </div>
                                                                <span className="text-slate-900 dark:text-white font-medium">{sch.start_time.substring(0, 5)} - {sch.end_time.substring(0, 5)}</span>
                                                            </div>
                                                            <button onClick={() => handleDeleteSchedule(sch.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Eliminar">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {doctorSchedules.filter(s => s.special_date != null).length > 0 && (
                                                <div className="space-y-2">
                                                    <h5 className="text-xs font-bold text-slate-500 uppercase">Especiales (Fechas Específicas)</h5>
                                                    {Object.values(doctorSchedules.filter(s => s.special_date != null).reduce((acc, sch) => {
                                                        const key = `${sch.start_time.substring(0, 5)} - ${sch.end_time.substring(0, 5)}`;
                                                        if (!acc[key]) acc[key] = { time: key, ids: [], dates: [], start: sch.start_time, end: sch.end_time };
                                                        acc[key].ids.push(sch.id);
                                                        acc[key].dates.push(sch.special_date);
                                                        return acc;
                                                    }, {})).map((group, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-200 dark:border-purple-800/30 hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-all cursor-pointer" onClick={() => setViewingSpecialDates(group)}>
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2">
                                                                    <Calendar size={14} /> {group.dates.length} Días
                                                                </div>
                                                                <span className="text-slate-900 dark:text-white font-medium">{group.time}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <button onClick={(e) => { e.stopPropagation(); setViewingSpecialDates(group); }} className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium transition-colors">Ver Fechas</button>
                                                                <div className="w-[1px] h-4 bg-purple-200 dark:bg-purple-800"></div>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteSpecialGroup(group.ids); }} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Eliminar este grupo de fechas">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Block Modal */}
            {
                showBlockModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto custom-scrollbar">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Bloqueos: {currentDoctor?.full_name}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona días libres o vacaciones.</p>
                                </div>
                                <button type="button" onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                            </div>

                            <form onSubmit={handleSaveBlock} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">Fecha</label>
                                        <input name="date" type="date" required className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-slate-400 text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">Motivo</label>
                                        <input name="reason" placeholder="Vacaciones, Personal..." className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-slate-400 text-slate-900 dark:text-white" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">Inicio</label>
                                        <input name="start_time" type="time" required defaultValue="00:00" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-slate-400 text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">Fin</label>
                                        <input name="end_time" type="time" required defaultValue="23:59" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder-slate-400 text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                    </div>
                                    <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 active:scale-95">
                                        <Lock size={18} /> Bloquear
                                    </button>
                                </div>
                            </form>

                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-800 dark:text-slate-300">Bloqueos Actuales</h4>
                                {doctorBlocks.length === 0 ? (
                                    <p className="text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">No hay bloqueos activos.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2">
                                        {doctorBlocks.map((blk) => (
                                            <div key={blk.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-lg text-sm font-bold">
                                                        {new Date(blk.date).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-900 dark:text-white font-medium">{blk.start_time.substring(0, 5)} - {blk.end_time.substring(0, 5)}</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">{blk.reason}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteBlock(blk.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Appointment Details Modal */}
            {
                showAppointmentModal && currentAppointment && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-lg shadow-2xl space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Detalles de la Cita</h3>
                                <button type="button" onClick={() => setShowAppointmentModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                            </div>

                            {!isRescheduling ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">Paciente</label>
                                            <p className="text-slate-900 dark:text-white font-medium">{currentAppointment.patient_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{currentAppointment.patient_phone}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">Estado</label>
                                            <span className={`block w-fit px-2 py-0.5 rounded text-xs font-bold mt-1 ${currentAppointment.status === 'BOOKED' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                                                currentAppointment.status === 'CONFIRMED' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' :
                                                    'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                                }`}>
                                                {currentAppointment.status}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">Especialidad</label>
                                            <p className="text-slate-900 dark:text-white font-medium">{currentAppointment.specialty_name}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase">Médico</label>
                                            <p className="text-slate-900 dark:text-white font-medium">{currentAppointment.doctor_name}</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                                        <div className="bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                                                {new Date(currentAppointment.start_datetime).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                            <p className="text-slate-500 dark:text-slate-400">
                                                {new Date(currentAppointment.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-500/30 mb-4">
                                        <p className="text-blue-800 dark:text-blue-200 text-sm flex items-center gap-2"><AlertCircle size={16} /> Reagendando cita</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nueva Fecha y Hora</label>
                                        <input
                                            type="datetime-local"
                                            name="new_datetime"
                                            defaultValue={new Date(new Date(currentAppointment.start_datetime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                            required
                                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white dark:[color-scheme:dark]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Médico (Opcional)</label>
                                        <select name="new_doctor_id" defaultValue={currentAppointment.doctor_id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white">
                                            {doctors.filter(d => d.specialty_id === currentAppointment.specialty_id).map(d => (
                                                <option key={d.id} value={d.id}>{d.full_name} {!d.is_active ? '(Inactivo)' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button type="button" onClick={() => setIsRescheduling(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold py-3 rounded-xl transition-all">
                                            Cancelar
                                        </button>
                                        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95">
                                            Guardar Cambios
                                        </button>
                                    </div>
                                </form>
                            )}

                            {!isRescheduling && (
                                <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    {currentAppointment.status !== 'CANCELLED' && (
                                        <>
                                            <button
                                                onClick={() => setIsRescheduling(true)}
                                                className="flex-1 bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-100 dark:hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-600/30 font-bold py-3 rounded-xl transition-all"
                                            >
                                                Reagendar
                                            </button>
                                            <button
                                                onClick={() => handleCancelAppointment(currentAppointment.id)}
                                                className="flex-1 bg-red-50 dark:bg-red-600/10 hover:bg-red-100 dark:hover:bg-red-600/20 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-600/30 font-bold py-3 rounded-xl transition-all"
                                            >
                                                Cancelar
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => setShowAppointmentModal(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold py-3 rounded-xl transition-all">
                                        Cerrar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Special Dates View Modal */}
            {
                viewingSpecialDates && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
                            <button onClick={() => setViewingSpecialDates(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={20} /></button>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Días Laborales</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 font-medium bg-slate-100 dark:bg-slate-900 w-fit px-3 py-1 rounded-full"><Clock size={14} /> {viewingSpecialDates.time}</p>

                            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                {viewingSpecialDates.dates.sort().map((d, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 p-2 rounded-lg">
                                                <Calendar size={18} />
                                            </div>
                                            <span className="font-bold text-slate-700 dark:text-slate-300 capitalize text-sm">
                                                {new Date(d.split('T')[0] + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Policies Modal */}
            {
                showPoliciesModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-4xl shadow-2xl h-[85vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Política de privacidad y seguridad del portal</h3>
                                <button type="button" onClick={() => setShowPoliciesModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-700 rounded-full p-2"><X size={20} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar text-slate-700 dark:text-slate-300 space-y-6">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">1. Introducción</h4>
                                    <p className="text-sm leading-relaxed">
                                        En la IPS Nuestra Señora de Fatima, la seguridad y la privacidad de la información personal de nuestros pacientes y usuarios son nuestra máxima prioridad. Esta política describe de forma detallada cómo recopilamos, utilizamos, almacenamos, protegemos y compartimos la información personal y financiera. Nos regimos por los más altos estándares internacionales de seguridad y privacidad, y nos comprometemos a cumplir con las normativas locales e internacionales, como el Reglamento General de Protección de Datos (GDPR), la Ley de Protección de Datos Personales y demás disposiciones aplicables.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">2. Información que Recopilamos</h4>
                                    <div className="space-y-3 pl-4">
                                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">2.1 Datos Personales</h5>
                                        <p className="text-sm leading-relaxed">Recopilamos únicamente la información necesaria para la prestación de nuestros servicios de salud y para mejorar la experiencia de nuestros usuarios, incluyendo datos de identificación, información médicas y demográficas.</p>

                                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">2.2 Datos Financieros</h5>
                                        <p className="text-sm leading-relaxed">Para procesar pagos y gestionar facturación, recopilamos información relacionada con medios de pago y el historial de transacciones.</p>

                                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">2.3 Datos Técnicos y de Navegación</h5>
                                        <p className="text-sm leading-relaxed">Recopilamos datos técnicos como la dirección IP, tipo de navegador, sistema operativo y datos de cookies para optimizar la experiencia del usuario.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">3. Uso de la Información</h4>
                                    <p className="text-sm leading-relaxed">La información recopilada se utiliza para prestar y gestionar servicios médicos, procesar pagos, mejorar nuestros servicios, cumplir obligaciones legales y, en su caso, para fines de marketing con el consentimiento del usuario.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">4. Medidas de Seguridad</h4>
                                    <p className="text-sm leading-relaxed">Implementamos medidas robustas de seguridad técnica, administrativa y física, que incluyen el cifrado de datos, controles de acceso, auditorías periódicas y capacitación constante del personal para garantizar la protección de la información.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">5. Procesamiento de Pagos</h4>
                                    <p className="text-sm leading-relaxed">Los pagos se gestionan a través de proveedores certificados que cumplen con los estándares internacionales de seguridad, delegando el almacenamiento de datos sensibles y garantizando transacciones seguras.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">6. Consentimiento y Derechos de los Usuarios</h4>
                                    <p className="text-sm leading-relaxed">Los usuarios tienen el derecho de acceder, rectificar, cancelar, oponerse y portar su información. Además, pueden retirar su consentimiento en cualquier momento sin afectar la legalidad de los tratamientos previos.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">7. Retención y Eliminación de Datos</h4>
                                    <p className="text-sm leading-relaxed">Conservamos los datos personales durante el tiempo necesario para cumplir con los fines para los cuales fueron recopilados y para satisfacer obligaciones legales, procediendo a su eliminación o anonimización una vez que ya no sean necesarios.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">8. Transferencia Internacional de Datos</h4>
                                    <p className="text-sm leading-relaxed">En algunos casos, los datos pueden ser transferidos y almacenados en el extranjero, siempre garantizando que se apliquen mecanismos de seguridad adecuados y se cumpla con la legislación aplicable.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">9. Cookies y Tecnologías Similares</h4>
                                    <p className="text-sm leading-relaxed">Utilizamos cookies y tecnologías similares para mejorar la experiencia del usuario, analizar el uso del servicio y personalizar el contenido, ofreciendo al usuario la posibilidad de gestionar sus preferencias.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">10. Cambios en la Política</h4>
                                    <p className="text-sm leading-relaxed">IPS Nuestra Señora de Fatima se reserva el derecho de modificar esta política en cualquier momento. Los cambios serán comunicados a los usuarios mediante los canales oficiales y se actualizará la fecha de la última revisión.</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">11. Contacto y Recursos Adicionales</h4>
                                    <p className="text-sm leading-relaxed mb-2">Para cualquier consulta o solicitud relacionada con la privacidad y la seguridad de sus datos, los usuarios pueden contactarnos a través de:</p>
                                    <ul className="list-disc pl-6 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                        <li><strong>Teléfono:</strong> (601) 899 4189</li>
                                        <li><strong>Celular:</strong> 320 826 4881</li>
                                        <li><strong>Dirección:</strong> Calle 6 No 2-14 Anapoima, Cundinamarca</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-slate-200 dark:border-slate-700 mt-auto">
                                <button type="button" onClick={() => setShowPoliciesModal(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg">Entendido, cerrar documento</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

function StatCard({ label, value }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl transition-all hover:shadow-2xl hover:scale-105 duration-300">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">{label}</p>
            <p className="text-4xl font-bold mt-2 text-slate-900 dark:text-white">{value}</p>
        </div>
    );
}

export default App;
