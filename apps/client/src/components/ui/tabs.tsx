import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "../../lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex items-center gap-1 border-b border-[--color-border]", className)}
    {...props}
  />
));

TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex min-h-9 items-center gap-2 border-b border-transparent px-3 text-[13px] font-semibold text-[--color-text-secondary] transition-colors outline-none hover:text-[--color-text-primary] focus-visible:ring-2 focus-visible:ring-[--color-brand-orange] focus-visible:ring-offset-1 focus-visible:ring-offset-[--bg-2] data-[state=active]:border-[--color-text-primary] data-[state=active]:text-[--color-text-primary]",
      className
    )}
    {...props}
  />
));

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand-orange]", className)}
    {...props}
  />
));

TabsContent.displayName = TabsPrimitive.Content.displayName;
