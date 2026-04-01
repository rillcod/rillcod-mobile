import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { usePresence, UserPresence } from '../hooks/usePresence';
import { useTheme } from '../contexts/ThemeContext';
import { FONT_FAMILY, FONT_SIZE } from '../constants/typography';
import { RADIUS, SPACING } from '../constants/spacing';

export const PresenceList = () => {
    const { colors } = useTheme();
    const onlineUsers = usePresence();
    const styles = getStyles(colors);

    const users = Object.values(onlineUsers);

    if (users.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.dot} />
                <Text style={styles.title}>ONLINE NOW ({users.length})</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {users.map((user) => (
                    <TouchableOpacity key={user.userId} style={styles.userCard} activeOpacity={0.7}>
                        <View style={styles.avatarWrap}>
                            <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                                <Text style={[styles.avatarText, { color: colors.primary }]}>
                                    {(user.userName || 'U')[0].toUpperCase()}
                                </Text>
                            </View>
                            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                        </View>
                        <Text style={styles.userName} numberOfLines={1}>
                            {user.userName.split(' ')[0]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const getStyles = (colors: any) => StyleSheet.create({
    container: { marginVertical: SPACING.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.xl, marginBottom: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    title: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: colors.textMuted, letterSpacing: 1.5 },
    scroll: { paddingHorizontal: SPACING.xl, gap: 12 },
    userCard: { alignItems: 'center', gap: 6, width: 64 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    avatarText: { fontFamily: FONT_FAMILY.display, fontSize: 16 },
    statusDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.bgCard },
    userName: { fontFamily: FONT_FAMILY.bodyMed, fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
});
