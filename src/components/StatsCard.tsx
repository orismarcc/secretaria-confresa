import { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  variant?: 'default' | 'primary' | 'secondary' | 'warning' | 'success' | 'info';
  className?: string;
}

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-primary/10 border-primary/20',
  secondary: 'bg-secondary/10 border-secondary/20',
  warning: 'bg-warning/10 border-warning/20',
  success: 'bg-success/10 border-success/20',
  info: 'bg-info/10 border-info/20',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/20 text-primary',
  secondary: 'bg-secondary/20 text-secondary',
  warning: 'bg-warning/20 text-warning',
  success: 'bg-success/20 text-success',
  info: 'bg-info/20 text-info',
};

export const StatsCard = forwardRef<HTMLDivElement, StatsCardProps>(
  ({ title, value, icon: Icon, description, variant = 'default', className }, ref) => {
    return (
      <Card ref={ref} className={cn('card-interactive', variantStyles[variant], className)}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div className={cn('p-2 sm:p-3 rounded-xl shrink-0', iconStyles[variant])}>
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

StatsCard.displayName = 'StatsCard';
