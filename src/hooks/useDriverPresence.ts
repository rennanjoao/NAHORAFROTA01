import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook for the DRIVER app: joins the `room_drivers` Presence channel.
 * When the driver closes the app/tab, Supabase automatically fires `leave`.
 */
export function useDriverPresence(driverId: string | null, driverName: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!driverId || !driverName) return;

    const channel = supabase.channel('room_drivers', {
      config: { presence: { key: driverId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('📡 Presence synced (driver side)');
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            driver_id: driverId,
            driver_name: driverName,
            online_at: new Date().toISOString(),
          });
          console.log('✅ Driver Presence: tracked', driverId);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [driverId, driverName]);
}
