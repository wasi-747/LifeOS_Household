import axios from 'axios';

const getBaseURL = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  if (url && !url.endsWith('/api') && !url.includes('/api/')) {
    return url.endsWith('/') ? `${url}api` : `${url}/api`;
  }
  return url;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lifeos-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
