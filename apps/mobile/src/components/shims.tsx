/**
 * Shims for third-party components that have `refs` type mismatches under RN new arch.
 * Each wrapper uses `any` props to bypass TS2786 / TS2344 while preserving runtime behavior.
 */
import React from 'react';
import {
  Tabs as _Tabs,
  Stack as _Stack,
} from 'expo-router';
import { CameraView as _CameraView } from 'expo-camera';
import _QRCode from 'react-native-qrcode-svg';
import { Controller as _Controller } from 'react-hook-form';

// ── expo-router: Tabs ────────────────────────────────────────────────────────
// Tabs.Screen must be the exact Screen reference — withLayoutContext uses
// `child.type === Screen` identity check; a wrapper function breaks it.
export function Tabs(props: any) { return React.createElement(_Tabs as any, props); }
Tabs.Screen = _Tabs.Screen as any;

// ── expo-router: Stack ───────────────────────────────────────────────────────
export function Stack(props: any) { return React.createElement(_Stack as any, props); }
Stack.Screen = _Stack.Screen as any;

// ── expo-camera: CameraView ──────────────────────────────────────────────────
export function CameraView(props: any) { return React.createElement(_CameraView as any, props); }

// ── react-native-qrcode-svg: QRCode ─────────────────────────────────────────
export function QRCode(props: any) { return React.createElement(_QRCode as any, props); }

// ── react-hook-form: Controller ──────────────────────────────────────────────
export function Controller(props: any) { return React.createElement(_Controller as any, props); }
