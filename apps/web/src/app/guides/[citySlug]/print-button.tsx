'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#FF7B14] transition-colors px-3 py-1.5 rounded-lg hover:bg-orange-50"
    >
      <span>🖨</span>
      Download as PDF
    </button>
  );
}
