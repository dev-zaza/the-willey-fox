import Link from 'next/link';

/** Ported messaging from WF-mapping/newhomepage Medical ID section (mobile-responsive). */
export function MedicalIdSection() {
  return (
    <section className="px-4 py-16 sm:py-20" style={{ background: '#FFF8E7' }}>
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-[#8A7B67]">MEDICAL ID · SOS BAND</p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-[#17130F] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
          >
            Wearable safety that scans to the right people
          </h2>
          <p className="mt-4 max-w-[54ch] text-sm leading-6 text-[#5C5245] sm:text-base">
            Medical ID bands and guardian tags show only the fields you publish — allergies, conditions, medication,
            and who to contact. An addition to a conventional medical ID, never a replacement. Not a medical device.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-[#5C5245]">
            <li>· Kids&apos; slap bands and guardian bands for school and travel</li>
            <li>· Key fobs, pet tags, and smart stickers for bags and valuables</li>
            <li>· Free plan: 5 physical tags · family digital profiles stay free</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-[#ea2e00] px-6 py-3 text-sm font-bold text-white"
            >
              Get your tag
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[#17130F]/20 bg-white px-6 py-3 text-sm font-bold text-[#17130F]"
            >
              Sign in
            </Link>
          </div>
        </div>
        <div
          className="rounded-3xl border p-6 sm:p-8"
          style={{ borderColor: 'rgba(27,20,16,0.1)', background: '#fff' }}
        >
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">SAMPLE SCAN CARD</p>
          <p className="mt-3 text-xl font-bold text-[#17130F]">Zoe · 7</p>
          <p className="mt-1 text-sm text-[#5C5245]">Protected person · fields you choose to show</p>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#E3D8C6] pb-2">
              <dt className="text-[#8A7B67]">Allergies</dt>
              <dd className="font-semibold text-[#17130F]">Penicillin</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#E3D8C6] pb-2">
              <dt className="text-[#8A7B67]">Conditions</dt>
              <dd className="font-semibold text-[#17130F]">Asthma</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#8A7B67]">Guardian note</dt>
              <dd className="max-w-[28ch] text-right font-semibold text-[#17130F]">
                Please call Mia first. Zoe knows to wait with a shop assistant.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
