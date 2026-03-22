import { Children, isValidElement, type ReactNode } from "react";
import { STAGGER_STEP_MS } from "@/lib/transitions";
import { cn } from "@/lib/utils";

type StaggerListProps = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  stepMs?: number;
  startDelayMs?: number;
  maxDelayMs?: number;
};

export function StaggerList({
  children,
  className,
  itemClassName,
  stepMs = STAGGER_STEP_MS,
  startDelayMs = 0,
  maxDelayMs = 260,
}: StaggerListProps) {
  const items = Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, index) => {
        const delayMs = Math.min(startDelayMs + index * stepMs, maxDelayMs);
        const key = isValidElement(child) && child.key != null ? child.key : `stagger-${index}`;

        return (
          <div
            key={key}
            className={cn("stagger-reveal", itemClassName)}
            style={{ animationDelay: `${delayMs}ms` }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}