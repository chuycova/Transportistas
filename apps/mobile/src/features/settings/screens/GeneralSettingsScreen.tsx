import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';

export function GeneralSettingsScreen() {
  const [isLightTheme, setIsLightTheme] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Apariencia</Text>
      
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Tema claro</Text>
          <Switch
            value={isLightTheme}
            onValueChange={setIsLightTheme}
            trackColor={{ true: '#6C63FF', false: '#CCC' }}
            thumbColor={isLightTheme ? '#FFFFFF' : '#F4F3F4'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    color: '#8888AA',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEAEE',
    marginBottom: 32,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: {
    color: '#0A0A0F',
    fontSize: 16,
    fontWeight: '500',
  },
});
