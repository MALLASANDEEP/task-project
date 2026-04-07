import * as React from "react";
import { cn } from "@/lib/utils";
const Card = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("rounded-2xl border border-border/70 bg-card/95 text-card-foreground shadow-[0_12px_30px_-22px_rgba(15,23,42,0.45)] backdrop-blur transition-all duration-200", className)} {...props}/>));
Card.displayName = "Card";
const CardHeader = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 md:p-6", className)} {...props}/>));
CardHeader.displayName = "CardHeader";
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (<h3 ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight md:text-2xl", className)} {...props}/>));
CardTitle.displayName = "CardTitle";
const CardDescription = React.forwardRef(({ className, ...props }, ref) => (<p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props}/>));
CardDescription.displayName = "CardDescription";
const CardContent = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props}/>);
CardContent.displayName = "CardContent";
const CardFooter = React.forwardRef(({ className, ...props }, ref) => (<div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props}/>));
CardFooter.displayName = "CardFooter";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

