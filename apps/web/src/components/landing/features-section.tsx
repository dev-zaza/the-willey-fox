'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, MapPin, Navigation, Users } from 'lucide-react';

const FEATURES = [
  {
    title: 'Real-time Alerts',
    description: 'Get instant notifications about traffic, hazards, and events in your area.',
    icon: ShieldAlert,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    title: 'Community Pins',
    description: 'Share and discover local insights with our community-driven map pins.',
    icon: MapPin,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    title: 'Emergency SOS',
    description: 'One-tap emergency alerts to your trusted contacts with your precise location.',
    icon: Navigation,
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  {
    title: 'Route Planning',
    description: 'Smart navigation that helps you avoid hazards and find the safest path.',
    icon: Users,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-gray-50 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything you need to stay safe
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            TheWileyfox combines powerful navigation tools with community safety features.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
