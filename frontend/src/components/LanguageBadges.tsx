import { languageColor } from '../util/status';

export default function LanguageBadges({
  languages,
  withLabel = true,
}: {
  languages: string[];
  withLabel?: boolean;
}) {
  if (!languages || languages.length === 0) return null;
  return (
    <div className="langs">
      {withLabel && <span className="langs-label">Languages:</span>}
      {languages.map((l) => {
        const c = languageColor(l);
        return (
          <span
            key={l}
            className="lang-badge"
            style={{ color: c, borderColor: c, background: `${c}22` }}
          >
            {l}
          </span>
        );
      })}
    </div>
  );
}
