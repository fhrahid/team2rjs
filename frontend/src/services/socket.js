import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Single shared socket connection for the whole app.
export const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
