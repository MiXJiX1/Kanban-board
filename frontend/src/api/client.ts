import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000",
});
api.interceptors.request.use((cfg) => {
  const t = sessionStorage.getItem("token");
  if (t && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem("token");
      if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function setToken(token?: string) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export const getNotifications = (unread = true) =>
  api.get(`/notifications`, { params: { unread } });

export const readNotification = (id: string) =>
  api.patch(`/notifications/${id}/read`, {});

export const readAllNotifications = () =>
  api.post(`/notifications/read-all`, {});

