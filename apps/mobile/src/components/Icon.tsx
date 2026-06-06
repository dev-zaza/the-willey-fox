import React from 'react';
import { Ionicons as _Ionicons } from '@expo/vector-icons';

// Cast away the broken `refs` type mismatch in @expo/vector-icons with RN new arch
export const Ionicons = _Ionicons as unknown as React.ComponentType<React.ComponentProps<typeof _Ionicons>>;
