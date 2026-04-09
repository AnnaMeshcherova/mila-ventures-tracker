interface BulletListProps {
  items: string[];
  dotClass: string;
}

export function BulletList({ items, dotClass }: BulletListProps) {
  const filtered = items.filter((item) => item.trim());
  if (filtered.length === 0) return null;
  return (
    <ul className="space-y-1">
      {filtered.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span
            className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
