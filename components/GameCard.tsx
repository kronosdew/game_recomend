interface Props {
  appid: number;
  name: string;
  releaseDate: string;
  reason: string;
  tags: string[];
}

export function GameCard({ appid, name, releaseDate, reason, tags }: Props) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{name}</h3>
        <time className="text-xs text-muted-foreground">{releaseDate}</time>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{reason}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className="rounded bg-secondary px-2 py-0.5 text-xs">{t}</span>
        ))}
      </div>

      <a
        href={`https://store.steampowered.com/app/${appid}/`}
        target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-block text-sm underline"
      >
        Steam&apos;de gör
      </a>
    </article>
  );
}
