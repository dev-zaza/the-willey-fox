import React from 'react';
import { Ionicons as _Ionicons } from '@expo/vector-icons';
import { IconProps } from '@expo/vector-icons/build/createIconSet';

// Wrapper to fix `refs` type mismatch in @expo/vector-icons with RN new arch
export function Ionicons(props: IconProps<string>) {
  return React.createElement(_Ionicons as any, props);
}
