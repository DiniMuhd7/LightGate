import { ColorSchemeName } from 'react-native';

export interface Theme {
  background: string;
  surface: string;
  surfaceVariant: string;
  border: string;
  primary: string;
  primaryText: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  icon: string;
  iconActive: string;
  progressBar: string;
  tabActive: string;
  tabInactive: string;
  danger: string;
  shadow: string;
}

const light: Theme = {
  background: '#ffffff',
  surface: '#f8f9fa',
  surfaceVariant: '#e8eaed',
  border: '#dadce0',
  primary: '#1a73e8',
  primaryText: '#ffffff',
  text: '#202124',
  textSecondary: '#5f6368',
  textMuted: '#9aa0a6',
  icon: '#5f6368',
  iconActive: '#1a73e8',
  progressBar: '#1a73e8',
  tabActive: '#1a73e8',
  tabInactive: '#5f6368',
  danger: '#d93025',
  shadow: 'rgba(0,0,0,0.1)',
};

const dark: Theme = {
  background: '#202124',
  surface: '#292a2d',
  surfaceVariant: '#35363a',
  border: '#3c4043',
  primary: '#8ab4f8',
  primaryText: '#202124',
  text: '#e8eaed',
  textSecondary: '#9aa0a6',
  textMuted: '#5f6368',
  icon: '#9aa0a6',
  iconActive: '#8ab4f8',
  progressBar: '#8ab4f8',
  tabActive: '#8ab4f8',
  tabInactive: '#9aa0a6',
  danger: '#f28b82',
  shadow: 'rgba(0,0,0,0.4)',
};

export function getTheme(scheme: ColorSchemeName, override?: 'light' | 'dark'): Theme {
  const resolved = override ?? scheme ?? 'light';
  return resolved === 'dark' ? dark : light;
}

export { light, dark };
