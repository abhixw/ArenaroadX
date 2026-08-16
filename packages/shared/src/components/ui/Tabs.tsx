import { cn } from "@shared/lib/utils";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Tabs<T extends string>({ options, value, onChange }: TabsProps<T>) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-100">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative px-3.5 py-2.5 text-sm font-medium transition-colors",
              active ? "text-primary-600" : "text-gray-500 hover:text-gray-700",
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span className="ml-1.5 text-xs text-gray-400">{option.count}</span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary-500" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
