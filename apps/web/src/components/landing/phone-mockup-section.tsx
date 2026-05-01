'use client';

import { motion } from 'framer-motion';
import { Navigation, ShieldAlert, MapPin, Search, Menu, Plus, Locate, Clock } from 'lucide-react';
import Image from 'next/image';

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 280, height: 570 }}>
      {/* iPhone frame */}
      <div className="absolute inset-0 bg-gray-900 rounded-[3rem] shadow-2xl shadow-gray-900/40 border-[3px] border-gray-700">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-900 rounded-b-2xl z-20" />
        {/* Side buttons */}
        <div className="absolute -right-[5px] top-28 w-[3px] h-12 bg-gray-700 rounded-r-sm" />
        <div className="absolute -left-[5px] top-24 w-[3px] h-8 bg-gray-700 rounded-l-sm" />
        <div className="absolute -left-[5px] top-36 w-[3px] h-12 bg-gray-700 rounded-l-sm" />

        {/* Screen */}
        <div className="absolute inset-[3px] rounded-[2.7rem] overflow-hidden bg-gray-100">
          {/* Map background */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: '#e8e4df', backgroundSize: 'cover' }}
          >
            {/* Fake map grid */}
            <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="180" x2="280" y2="180" stroke="#9ca3af" strokeWidth="2" />
              <line x1="0" y1="280" x2="280" y2="280" stroke="#9ca3af" strokeWidth="1.5" />
              <line x1="0" y1="380" x2="280" y2="380" stroke="#9ca3af" strokeWidth="1.5" />
              <line x1="0" y1="450" x2="280" y2="450" stroke="#9ca3af" strokeWidth="1" />
              <line x1="70" y1="0" x2="70" y2="570" stroke="#9ca3af" strokeWidth="2" />
              <line x1="140" y1="0" x2="140" y2="570" stroke="#9ca3af" strokeWidth="1.5" />
              <line x1="200" y1="0" x2="200" y2="570" stroke="#9ca3af" strokeWidth="1.5" />
              <line x1="0" y1="100" x2="140" y2="280" stroke="#9ca3af" strokeWidth="1" />
              <line x1="140" y1="280" x2="280" y2="400" stroke="#9ca3af" strokeWidth="1" />
            </svg>
            {/* Map blocks */}
            <div className="absolute top-[120px] left-[20px] w-[40px] h-[50px] bg-gray-300/30 rounded-sm" />
            <div className="absolute top-[200px] left-[80px] w-[50px] h-[70px] bg-gray-300/30 rounded-sm" />
            <div className="absolute top-[300px] left-[150px] w-[60px] h-[40px] bg-gray-300/30 rounded-sm" />
            <div className="absolute top-[350px] left-[30px] w-[35px] h-[55px] bg-gray-300/30 rounded-sm" />
            <div className="absolute top-[150px] left-[170px] w-[45px] h-[60px] bg-emerald-200/20 rounded-sm" />
            <div className="absolute top-[400px] left-[180px] w-[55px] h-[45px] bg-gray-300/30 rounded-sm" />
          </div>

          {/* Route SVG */}
          <svg className="absolute inset-0 w-full h-full z-10" xmlns="http://www.w3.org/2000/svg">
            {/* Shadow */}
            <path
              d="M 140 480 Q 130 400 120 350 Q 100 280 140 220 Q 160 180 170 140 Q 175 110 160 80"
              fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="8" strokeLinecap="round"
            />
            {/* Route */}
            <path
              d="M 140 480 Q 130 400 120 350 Q 100 280 140 220 Q 160 180 170 140 Q 175 110 160 80"
              fill="none" stroke="#ea2e00" strokeWidth="4" strokeLinecap="round"
            />
            {/* Current location */}
            <circle cx="140" cy="480" r="12" fill="rgba(59,130,246,0.15)" />
            <circle cx="140" cy="480" r="6" fill="#3B82F6" stroke="white" strokeWidth="2.5" />
            {/* Destination */}
            <circle cx="160" cy="80" r="8" fill="rgba(234,46,0,0.2)" />
            <circle cx="160" cy="80" r="4" fill="#ea2e00" stroke="white" strokeWidth="2" />
          </svg>

          {/* Event pins */}
          <div className="absolute z-10" style={{ top: 200, left: 60 }}>
            <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">!</span>
            </div>
          </div>
          <div className="absolute z-10" style={{ top: 310, left: 190 }}>
            <div className="w-6 h-6 bg-yellow-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">⚠</span>
            </div>
          </div>
          <div className="absolute z-10" style={{ top: 160, left: 220 }}>
            <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">★</span>
            </div>
          </div>

          {/* Top bar */}
          <div className="absolute top-8 left-3 right-3 z-20 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white shadow-md overflow-hidden ring-1 ring-gray-200 flex-shrink-0">
              <Image src="/logo.png" alt="" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 bg-white rounded-xl py-2 px-3 shadow-md flex items-center gap-1.5">
              <Search className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-400">Where to?</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center flex-shrink-0">
              <Menu className="w-3.5 h-3.5 text-gray-600" />
            </div>
          </div>

          {/* Route info card */}
          <div className="absolute top-[52px] left-3 right-3 z-20">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2.5 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-gray-900">Golden Gate Bridge</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-2.5 h-2.5 text-gray-400" />
                    <span className="text-[9px] text-gray-500">18 min</span>
                    <span className="text-[9px] text-gray-500">· 5.2 km</span>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
                  <Navigation className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                <p className="text-[8px] text-brand-600 font-medium">⚠️ 2 events may affect your route</p>
              </div>
            </div>
          </div>

          {/* Bottom right buttons */}
          <div className="absolute bottom-6 right-3 z-20 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
              <Locate className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <div className="w-10 h-10 rounded-full bg-brand-500 shadow-lg shadow-brand-500/30 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* SOS button */}
          <div className="absolute bottom-6 left-3 z-20">
            <div className="w-10 h-10 rounded-full bg-red-600 shadow-lg flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <p className="text-[7px] text-center mt-0.5 font-bold text-red-600">SOS</p>
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-900/20 rounded-full z-20" />
        </div>
      </div>
    </div>
  );
}

