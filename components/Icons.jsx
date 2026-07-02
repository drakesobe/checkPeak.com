// components/Icons.jsx
// Monoline SVG icon system for web (Next.js).
// Matches CheckPeakApp/components/today/Icons.tsx aesthetic.
// 24x24 viewBox, 1.5px stroke, rounded caps/joins.

import React from 'react';

function Svg({ size = 24, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flexShrink: 0 }}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconLock({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
      <circle cx="12" cy="16" r="1" fill={color} stroke="none" />
    </Svg>
  );
}

export function IconTrophy({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M7 4h10v7a5 5 0 01-10 0V4z" />
      <path d="M7 4H4a2 2 0 00-2 2v1a4 4 0 004 4h.5" />
      <path d="M17 4h3a2 2 0 012 2v1a4 4 0 01-4 4h-.5" />
      <path d="M12 16v4M8 21h8" />
      <path d="M10 4V2M14 4V2" />
    </Svg>
  );
}

export function IconStudio({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M4 8V6a1 1 0 011-1h14a1 1 0 011 1v2" />
      <line x1="7"  y1="5" x2="5"  y2="8" />
      <line x1="11" y1="5" x2="9"  y2="8" />
      <line x1="15" y1="5" x2="13" y2="8" />
      <line x1="19" y1="5" x2="17" y2="8" />
      <path d="M10 12l5 3-5 3z" fill={color} stroke="none" />
    </Svg>
  );
}

export function IconTarget({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill={color} stroke="none" />
    </Svg>
  );
}

export function IconBarChart({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <rect x="3"  y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7"  width="4" height="14" rx="1" />
      <rect x="17" y="3"  width="4" height="18" rx="1" />
      <line x1="2" y1="21" x2="22" y2="21" />
    </Svg>
  );
}

export function IconBolt({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  );
}

export function IconFire({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 0 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

export function IconAward({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="9" r="7" />
      <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
      <path d="M12 6l1.5 3h3l-2.5 2 1 3-3-2-3 2 1-3-2.5-2h3z" fill={color} stroke="none" />
    </Svg>
  );
}

export function IconCheck({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

// Specialty / trainer-type icons for libraries and trainers pages
export function IconDumbbell({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <line x1="8.5"  y1="12" x2="15.5" y2="12" />
      <rect x="4"    y="9"   width="4.5" height="6" rx="1.5" />
      <rect x="15.5" y="9"   width="4.5" height="6" rx="1.5" />
      <line x1="8.5"  y1="10" x2="8.5"  y2="14" />
      <line x1="15.5" y1="10" x2="15.5" y2="14" />
    </Svg>
  );
}

export function IconMedical({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Svg>
  );
}

export function IconBowl({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M4 11h16c0 5-3.6 9-8 9s-8-4-8-9z" />
      <path d="M12 11V7" />
      <path d="M9 7c0-1.5 1.5-3 3-3s3 1.5 3 3" />
      <path d="M8 4v3M16 4v3" />
    </Svg>
  );
}

export function IconLaptop({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M2 17h20v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2z" />
    </Svg>
  );
}

export function IconHandsHelping({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M12 6v6m0 0l-4-4m4 4l4-4" />
      <path d="M3 10h3v10H3zM18 10h3v10h-3z" />
      <path d="M6 13h12" />
    </Svg>
  );
}

export function IconLightbulb({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M9 21h6M12 3a6 6 0 016 6c0 2.2-1.2 4.1-3 5.2V17H9v-2.8A6 6 0 016 9a6 6 0 016-6z" />
    </Svg>
  );
}

export function IconPerson({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  );
}

export function IconMountain({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M3 20h18L13 6l-3 5-2-2-5 11z" />
    </Svg>
  );
}

export function IconAlert({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

export function IconChat({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
  );
}

export function IconSportFootball({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <path d="M12 2C6 2 2 6 2 12s4 10 10 10 10-4 10-10S18 2 12 2z" />
      <path d="M7 7l10 10M17 7L7 17" strokeWidth={strokeWidth * 0.7} />
      <line x1="12" y1="2" x2="12" y2="22" strokeWidth={strokeWidth * 0.6} />
      <line x1="2" y1="12" x2="22" y2="12" strokeWidth={strokeWidth * 0.6} />
    </Svg>
  );
}

export function IconSportBasketball({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93C8 8 8 16 4.93 19.07M19.07 4.93C16 8 16 16 19.07 19.07" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </Svg>
  );
}

export function IconSportBaseball({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 9c0 2 1 4 1 6M16 9c0 2-1 4-1 6" />
      <path d="M8 9c1 .5 4 .5 5 0M8 15c1-.5 4-.5 5 0" strokeWidth={strokeWidth * 0.7} />
    </Svg>
  );
}

export function IconSportSoccer({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2l3 9H9l3-9zM12 22l-3-9h6l-3 9zM2 12l7.5-2.5M22 12l-7.5-2.5" strokeWidth={strokeWidth * 0.8} />
    </Svg>
  );
}

export function IconSportTrack({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v5l-4 6M12 12l4 6" />
      <path d="M7 10h10" />
    </Svg>
  );
}

export function IconSportWrestling({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="7" cy="4" r="2" />
      <circle cx="17" cy="4" r="2" />
      <path d="M7 6c0 3 2 5 5 5s5-2 5-5" />
      <path d="M5 12l7 5 7-5" />
      <path d="M8 17l-3 5M16 17l3 5" />
    </Svg>
  );
}

export function IconSportSwimming({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="17" cy="4" r="2" />
      <path d="M3 14c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0" />
      <path d="M3 18c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0" />
      <path d="M17 6l-8 8" />
    </Svg>
  );
}

export function IconSportVolleyball({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2C8 6 8 18 12 22M12 2c4 4 4 16 0 20" strokeWidth={strokeWidth * 0.7} />
    </Svg>
  );
}

export function IconSportOther({ size = 24, color = '#fff', strokeWidth = 1.5, ...rest }) {
  return (
    <Svg size={size} stroke={color} strokeWidth={strokeWidth} {...rest}>
      <circle cx="12" cy="5" r="3" />
      <path d="M9 8v8l3 4 3-4V8" />
      <path d="M6 13h12" />
    </Svg>
  );
}
