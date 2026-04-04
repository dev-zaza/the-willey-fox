import Link from 'next/link';
import Image from 'next/image';
import { GlobeHeroSection } from '@/components/landing/globe-hero-section';
import { PhoneMockupSection } from '@/components/landing/phone-mockup-section';
import { FeaturesSection } from '@/components/landing/features-section';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans overflow-x-hidden">
      {/* Globe hero — dark, full bleed */}
      <GlobeHeroSection />

      {/* Phone mockup — white/gray-50 */}
      <PhoneMockupSection />

      {/* Features grid — gray-50 */}
      <FeaturesSection />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="TheWileyfox" width={32} height={32} className="object-contain grayscale opacity-50" />
            <span className="text-gray-400 font-semibold">© {new Date().getFullYear()} TheWileyfox.com</span>
          </div>
          <div className="flex gap-8 text-gray-500 text-sm">
            <Link href="#" className="hover:text-orange-500 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-orange-500 transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-orange-500 transition-colors">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
