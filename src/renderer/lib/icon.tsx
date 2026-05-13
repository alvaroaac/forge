import type { CSSProperties, ReactNode } from 'react';

type IconProps = {
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  children: ReactNode;
};

export function Icon({ size = 14, stroke = 1.5, style, children }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
