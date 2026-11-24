import { ShieldCheck, Shield, FlaskConical } from 'lucide-react';
import { UserRoleBadge } from '../lib/accountManager';
import { cn } from '../lib/utils';

interface RoleBadgePillProps {
  role: UserRoleBadge | null | undefined;
  size?: 'xs' | 'sm';
  className?: string;
}

export function RoleBadgePill({ role, size = 'xs', className }: RoleBadgePillProps) {
  if (!role) return null;

  const isSm = size === 'sm';

  if (role === 'admin') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-extrabold uppercase tracking-wider shadow-2xs',
          isSm ? 'gap-1.5 px-3 py-1 text-xs rounded-lg' : 'gap-1 px-1.5 py-0.5 text-[9px]',
          className
        )}
      >
        <ShieldCheck size={isSm ? 14 : 10} className="text-amber-500 shrink-0" />
        <span>Admin</span>
      </span>
    );
  }

  if (role === 'taster') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 font-extrabold uppercase tracking-wider shadow-2xs',
          isSm ? 'gap-1.5 px-3 py-1 text-xs rounded-lg' : 'gap-1 px-1.5 py-0.5 text-[9px]',
          className
        )}
      >
        <FlaskConical size={isSm ? 14 : 10} className="text-cyan-500 shrink-0" />
        <span>Taster</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-[#7B208F]/15 text-[#7B208F] dark:text-[#F36A78] border border-[#C9349B]/35 font-extrabold uppercase tracking-wider shadow-2xs',
        isSm ? 'gap-1.5 px-3 py-1 text-xs rounded-lg' : 'gap-1 px-1.5 py-0.5 text-[9px]',
        className
      )}
    >
      <Shield size={isSm ? 14 : 10} className="text-[#C9349B] shrink-0" />
      <span>Co-admin</span>
    </span>
  );
}
