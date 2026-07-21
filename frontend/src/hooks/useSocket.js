/**
 * useSocket hook — manages Socket.IO event subscriptions
 */

import { useEffect, useRef } from 'react';
import { socket } from '../services/api';

export function useSocket(eventHandlers) {
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  useEffect(() => {
    const handlers = handlersRef.current;
    const entries = Object.entries(handlers);

    entries.forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      entries.forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, []);
}

export function useSocketEmit() {
  return (event, data) => socket.emit(event, data);
}

export { socket };
