import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Text, ActivityIndicator, View, StyleSheet, Platform,
} from 'react-native';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Onboarding
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

// Main tab screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import LearnScreen from '../screens/learn/LearnScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';
import MoreScreen from '../screens/dashboard/MoreScreen';

// Detail / stack screens
import AssignmentsScreen from '../screens/dashboard/AssignmentsScreen';
import GradesScreen from '../screens/dashboard/GradesScreen';
import CertificatesScreen from '../screens/dashboard/CertificatesScreen';
import InvoicesScreen from '../screens/dashboard/InvoicesScreen';
import MessagesScreen from '../screens/dashboard/MessagesScreen';
import SettingsScreen from '../screens/dashboard/SettingsScreen';
import MyChildrenScreen from '../screens/dashboard/MyChildrenScreen';
import AnalyticsScreen from '../screens/dashboard/AnalyticsScreen';
import ParentResultsScreen from '../screens/dashboard/ParentResultsScreen';
import ParentAttendanceScreen from '../screens/dashboard/ParentAttendanceScreen';
import ParentGradesScreen from '../screens/dashboard/ParentGradesScreen';
import ParentInvoicesScreen from '../screens/dashboard/ParentInvoicesScreen';
import ParentCertificatesScreen from '../screens/dashboard/ParentCertificatesScreen';

import { COLORS } from '../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../constants/typography';
import { RADIUS } from '../constants/spacing';

import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<any>();
const Tab   = createBottomTabNavigator<TabParamList>();

const ONBOARDING_KEY = 'rillcod_onboarding_done';

// ── Animated tab icon ─────────────────────────────────────────────────────────
function TabIcon({ emoji, focused, badge }: { emoji: string; focused: boolean; badge?: number }) {
  return (
    <MotiView
      animate={{
        scale: focused ? 1.12 : 1,
        backgroundColor: focused ? COLORS.primaryPale : 'transparent',
      }}
      transition={{ type: 'spring', damping: 18 }}
      style={styles.tabIconWrap}
    >
      {focused && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 0.65 }}
          style={styles.tabGlow}
        />
      )}
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </MotiView>
  );
}

// ── Main bottom tabs ──────────────────────────────────────────────────────────
function MainTabs() {
  const { profile } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      setUnread(count ?? 0);
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primaryLight,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Learn"
        component={LearnScreen}
        options={{
          tabBarLabel: 'Learn',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} badge={unread} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => <TabIcon emoji="☰" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Main app stack (tabs + detail screens) ────────────────────────────────────
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
      <Stack.Screen name="Assignments" component={AssignmentsScreen} />
      <Stack.Screen name="Grades" component={GradesScreen} />
      <Stack.Screen name="Certificates" component={CertificatesScreen} />
      <Stack.Screen name="Invoices" component={InvoicesScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="MyChildren" component={MyChildrenScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="ParentResults" component={ParentResultsScreen} />
      <Stack.Screen name="ParentAttendance" component={ParentAttendanceScreen} />
      <Stack.Screen name="ParentGrades" component={ParentGradesScreen} />
      <Stack.Screen name="ParentInvoices" component={ParentInvoicesScreen} />
      <Stack.Screen name="ParentCertificates" component={ParentCertificatesScreen} />
    </Stack.Navigator>
  );
}

// ── Root navigator ────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { session, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  if (loading || onboardingDone === null) {
    return (
      <View style={styles.loader}>
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
        >
          <ActivityIndicator color={COLORS.primary} size="large" />
        </MotiView>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {session ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : onboardingDone ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Onboarding"
              options={{ animation: 'fade' }}
            >
              {(props: any) => (
                <OnboardingScreen
                  {...props}
                  navigation={{
                    ...props.navigation,
                    replace: async (screen: string) => {
                      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
                      setOnboardingDone(true);
                      props.navigation.replace(screen as any);
                    },
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    backgroundColor: 'rgba(5,5,10,0.97)',
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 84 : 64,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  tabLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs - 1,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  tabIconWrap: {
    width: 44,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  tabGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primaryGlow,
    borderRadius: RADIUS.md,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.bg,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: FONT_FAMILY.bodySemi,
    color: '#fff',
  },
});