export function PhoneMockupSection() {
  return (
    <section
      className="py-24 sm:py-32 px-4 overflow-hidden"
      style={{ background: '#f0e7d6' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">
          {/* Text side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1 text-center lg:text-left"
          >
            <span
              className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
              style={{ color: '#9d8c7a' }}
            >
              In your pocket
            </span>
            <h2
              className="text-4xl sm:text-5xl tracking-tight mb-6 leading-[1.05]"
              style={{
                fontFamily: 'var(--font-display, Georgia, serif)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#1b1410',
              }}
            >
              Your safety companion,
              <br />
              <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
                always with you
              </em>
              .
            </h2>
            <p className="text-lg mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0" style={{ color: '#5a4a3d' }}>
              See real-time incidents on the map, get smart route suggestions that avoid
              hazards, and alert your emergency contacts with a single tap.
            </p>
            <div className="space-y-3.5">
              <div className="flex items-center gap-3 justify-center lg:justify-start">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#f7eedb', border: '1px solid rgba(234,46,0,0.18)' }}
                >
                  <Navigation className="w-4 h-4" style={{ color: '#ea2e00' }} />
                </div>
                <span className="font-medium" style={{ color: '#1b1410' }}>Live navigation with hazard avoidance</span>
              </div>
              <div className="flex items-center gap-3 justify-center lg:justify-start">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#fde7e2', border: '1px solid rgba(220,38,38,0.18)' }}
                >
                  <ShieldAlert className="w-4 h-4" style={{ color: '#dc2626' }} />
                </div>
                <span className="font-medium" style={{ color: '#1b1410' }}>One-tap SOS to emergency contacts</span>
              </div>
              <div className="flex items-center gap-3 justify-center lg:justify-start">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(157,189,184,0.22)', border: '1px solid rgba(157,189,184,0.45)' }}
                >
                  <MapPin className="w-4 h-4" style={{ color: '#5e8a85' }} />
                </div>
                <span className="font-medium" style={{ color: '#1b1410' }}>Community-reported pins and alerts</span>
              </div>
            </div>
          </motion.div>

          {/* Phone side */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-shrink-0"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <PhoneMockup />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
