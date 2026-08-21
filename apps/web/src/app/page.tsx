import Link from 'next/link';
import Image from 'next/image';
import { GlobeHeroSection } from '@/components/landing/globe-hero-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { UseCasesSection } from '@/components/landing/use-cases-section';
import { PhoneMockupSection } from '@/components/landing/phone-mockup-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { TrustStatsSection } from '@/components/landing/trust-stats-section';
import { PricingTeaserSection } from '@/components/landing/pricing-teaser-section';
import { FaqSection } from '@/components/landing/faq-section';
import { AppDownloadSection } from '@/components/landing/app-download-section';
import { FinalCtaSection } from '@/components/landing/final-cta-section';

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col font-sans overflow-x-hidden"
      style={{ background: '#f0e7d6', color: '#1b1410' }}
    >
      <GlobeHeroSection />
      <HowItWorksSection />
      <UseCasesSection />
      <PhoneMockupSection />
      <FeaturesSection />
      <TrustStatsSection />
      <PricingTeaserSection />
      <AppDownloadSection />
      <FaqSection />
      <FinalCtaSection />

      <footer
        className="py-14 px-4"
        style={{ background: '#f0e7d6', borderTop: '1px solid rgba(27,20,16,0.08)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="TheWileyfox"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="text-sm" style={{ color: '#7a6957' }}>
              © {new Date().getFullYear()} TheWileyfox. Reuniting strangers since today.
            </span>
          </div>
          <div className="flex gap-7 text-sm" style={{ color: '#7a6957' }}>
            <Link href="/privacy-policy" className="transition-colors hover:text-[#ea2e00]">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[#ea2e00]">
              Terms
            </Link>
            <Link href="/delete-account" className="transition-colors hover:text-[#ea2e00]">
              Delete Account
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-[#ea2e00]">
              Pricing
            </Link>
            <Link href="/support" className="transition-colors hover:text-[#ea2e00]">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
