import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryEntry } from '../hooks/useHistory';
import { Theme } from '../theme';

interface Props {
  visible: boolean;
  history: HistoryEntry[];
  theme: Theme;
  onClose: () => void;
  onOpen: (url: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ visible, history, theme, onClose, onOpen, onClear }: Props) {
  const styles = makeStyles(theme);

  function formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
          <Text style={styles.title}>History</Text>
          <View style={styles.headerActions}>
            {history.length > 0 && (
              <TouchableOpacity
                onPress={onClear}
                style={styles.clearBtn}
                accessibilityLabel="Clear all history"
                accessibilityRole="button"
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close history panel"
              accessibilityRole="button"
            >
              <Text style={styles.closeBtn}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>

        {history.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No history yet.</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.item}
                onPress={() => {
                  onOpen(item.url);
                  onClose();
                }}
                accessibilityLabel={`Open: ${item.title}`}
                accessibilityRole="button"
              >
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
                <Text style={styles.itemTime}>{formatDate(item.visitedAt)}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    clearBtn: {},
    clearBtnText: {
      fontSize: 16,
      color: theme.danger,
      fontWeight: '600',
    },
    closeBtn: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: '600',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    itemUrl: {
      fontSize: 12,
      color: theme.textMuted,
    },
    itemTime: {
      fontSize: 11,
      color: theme.textMuted,
      marginLeft: 8,
    },
    separator: {
      height: 1,
      backgroundColor: theme.border,
      marginLeft: 16,
    },
  });
}
