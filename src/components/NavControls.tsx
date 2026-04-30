import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Theme } from '../theme';

interface Props {
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  theme: Theme;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onHome: () => void;
}

export function NavControls({
  canGoBack,
  canGoForward,
  loading,
  theme,
  onBack,
  onForward,
  onReload,
  onHome,
}: Props) {
  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.btn}
        onPress={onBack}
        disabled={!canGoBack}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Text style={[styles.icon, !canGoBack && styles.disabled]}>‹</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={onForward}
        disabled={!canGoForward}
        accessibilityLabel="Go forward"
        accessibilityRole="button"
      >
        <Text style={[styles.icon, !canGoForward && styles.disabled]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={onReload}
        accessibilityLabel={loading ? 'Stop loading' : 'Reload page'}
        accessibilityRole="button"
      >
        <Text style={styles.icon}>{loading ? '✕' : '↻'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={onHome}
        accessibilityLabel="Go to home"
        accessibilityRole="button"
      >
        <Text style={styles.icon}>⌂</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    btn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      fontSize: 20,
      color: theme.icon,
    },
    disabled: {
      color: theme.textMuted,
    },
  });
}
