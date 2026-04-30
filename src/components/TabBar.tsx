import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
} from 'react-native';
import { Tab } from '../hooks/useTabs';
import { Theme } from '../theme';
import { faviconUrl } from '../utils/url';

interface Props {
  tabs: Tab[];
  activeTabId: string;
  theme: Theme;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export function TabBar({ tabs, activeTabId, theme, onSelectTab, onCloseTab, onNewTab }: Props) {
  const styles = makeStyles(theme);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {tabs.map(tab => {
          const active = tab.id === activeTabId;
          const favicon = tab.url ? faviconUrl(tab.url) : null;
          const title = tab.title && tab.title !== tab.url ? tab.title : 'New Tab';

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => onSelectTab(tab.id)}
              accessibilityLabel={`Tab: ${title}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              {favicon ? (
                <Image
                  source={{ uri: favicon }}
                  style={styles.favicon}
                  accessibilityLabel={`Favicon for ${title}`}
                />
              ) : (
                <View style={[styles.favicon, styles.faviconPlaceholder]}>
                  <Text style={styles.faviconText}>🌐</Text>
                </View>
              )}

              <Text
                style={[styles.tabTitle, active && styles.tabTitleActive]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => onCloseTab(tab.id)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityLabel={`Close tab: ${title}`}
                accessibilityRole="button"
              >
                <Text style={styles.closeIcon}>×</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={styles.newTabBtn}
        onPress={onNewTab}
        accessibilityLabel="Open new tab"
        accessibilityRole="button"
      >
        <Text style={styles.newTabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      alignItems: 'center',
      height: 44,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginHorizontal: 2,
      height: 36,
      maxWidth: 160,
      minWidth: 80,
      backgroundColor: 'transparent',
    },
    tabActive: {
      backgroundColor: theme.surfaceVariant,
    },
    favicon: {
      width: 14,
      height: 14,
      marginRight: 4,
      borderRadius: 2,
    },
    faviconPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    faviconText: {
      fontSize: 10,
    },
    tabTitle: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
    },
    tabTitleActive: {
      color: theme.tabActive,
      fontWeight: '600',
    },
    closeBtn: {
      marginLeft: 4,
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: {
      fontSize: 16,
      color: theme.textMuted,
      lineHeight: 16,
    },
    newTabBtn: {
      width: 40,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderLeftWidth: 1,
      borderLeftColor: theme.border,
    },
    newTabIcon: {
      fontSize: 22,
      color: theme.icon,
      lineHeight: 28,
    },
  });
}
