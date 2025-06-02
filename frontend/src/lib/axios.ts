import axios from "axios";

const USER_KEY = "jortify_user";
const TOKEN_KEY = "jortify_token";

// Create axios instance
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear localStorage tokens
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);

      // Redirect to login page
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
