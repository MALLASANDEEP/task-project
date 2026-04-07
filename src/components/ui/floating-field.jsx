import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function FloatingInput({ label, className, error, id, ...props }) {
    const inputId = id || props.name || label.toLowerCase().replace(/\s+/g, "-");
    return (<div className="space-y-1.5">
      <div className="relative group">
        <Input id={inputId} placeholder=" " className={cn("peer h-11 rounded-xl border-input/80 bg-background/80 pt-4 transition-all focus:border-primary/70", className)} {...props}/>
        <label htmlFor={inputId} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:bg-background">
          {label}
        </label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>);
}
export function FloatingTextarea({ label, className, error, id, ...props }) {
    const inputId = id || props.name || label.toLowerCase().replace(/\s+/g, "-");
    return (<div className="space-y-1.5">
      <div className="relative group">
        <Textarea id={inputId} placeholder=" " className={cn("peer min-h-[96px] rounded-xl border-input/80 bg-background/80 pt-6 transition-all focus:border-primary/70", className)} {...props}/>
        <label htmlFor={inputId} className="pointer-events-none absolute left-3 top-6 -translate-y-1/2 rounded px-1 text-sm text-muted-foreground transition-all peer-placeholder-shown:top-6 peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:bg-background">
          {label}
        </label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>);
}

