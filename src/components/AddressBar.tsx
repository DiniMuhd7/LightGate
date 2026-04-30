import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Theme } from '../theme';
import { displayUrl } from '../utils/url';

interface Props {
  url: string;
  loading: boolean;
  theme: Theme;
  onSubmit: (url: string) => void;
}

export function AddressBar({ url, loading, theme, onSubmit }: Props) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const displayValue = editing ? inputValue : displayUrl(url) || url;

  function handleFocus() {
    setEditing(true);
    setInputValue(url);
  }

  function handleBlur() {
    setEditing(false);
  }

  function handleSubmit() {
    setEditing(false);
    onSubmit(inputValue);
  }

  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={displayValue}
        onChangeText={setInputValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        selectTextOnFocus
        accessibilityLabel="Address bar"
        placeholder="Search or enter URL"
        placeholderTextColor={theme.textMuted}
        underlineColorAndroid="transparent"
      />
      {loading ? (
        <ActivityIndicator
          size="small"
          color={theme.primary}
          style={styles.actionBtn}
          accessibilityLabel="Loading"
        />
      ) : (
        <TouchableOpacity
          style={styles.goBtn}
          onPress={handleSubmit}
          accessibilityLabel="Go to URL"
          accessibilityRole="button"
        >
          <Text style={styles.goBtnText}>Go</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceVariant,
      borderRadius: 22,
      paddingHorizontal: 12,
      height: 40,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      paddingVertical: 0,
    },
    actionBtn: {
      marginLeft: 6,
    },
    goBtn: {
      marginLeft: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.primary,
      borderRadius: 12,
    },
    goBtnText: {
      color: theme.primaryText,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
