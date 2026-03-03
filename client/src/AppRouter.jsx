import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import App from './App';
import Login from './pages/Login';
import DoctorDashboard from './pages/DoctorDashboard';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import LabDashboard from './pages/LabDashboard';
import PatientDashboard from './pages/PatientDashboard';

// Axios interceptor: add token to every request
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle expired tokens globally
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
};

// Route guard that checks token + role
const PrivateRoute = ({ children, roles }) => {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" replace />;
    const user = getUser();
    if (roles && !roles.includes(user.role)) {
        // Redirect to the correct dashboard for the user's role
        return <Navigate to={getRoleHome(user.role)} replace />;
    }
    return children;
};

const getRoleHome = (role) => {
    switch (role) {
        case 'DOCTOR': return '/doctor';
        case 'RECEPTIONIST': return '/receptionist';
        case 'LAB': return '/lab';
        case 'PATIENT': return '/patient';
        default: return '/';
    }
};

// After login redirect based on role
const RoleRedirect = () => {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" replace />;
    const user = getUser();
    return <Navigate to={getRoleHome(user.role)} replace />;
};

export { getRoleHome };

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />

                {/* Admin */}
                <Route path="/*" element={
                    <PrivateRoute roles={['ADMIN']}>
                        <App />
                    </PrivateRoute>
                } />

                {/* Doctor */}
                <Route path="/doctor" element={
                    <PrivateRoute roles={['DOCTOR']}>
                        <DoctorDashboard />
                    </PrivateRoute>
                } />

                {/* Receptionist / Customer Service */}
                <Route path="/receptionist" element={
                    <PrivateRoute roles={['RECEPTIONIST']}>
                        <ReceptionistDashboard />
                    </PrivateRoute>
                } />

                {/* Lab */}
                <Route path="/lab" element={
                    <PrivateRoute roles={['LAB']}>
                        <LabDashboard />
                    </PrivateRoute>
                } />

                {/* Patient */}
                <Route path="/patient" element={
                    <PrivateRoute roles={['PATIENT']}>
                        <PatientDashboard />
                    </PrivateRoute>
                } />

                {/* Smart redirect based on role */}
                <Route path="/dashboard" element={<RoleRedirect />} />
            </Routes>
        </BrowserRouter>
    );
}
