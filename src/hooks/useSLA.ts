/**
 * USE SLA HOOK
 * Custom hook for managing SLA calculations and state
 */

import { useState, useCallback, useMemo } from "react";
import { useLogistics, Delivery, Occurrence } from "@/contexts/LogisticsContext";
import {
  calculateDailySLA,
  calculateWeeklySLA,
  calculateCollectiveSLA,
  calculatePointValue,
  OCCURRENCE_RULES,
  getSLAColorScheme,
  isVerySevereOccurrence,
  formatSLAScore,
  DailySLARecord,
  WeeklySLARecord,
  CollectiveSLAReport,
  SLADeduction,
} from "@/lib/slaCalculations";
import { notificationStore } from "@/stores/notificationStore";

// Map context occurrence types to SLA occurrence types
const mapOccurrenceType = (contextType: string): string => {
  const mapping: Record<string, string> = {
    delay: "closed_location",
    damage: "damaged",
    wrong_address: "refused",
    absent_recipient: "absent_recipient",
    refusal: "refused",
    theft: "not_found",
    other: "partial_delivery",
  };
  return mapping[contextType] || "partial_delivery";
};

export interface DriverSLAData {
  driverId: number;
  driverName: string;
  currentDailySLA: number;
  weeklySLA: number;
  totalDeliveriestoday: number;
  occurrencesToday: number;
  lastOccurrence?: {
    type: string;
    label: string;
    timestamp: Date;
    pointsLost: number;
  };
  colorScheme: ReturnType<typeof getSLAColorScheme>;
}

export interface SLAPeriodFilter {
  startDate: Date;
  endDate: Date;
}

