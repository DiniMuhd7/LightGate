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
import { Bookmark } from '../hooks/useBookmarks';
import { Theme } from '../theme';

interface Props {
  visible: boolean;
  bookmarks: Bookmark[];
  theme: Theme;
  onClose: () => void;
  onOpen: (url: string) => void;
  onRemove: (id: string) => void;
}

export function BookmarksPanel({ visible, bookmarks, theme, onClose, onOpen, onRemove }: Props) {
  const styles = makeStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bookmarks</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close bookmarks panel"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtn}>Done</Text>
          </TouchableOpacity>
        </View>

        {bookmarks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bookmarks yet.</Text>
            <Text style={styles.emptyHint}>Tap the bookmark icon to save a page.</Text>
          </View>
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <TouchableOpacity
                  style={styles.itemContent}
                  onPress={() => {
                    onOpen(item.url);
                    onClose();
                  }}
                  accessibilityLabel={`Open bookmark: ${item.title}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onRemove(item.id)}
                  accessibilityLabel={`Remove bookmark: ${item.title}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              </View>
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
    closeBtn: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: '600',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    emptyHint: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: 'center',
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
    deleteBtn: {
      paddingLeft: 12,
      paddingVertical: 4,
    },
    deleteIcon: {
      fontSize: 18,
    },
    separator: {
      height: 1,
      backgroundColor: theme.border,
      marginLeft: 16,
    },
  });
}
