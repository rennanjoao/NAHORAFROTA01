import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook for the ADMIN dashboard: listens to the `room_drivers` Presence channel.
 * Returns a Set of driver_ids that are currently online (app open).
 */
export function useFleetPresence() {
  const [onlineDriverIds, setOnlineDriverIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase.channel('room_drivers');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        
        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((p) => {
            if (p.driver_id) {
              ids.add(p.driver_id);
            }
          });
        });

        setOnlineDriverIds(ids);
        console.log('📡 Fleet Presence sync:', ids.size, 'drivers online');
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('🟢 Driver joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('🔴 Driver left:', key, leftPresences);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  return onlineDriverIds;
}
