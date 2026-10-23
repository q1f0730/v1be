// 来自 Rewamp UI: src/components/ui/Skeleton.jsx（registry: skeleton）
// 改动：底色改成本站 --surface2，闪光改成中性白；只保留 Skeleton 基础块，删掉与本站无关的 Folder/Chip 骨架。
import React from 'react';

/**
 * Shared Skeleton primitive
 * Pulsing block styled with brand tokens and subtle lilac shimmer sweep:
 * linear-gradient(90deg, transparent, rgba(212,203,229,0.15), transparent) ~1.5s ease-in-out infinite.
 */
export function Skeleton({ className = '', style = {}, children, ...props }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[var(--surface2)] ${className}`}
      style={{
        ...style,
      }}
      {...props}
    >
      {/* Brand Lilac Shimmer Sweep */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--shimmer) 50%, transparent 100%)',
        }}
      />
      {children}
    </div>
  );
}

export default Skeleton;
