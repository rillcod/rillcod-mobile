import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface UserPresence {
    userId: string;
    userName: string;
    status: 'online' | 'away' | 'offline';
    lastSeen: string;
}

export const usePresence = () => {
    const { profile } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresence>>({});

    useEffect(() => {
        if (!profile?.id) return;

        const channel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: profile.id,
                },
            },
        });

        const syncPresence = () => {
            const state = channel.presenceState();
            const transformed: Record<string, UserPresence> = {};

            Object.keys(state).forEach((key) => {
                const presence = state[key]?.[0] as any;
                if (presence) {
                    transformed[key] = {
                        userId: key,
                        userName: presence.userName || 'Anonymous',
                        status: 'online',
                        lastSeen: new Date().toISOString(),
                    };
                }
            });

            setOnlineUsers(transformed);
        };

        channel
            .on('presence', { event: 'sync' }, syncPresence)
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                // Potential haptis or notification?
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                // Update local state if needed between syncs
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        userName: profile?.full_name || 'User',
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    }, [profile?.id, profile?.full_name]);

    return onlineUsers;
};
