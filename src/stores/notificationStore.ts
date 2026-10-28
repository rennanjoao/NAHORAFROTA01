/**
 * NOTIFICATION STORE - Fleet Alert System
 * Manages real-time fleet alerts (no mock data)
 */

import React from "react";

export type AlertType = "breakdown" | "delay" | "warning" | "info" | "success";
export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface FleetAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  driverId?: number;
  vehiclePlate?: string;
  createdAt: Date;
  read: boolean;
}

// Simple in-memory store with listeners — starts empty (no mock data)
let alerts: FleetAlert[] = [];
const listeners: Set<() => void> = new Set();

const generateId = () => `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export const notificationStore = {
  getAlerts: (): FleetAlert[] => [...alerts],
  
  getUnreadCount: (): number => alerts.filter(a => !a.read).length,
  
  getRecentAlerts: (count: number = 5): FleetAlert[] => {
    return [...alerts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, count);
  },
  
  addAlert: (alert: Omit<FleetAlert, "id" | "createdAt" | "read">): FleetAlert => {
    const newAlert: FleetAlert = {
      ...alert,
      id: generateId(),
      createdAt: new Date(),
      read: false,
    };
    alerts = [newAlert, ...alerts];
    notifyListeners();
    return newAlert;
  },
  
  markAsRead: (alertId: string) => {
    alerts = alerts.map(a => a.id === alertId ? { ...a, read: true } : a);
    notifyListeners();
  },
  
  markAllAsRead: () => {
    alerts = alerts.map(a => ({ ...a, read: true }));
    notifyListeners();
  },
  
  clearAlert: (alertId: string) => {
    alerts = alerts.filter(a => a.id !== alertId);
    notifyListeners();
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  
  // Alert triggers for specific events
  triggerBreakdownAlert: (vehiclePlate: string, driverId?: number) => {
    return notificationStore.addAlert({
      type: "breakdown",
      severity: "critical",
      title: "Problema Mecânico",
      message: `🚨 ALERTA: Veículo ${vehiclePlate} relatou problema mecânico.`,
      vehiclePlate,
      driverId,
    });
  },
  
  triggerDelayAlert: (driverName: string, driverId: number, sla: number) => {
    return notificationStore.addAlert({
      type: "delay",
      severity: "high",
      title: "Alto Risco de Atraso",
      message: `⚠️ ATENÇÃO: Motorista ${driverName} está com alto risco de atraso (SLA: ${sla.toFixed(1)}%).`,
      driverId,
    });
  },
  
  triggerLowSLAAlert: (driverName: string, driverId: number, sla: number) => {
    return notificationStore.addAlert({
      type: "warning",
      severity: "medium",
      title: "SLA Baixo",
      message: `⚠️ Motorista ${driverName} com SLA crítico: ${sla.toFixed(1)}%.`,
      driverId,
    });
  },
};

// React hook for subscribing to notification updates
export function useNotifications() {
  const [, forceUpdate] = React.useState({});
  
  React.useEffect(() => {
    const unsubscribe = notificationStore.subscribe(() => forceUpdate({}));
    return () => { unsubscribe(); };
  }, []);
  
  return {
    alerts: notificationStore.getAlerts(),
    recentAlerts: notificationStore.getRecentAlerts(5),
    unreadCount: notificationStore.getUnreadCount(),
    markAsRead: notificationStore.markAsRead,
    markAllAsRead: notificationStore.markAllAsRead,
    triggerBreakdownAlert: notificationStore.triggerBreakdownAlert,
    triggerDelayAlert: notificationStore.triggerDelayAlert,
    triggerLowSLAAlert: notificationStore.triggerLowSLAAlert,
  };
}
