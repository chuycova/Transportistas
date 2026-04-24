import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useTheme } from '@lib/ThemeContext';

interface PanicFabProps {
  holding: boolean;
  countdown: number;
  animatedStyle: Parameters<typeof Animated.View>[0]['style'];
  onPressIn: () => void;
  onPressOut: () => void;
}

export function PanicFab({ holding, countdown, animatedStyle, onPressIn, onPressOut }: PanicFabProps) {
  const { isDark } = useTheme();
  return (
    <Animated.View style={[styles.fab, animatedStyle]}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
        style={[
          styles.inner,
          { backgroundColor: isDark ? 'rgba(180,40,40,0.6)' : 'rgba(220,60,60,0.65)' },
          holding && styles.holding,
        ]}
        accessibilityLabel="Boton de panico - manten 5 segundos"
        accessibilityRole="button"
      >
        {holding ? (
          <Text style={styles.countdown}>{countdown}</Text>
        ) : (
          <Ionicons name="shield-outline" size={20} color="rgba(255,255,255,0.9)" />
        )}
        <Text style={styles.label}>{holding ? 'SOS...' : 'SOS'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', top: 56, right: 16, zIndex: 20,
  },
  inner: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 7,
  },
  holding: { backgroundColor: 'rgba(220,40,40,0.85)' },
  countdown: { color: '#fff', fontSize: 18, fontWeight: '900' },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 8, fontWeight: '700', letterSpacing: 0.8, marginTop: 1 },
});
