"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

type LiquidGlassVars = React.CSSProperties & {
  "--liquid-accent"?: string;
  "--liquid-accent-rgb"?: string;
};

function getLiquidVars(accent?: string, accentRgb?: string) {
  if (!accent && !accentRgb) return undefined;

  return {
    "--liquid-accent": accent,
    "--liquid-accent-rgb": accentRgb,
  } as LiquidGlassVars;
}

const surfaceVariants = cva("liquid-glass-surface", {
  variants: {
    tone: {
      default: "liquid-glass-surface-default",
      soft: "liquid-glass-surface-soft",
      strong: "liquid-glass-surface-strong",
      menu: "liquid-glass-surface-menu",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

type LiquidGlassSurfaceProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof surfaceVariants> & {
    accent?: string;
    accentRgb?: string;
    as?: "div" | "nav";
  };

export function LiquidGlassSurface({
  accent,
  accentRgb,
  as: Comp = "div",
  className,
  style,
  tone,
  ...props
}: LiquidGlassSurfaceProps) {
  return (
    <Comp
      className={cn(surfaceVariants({ tone }), className)}
      style={{ ...getLiquidVars(accent, accentRgb), ...style }}
      {...props}
    />
  );
}

const buttonVariants = cva(
  "liquid-glass-button relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border text-sm font-black outline-none transition-[color,transform,box-shadow,background-color,border-color] duration-300 focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      tone: {
        default: "liquid-glass-button-default",
        active: "liquid-glass-button-active",
        subtle: "liquid-glass-button-subtle",
        danger: "liquid-glass-button-danger",
      },
      size: {
        sm: "min-h-9 px-3 py-1.5 text-xs",
        md: "min-h-10 px-3.5 py-2",
        lg: "min-h-11 px-4 py-2",
        icon: "h-10 w-10 p-0",
        mobile: "min-h-[3.35rem] px-1 py-1 text-[10px] leading-tight",
      },
      shape: {
        pill: "rounded-full",
        rounded: "rounded-[1rem]",
        mobile: "rounded-[0.95rem]",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "md",
      shape: "pill",
    },
  }
);

type LiquidGlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    accent?: string;
    accentRgb?: string;
  };

type SlottableChildProps = React.HTMLAttributes<HTMLElement> & {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

function renderGlassChildren(children: React.ReactNode) {
  return (
    <>
      <span className="liquid-glass-refract" aria-hidden="true" />
      <span className="liquid-glass-shine" aria-hidden="true" />
      <span className="liquid-glass-content">{children}</span>
    </>
  );
}

export const LiquidGlassButton = React.forwardRef<HTMLButtonElement, LiquidGlassButtonProps>(
  (
    {
      accent,
      accentRgb,
      asChild = false,
      children,
      className,
      onClick,
      shape,
      size,
      style,
      tone,
      type,
      ...props
    },
    ref
  ) => {
    const mergedClassName = cn(buttonVariants({ tone, size, shape }), className);
    const mergedStyle = { ...getLiquidVars(accent, accentRgb), ...style };

    if (asChild) {
      const child = React.Children.only(children);

      if (!React.isValidElement<SlottableChildProps>(child)) {
        return null;
      }

      return React.cloneElement(child, {
        ...props,
        className: cn(mergedClassName, child.props.className),
        onClick,
        style: { ...mergedStyle, ...child.props.style },
        children: renderGlassChildren(child.props.children),
      });
    }

    return (
      <button
        ref={ref}
        className={mergedClassName}
        onClick={onClick}
        style={mergedStyle}
        type={type || "button"}
        {...props}
      >
        {renderGlassChildren(children)}
      </button>
    );
  }
);

LiquidGlassButton.displayName = "LiquidGlassButton";

export function LiquidGlassFilter() {
  return (
    <svg className="hidden" aria-hidden="true" focusable="false">
      <defs>
        <filter
          id="container-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}