export function useSLA() {
  const { deliveries, drivers, occurrences } = useLogistics();
  const [periodFilter, setPeriodFilter] = useState<SLAPeriodFilter>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
    endDate: new Date(),
  });

  // Get today's date range
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  // Get this week's date range
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Calculate individual driver's daily SLA
  const getDriverDailySLA = useCallback((driverId: number): DailySLARecord => {
    // Get today's deliveries for this driver
    const driverDeliveries = deliveries.filter(d => 
      d.driverId === driverId &&
      d.scheduledDate >= todayStart &&
      d.scheduledDate <= todayEnd
    );

    const totalDeliveries = driverDeliveries.length;
    
    // Get occurrences for these deliveries
    const driverOccurrences = driverDeliveries
      .flatMap(d => d.occurrences.map(occ => ({
        type: mapOccurrenceType(occ.type),
        deliveryId: d.id,
        timestamp: occ.createdAt,
      })));

    return calculateDailySLA(driverId, totalDeliveries, driverOccurrences);
  }, [deliveries, todayStart, todayEnd]);

  // Calculate individual driver's weekly SLA
  const getDriverWeeklySLA = useCallback((driverId: number): WeeklySLARecord => {
    const dailyScores: DailySLARecord[] = [];
    
    // Generate daily records for the week
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      if (dayEnd > new Date()) break; // Don't include future days
      
      const dayDeliveries = deliveries.filter(d => 
        d.driverId === driverId &&
        d.scheduledDate >= dayStart &&
        d.scheduledDate <= dayEnd
      );

      if (dayDeliveries.length > 0) {
        const dayOccurrences = dayDeliveries
          .flatMap(d => d.occurrences.map(occ => ({
            type: mapOccurrenceType(occ.type),
            deliveryId: d.id,
            timestamp: occ.createdAt,
          })));

        const dayRecord = calculateDailySLA(driverId, dayDeliveries.length, dayOccurrences);
        dayRecord.date = dayStart;
        dailyScores.push(dayRecord);
      }
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return {
      weekStart,
      weekEnd,
      driverId,
      dailyScores,
      weeklyAverage: calculateWeeklySLA(dailyScores),
    };
  }, [deliveries, weekStart]);

  // Get full SLA data for a driver (for UI display)
  const getDriverSLAData = useCallback((driverId: number): DriverSLAData | null => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return null;

    const dailySLA = getDriverDailySLA(driverId);
    const weeklySLA = getDriverWeeklySLA(driverId);
    
    const lastDeduction = dailySLA.deductions[dailySLA.deductions.length - 1];
    const lastOccurrence = lastDeduction ? {
      type: lastDeduction.occurrenceType,
      label: OCCURRENCE_RULES[lastDeduction.occurrenceType]?.labelPt || lastDeduction.occurrenceType,
      timestamp: lastDeduction.timestamp,
      pointsLost: lastDeduction.pointsDeducted,
    } : undefined;

    return {
      driverId,
      driverName: driver.name,
      currentDailySLA: dailySLA.finalScore,
      weeklySLA: weeklySLA.weeklyAverage,
      totalDeliveriestoday: dailySLA.totalDeliveries,
      occurrencesToday: dailySLA.deductions.length,
      lastOccurrence,
      colorScheme: getSLAColorScheme(dailySLA.finalScore),
    };
  }, [drivers, getDriverDailySLA, getDriverWeeklySLA]);

  // Get collective SLA report for all drivers in a period
  const getCollectiveSLAReport = useCallback((startDate: Date, endDate: Date): CollectiveSLAReport => {
    const driverData = drivers.map(driver => {
      // Get all deliveries for this driver in the period
      const driverDeliveries = deliveries.filter(d => 
        d.driverId === driver.id &&
        d.scheduledDate >= startDate &&
        d.scheduledDate <= endDate
      );

      // Group by day and calculate daily scores
      const dailyScoresMap = new Map<string, number[]>();
      
      driverDeliveries.forEach(delivery => {
        const dayKey = delivery.scheduledDate.toISOString().split('T')[0];
        if (!dailyScoresMap.has(dayKey)) {
          dailyScoresMap.set(dayKey, []);
        }
        
        // For simplicity, calculate score contribution per delivery
        // In real app, would aggregate by day first
        const hasOccurrence = delivery.occurrences.length > 0;
        const pointContribution = hasOccurrence ? 50 : 100; // Simplified
        dailyScoresMap.get(dayKey)!.push(pointContribution);
      });

      // Calculate daily averages
      const dailyScores: number[] = [];
      dailyScoresMap.forEach(scores => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        dailyScores.push(avg);
      });

      return {
        driverId: driver.id,
        driverName: driver.name,
        dailyScores,
        totalDeliveries: driverDeliveries.length,
      };
    }).filter(d => d.totalDeliveries > 0);

    const report = calculateCollectiveSLA(driverData);
    report.startDate = startDate;
    report.endDate = endDate;
    
    return report;
  }, [drivers, deliveries]);

  // Get all drivers' SLA data sorted by score
  const getAllDriversSLA = useMemo((): DriverSLAData[] => {
    return drivers
      .map(driver => getDriverSLAData(driver.id))
      .filter((data): data is DriverSLAData => data !== null)
      .sort((a, b) => a.currentDailySLA - b.currentDailySLA); // Worst first
  }, [drivers, getDriverSLAData]);

  // Get drivers with critical SLA (below 75%)
  const getCriticalDrivers = useMemo((): DriverSLAData[] => {
    return getAllDriversSLA.filter(d => d.currentDailySLA < 75);
  }, [getAllDriversSLA]);

  // Get drivers at risk (75-89%)
  const getAtRiskDrivers = useMemo((): DriverSLAData[] => {
    return getAllDriversSLA.filter(d => d.currentDailySLA >= 75 && d.currentDailySLA < 90);
  }, [getAllDriversSLA]);

  // Overall fleet SLA
  const fleetSLA = useMemo((): number => {
    if (getAllDriversSLA.length === 0) return 100;
    const sum = getAllDriversSLA.reduce((acc, d) => acc + d.currentDailySLA, 0);
    return sum / getAllDriversSLA.length;
  }, [getAllDriversSLA]);

  // Simulate registering a new occurrence (triggers SLA recalculation)
  const registerOccurrence = useCallback((
    driverId: number,
    deliveryId: string,
    occurrenceType: string
  ): { newSLA: number; pointsLost: number; isCritical: boolean } => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) throw new Error("Driver not found");

    const driverDeliveries = deliveries.filter(d => 
      d.driverId === driverId &&
      d.scheduledDate >= todayStart &&
      d.scheduledDate <= todayEnd
    );

    const totalDeliveries = Math.max(driverDeliveries.length, 1);
    const pointValue = calculatePointValue(totalDeliveries);
    const rule = OCCURRENCE_RULES[occurrenceType];
    const pointsLost = pointValue * (rule?.discountMultiplier || 0);
    
    const currentSLA = getDriverDailySLA(driverId);
    const newSLA = Math.max(0, currentSLA.finalScore - pointsLost);
    const isCritical = isVerySevereOccurrence(occurrenceType);

    // Trigger alert if SLA drops below 70%
    if (newSLA < 70) {
      notificationStore.triggerDelayAlert(driver.name, driverId, newSLA);
    }

    return {
      newSLA,
      pointsLost,
      isCritical,
    };
  }, [drivers, deliveries, todayStart, todayEnd, getDriverDailySLA]);

  return {
    // Individual driver data
    getDriverDailySLA,
    getDriverWeeklySLA,
    getDriverSLAData,
    
    // Fleet-wide data
    getAllDriversSLA,
    getCriticalDrivers,
    getAtRiskDrivers,
    fleetSLA,
    
    // Collective reports
    getCollectiveSLAReport,
    periodFilter,
    setPeriodFilter,
    
    // Actions
    registerOccurrence,
    
    // Helpers
    formatSLAScore,
    getSLAColorScheme,
    OCCURRENCE_RULES,
  };
}

export default useSLA;
