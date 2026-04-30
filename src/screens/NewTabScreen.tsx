import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Theme } from '../theme';
import { searchEngineUrl } from '../utils/url';
import { Bookmark } from '../hooks/useBookmarks';
import { Settings } from '../hooks/useSettings';

interface Props {
  theme: Theme;
  bookmarks: Bookmark[];
  settings: Settings;
  onNavigate: (url: string) => void;
}

export function NewTabScreen({ theme, bookmarks, settings, onNavigate }: Props) {
  const [time, setTime] = useState(new Date());
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleSearch() {
    if (!query.trim()) return;
    onNavigate(searchEngineUrl(settings.searchEngine, query));
    setQuery('');
  }

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Clock */}
        <Text style={styles.clock} accessibilityLabel={`Current time: ${hours}:${minutes}`}>
          {hours}:{minutes}
        </Text>

        <Text style={styles.date} accessibilityLabel="Today's date">
          {time.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search the web…"
            placeholderTextColor={theme.textMuted}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search bar"
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearch}
            accessibilityLabel="Search"
            accessibilityRole="button"
          >
            <Text style={styles.searchBtnText}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Bookmarks quick-access grid */}
        {bookmarks.length > 0 && (
          <>
            <Text style={styles.gridTitle}>Bookmarks</Text>
            <View style={styles.grid}>
              {bookmarks.slice(0, 8).map(bm => (
                <TouchableOpacity
                  key={bm.id}
                  style={styles.gridItem}
                  onPress={() => onNavigate(bm.url)}
                  accessibilityLabel={`Open bookmark: ${bm.title}`}
                  accessibilityRole="button"
                >
                  <View style={styles.gridIcon}>
                    <Text style={styles.gridIconText}>🔖</Text>
                  </View>
                  <Text style={styles.gridLabel} numberOfLines={2}>
                    {bm.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      alignItems: 'center',
      paddingTop: 48,
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    clock: {
      fontSize: 64,
      fontWeight: '200',
      color: theme.text,
      letterSpacing: 2,
    },
    date: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 4,
      marginBottom: 32,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      height: 52,
      width: '100%',
      maxWidth: 480,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      paddingVertical: 0,
    },
    searchBtn: {
      paddingLeft: 8,
    },
    searchBtnText: {
      fontSize: 20,
    },
    gridTitle: {
      alignSelf: 'flex-start',
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      marginTop: 32,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      gap: 12,
      width: '100%',
      maxWidth: 480,
    },
    gridItem: {
      width: 72,
      alignItems: 'center',
    },
    gridIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    gridIconText: {
      fontSize: 24,
    },
    gridLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });
}
