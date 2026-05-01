import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Settings } from '../hooks/useSettings';
import { Theme } from '../theme';

interface Props {
  visible: boolean;
  settings: Settings;
  theme: Theme;
  onClose: () => void;
  onUpdateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onClearData: () => void;
}

const SEARCH_ENGINES: { key: Settings['searchEngine']; label: string }[] = [
  { key: 'duckduckgo', label: 'DuckDuckGo' },
  { key: 'google', label: 'Google' },
  { key: 'bing', label: 'Bing' },
];

const THEME_OPTIONS: { key: Settings['themeOverride']; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export function SettingsPanel({
  visible,
  settings,
  theme,
  onClose,
  onUpdateSetting,
  onClearData,
}: Props) {
  const styles = makeStyles(theme);

  function handleClearData() {
    Alert.alert(
      'Clear Browsing Data',
      'This will delete all bookmarks, history, and settings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            onClearData();
          },
        },
      ],
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close settings panel"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtn}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Search Engine */}
          <Text style={styles.sectionLabel}>Search Engine</Text>
          <View style={styles.card}>
            {SEARCH_ENGINES.map((engine, index) => (
              <React.Fragment key={engine.key}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onUpdateSetting('searchEngine', engine.key)}
                  accessibilityLabel={`Set search engine to ${engine.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: settings.searchEngine === engine.key }}
                >
                  <Text style={styles.rowLabel}>{engine.label}</Text>
                  {settings.searchEngine === engine.key && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
                {index < SEARCH_ENGINES.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Theme */}
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={styles.card}>
            {THEME_OPTIONS.map((opt, index) => (
              <React.Fragment key={opt.key}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onUpdateSetting('themeOverride', opt.key)}
                  accessibilityLabel={`Set theme to ${opt.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: settings.themeOverride === opt.key }}
                >
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                  {settings.themeOverride === opt.key && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
                {index < THEME_OPTIONS.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>

          {/* JavaScript Toggle */}
          <Text style={styles.sectionLabel}>Privacy & Security</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>JavaScript</Text>
              <Switch
                value={settings.javaScriptEnabled}
                onValueChange={val => onUpdateSetting('javaScriptEnabled', val)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={theme.primaryText}
                accessibilityLabel="Toggle JavaScript"
              />
            </View>
          </View>

          {/* Clear Data */}
          <Text style={styles.sectionLabel}>Data</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleClearData}
              accessibilityLabel="Clear all browsing data"
              accessibilityRole="button"
            >
              <Text style={[styles.rowLabel, { color: theme.danger }]}>
                Clear Browsing Data
              </Text>
            </TouchableOpacity>
          </View>

          {/* Version */}
          <Text style={styles.version}>LifeGate v1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    closeBtn: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: '600',
    },
    scroll: {
      paddingVertical: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
    },
    card: {
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    checkmark: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginLeft: 16,
    },
    version: {
      textAlign: 'center',
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 32,
      marginBottom: 16,
    },
  });
}
