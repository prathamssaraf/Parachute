export default function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Wing */}
      <path
        d="M10 35 C 10 28, 90 28, 90 35 L 90 42 C 90 45, 10 45, 10 42 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wing cells */}
      <path d="M25 31 V44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M40 29 V45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M60 29 V45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M75 31 V44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      {/* Suspension ropes */}
      <path d="M12 43 L50 82" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 45 L50 82" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M70 45 L50 82" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M88 43 L50 82" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Pilot */}
      <rect x="46" y="82" width="8" height="6" rx="3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
