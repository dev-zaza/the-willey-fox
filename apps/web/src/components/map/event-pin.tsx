'use client';

import { divIcon } from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import { PIN_COLORS } from '@/types';
import type { PinData } from '@/lib/api';

interface EventPinProps {
  pin: PinData;
  onClick?: (pin: PinData) => void;
}

function createPinIcon(color: string) {
  const svg = `
    <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg" class="custom-pin-marker drop-marker">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z"
        fill="${color}" fill-opacity="0.9"/>
      <circle cx="16" cy="16" r="6" fill="white" fill-opacity="0.9"/>
      <circle cx="16" cy="16" r="3" fill="${color}"/>
    </svg>
  `;
  return divIcon({
    html: svg,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    tooltipAnchor: [0, -44],
  });
}

export function EventPin({ pin, onClick }: EventPinProps) {
  const color = PIN_COLORS[pin.type as keyof typeof PIN_COLORS] ?? '#ea2e00';
  const icon = createPinIcon(color);

  return (
    <Marker
      position={[parseFloat(pin.lat), parseFloat(pin.lng)]}
      icon={icon}
      eventHandlers={{ click: () => onClick?.(pin) }}
    >
      <Tooltip direction="top" offset={[0, -44]} opacity={0.95}>
        <div className="text-xs font-medium">{pin.title}</div>
        <div className="text-xs text-[#7a6957]">{pin.type}</div>
      </Tooltip>
    </Marker>
  );
}
